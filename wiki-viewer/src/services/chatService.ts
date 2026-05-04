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
  // Process any remaining buffered data after stream ends
  if (buffer.trim()) {
    const chunk = parseSseEvent(buffer);
    if (chunk) yield chunk;
  }
}
