export interface WikiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WikiChatSource {
  path: string;
  preview: string;
}

export interface WikiChatChunk {
  chunk?: string;
  sources?: WikiChatSource[];
  status?: string;
  error?: string;
  done?: boolean;
}

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
  if (data === '[DONE]') return { done: true };
  try {
    const parsed = JSON.parse(data);
    if (parsed.error) return { error: parsed.error };
    if (parsed.chunk) return { chunk: parsed.chunk };
    if (parsed.sources) return { sources: parsed.sources as WikiChatSource[] };
    if (parsed.status) return { status: parsed.status };
  } catch {
    // ignore malformed lines
  }
  return null;
}

async function* readSseStream(
  res: Response
): AsyncGenerator<WikiChatChunk, void, unknown> {
  if (!res.body) {
    throw new Error('No response body');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
    }
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const chunk = parseSseEvent(event);
      if (chunk) {
        if (chunk.done) return;
        if (chunk.error) {
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
    if (chunk) yield chunk;
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
  yield* readSseStream(res);
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
  yield* readSseStream(res);
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
  const data = await res.json();
  const results: WikiSearchResult[] = (data.results || []).map((r: { id?: string; path?: string; preview?: string }) => ({
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
  return res.json();
}
