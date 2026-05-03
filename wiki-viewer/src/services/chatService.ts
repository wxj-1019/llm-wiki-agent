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
  if (!res.body) {
    throw new Error('No response body');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        yield { done: true };
        return;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          yield { error: parsed.error };
          return;
        }
        if (parsed.chunk) {
          yield { chunk: parsed.chunk };
        }
        if (parsed.sources) {
          yield { sources: parsed.sources as WikiChatSource[] };
        }
      } catch {
        // ignore malformed lines
      }
    }
  }
}
