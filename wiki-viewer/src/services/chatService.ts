async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error(`Backend returned empty response (status ${res.status}). Is the API server running?`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Backend returned non-JSON response (status ${res.status}): ${text.slice(0, 200)}`);
  }
}

export interface WikiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WikiChatSource {
  path: string;
  preview: string;
}

export type WikiChatChunk =
  | { type: 'chunk'; content: string }
  | { type: 'sources'; sources: WikiChatSource[] }
  | { type: 'status'; status: string }
  | { type: 'error'; error: string }
  | { type: 'done' };

export interface WebSearchResult {
  title: string;
  body: string;
  href: string;
}

export interface WikiSearchResult {
  title: string;
  excerpt: string;
  path: string;
}

export interface GenerateResult {
  explanation?: string;
  code: string;
  sources: { path: string }[];
}

const STREAM_TIMEOUT_MS = 60_000;

function parseSseEvent(eventText: string): WikiChatChunk | null {
  const lines = eventText.split('\n');
  let data = '';
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      data += line.slice(6) + '\n';
    }
  }
  data = data.trim();
  if (!data) return null;
  if (data === '[DONE]') return { type: 'done' };
  try {
    const parsed = JSON.parse(data);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    if (typeof parsed.error === 'string' && parsed.error) return { type: 'error', error: parsed.error };
    if (typeof parsed.chunk === 'string' && parsed.chunk) return { type: 'chunk', content: parsed.chunk };
    if (Array.isArray(parsed.sources)) return { type: 'sources', sources: parsed.sources as WikiChatSource[] };
    if (typeof parsed.status === 'string' && parsed.status) return { type: 'status', status: parsed.status };
  } catch {
    console.warn('[SSE] malformed event data:', data.slice(0, 200));
  }
  return null;
}

async function* readSseStream(
  res: Response,
  signal?: AbortSignal
): AsyncGenerator<WikiChatChunk, void, unknown> {
  if (!res.body) {
    throw new Error('No response body');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const resetTimeout = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      reader.cancel();
    }, STREAM_TIMEOUT_MS);
  };
  const abortHandler = () => reader.cancel();
  signal?.addEventListener('abort', abortHandler, { once: true });
  try {
    while (true) {
      resetTimeout();
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch {
        if (signal?.aborted) return;
        yield { type: 'error', error: 'Response timed out. The server may be overloaded.' };
        return;
      }
      const { done, value } = result;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const event of events) {
        if (!event.trim()) continue;
        const chunk = parseSseEvent(event);
        if (chunk) {
          if (chunk.type === 'done') return;
          if (chunk.type === 'error') {
            yield chunk;
            return;
          }
          yield chunk;
        }
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const chunk = parseSseEvent(buffer);
      if (chunk && chunk.type !== 'done') yield chunk;
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortHandler);
    reader.releaseLock();
  }
}

export async function* chatWithWikiStream(
  query: string,
  messages: WikiChatMessage[],
  contextPages?: string[],
  signal?: AbortSignal
): AsyncGenerator<WikiChatChunk, void, unknown> {
  const res = await fetch('/api/wiki-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, messages, context_pages: contextPages }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Wiki chat failed: ${res.status}`);
  }
  yield* readSseStream(res, signal);
}

export async function* chatWithLLMStream(
  messages: WikiChatMessage[],
  systemPrompt?: string,
  signal?: AbortSignal
): AsyncGenerator<WikiChatChunk, void, unknown> {
  const res = await fetch('/api/agent-kit/llm-chat-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system_prompt: systemPrompt }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `LLM chat failed: ${res.status}`);
  }
  yield* readSseStream(res, signal);
}

export async function searchWeb(
  query: string,
  limit = 10,
): Promise<{ results: WebSearchResult[] }> {
  // TODO: Add a real web search backend endpoint
  // For now, return empty results
  void query, void limit;
  console.warn('Web search is not implemented on backend yet');
  return { results: [] };
}

export async function searchWiki(
  query: string,
  limit = 20
): Promise<{ results: WikiSearchResult[] }> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Search failed: ${res.status}`);
  }
  const data = await safeJson<{ results?: Array<{ id?: string; path?: string; preview?: string }> }>(res);
  const results: WikiSearchResult[] = (data.results || []).map((r) => ({
    title: r.id || r.path || 'Untitled',
    excerpt: r.preview || '',
    path: r.path || r.id || '',
  }));
  return { results };
}

export async function generateFromKnowledge(
  query: string,
  target: 'skill' | 'mcp',
  conversationHistory?: WikiChatMessage[]
): Promise<GenerateResult> {
  const res = await fetch('/api/agent-kit/generate-from-knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      target,
      conversation_history: conversationHistory || []
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Generate failed: ${res.status}`);
  }
  return safeJson(res);
}
