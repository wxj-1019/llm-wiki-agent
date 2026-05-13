import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { isValidFilePath } from '@/lib/validation';
import { useQuery } from '@tanstack/react-query';

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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMChatResponse {
  content: string;
}

export interface AgentKitFileContent {
  content: string;
  path: string;
}

export async function chatWithLLM(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  const res = await fetchWithTimeout('/api/agent-kit/llm-chat', { timeoutMs: 120000, 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system_prompt: systemPrompt }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `LLM chat failed: ${res.status}`);
  }
  const data: LLMChatResponse = await res.json();
  return data.content;
}

const STREAM_TIMEOUT_MS = 60_000;

export async function* chatWithLLMStream(
  messages: ChatMessage[],
  systemPrompt?: string,
  signal?: AbortSignal
): AsyncGenerator<{ chunk?: string; error?: string; done?: boolean }, void, unknown> {
  const res = await fetch('/api/agent-kit/llm-chat-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system_prompt: systemPrompt }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `LLM stream failed: ${res.status}`);
  }
  if (!res.body) {
    throw new Error('No response body');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const resetTimeout = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => { reader.cancel(); }, STREAM_TIMEOUT_MS);
  };
  const abortHandler = () => reader.cancel();
  signal?.addEventListener('abort', abortHandler, { once: true });
  try {
    while (true) {
      resetTimeout();
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch {
        if (signal?.aborted) return;
        yield { error: 'Response timed out. The server may be overloaded.' };
        return;
      }
      const { done, value } = readResult;
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
        } catch {
          // ignore malformed lines
        }
      }
    }
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6);
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.chunk) yield { chunk: parsed.chunk };
            if (parsed.error) yield { error: parsed.error };
          } catch {
            // ignore
          }
        }
      }
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortHandler);
    reader.releaseLock();
  }
}

export async function readAgentKitFile(path: string): Promise<AgentKitFileContent> {
  if (!isValidFilePath(path)) throw new Error('Invalid file path');
  const res = await fetchWithTimeout(`/api/agent-kit/read-file?path=${encodeURIComponent(path)}`, { timeoutMs: 10000 });
  if (!res.ok) throw new Error(`Failed to read file: ${res.status}`);
  return safeJson(res);
}

export async function saveAgentKitFile(
  path: string,
  content: string
): Promise<{ success: boolean; path: string }> {
  if (!isValidFilePath(path)) throw new Error('Invalid file path');
  const res = await fetchWithTimeout('/api/agent-kit/save-file', { timeoutMs: 30000, 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!res.ok) throw new Error(`Failed to save file: ${res.status}`);
  return safeJson(res);
}

export interface KnowledgeSource {
  path: string;
  preview: string;
}

export interface GenerateFromKnowledgeResponse {
  sources: KnowledgeSource[];
  code: string;
  explanation: string;
  target: 'mcp' | 'skill';
  query: string;
}

export async function generateFromKnowledge(
  query: string,
  target: 'mcp' | 'skill',
  conversationHistory?: ChatMessage[]
): Promise<GenerateFromKnowledgeResponse> {
  const res = await fetchWithTimeout('/api/agent-kit/generate-from-knowledge', { timeoutMs: 300000, 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      target,
      conversation_history: conversationHistory || [],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Generation failed: ${res.status}`);
  }
  return safeJson(res);
}

// ── React Query hooks (TanStack Query with auto-retry) ──

export function useAgentKitFile(path: string | null) {
  return useQuery({
    queryKey: ['agent-kit', 'file', path],
    queryFn: () => readAgentKitFile(path!),
    enabled: path !== null && path.length > 0,
    staleTime: 30_000,
  });
}
