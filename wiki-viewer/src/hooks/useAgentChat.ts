import { useCallback, useRef } from 'react';
import { useAgentChatStore } from '@/stores/agentChatStore';

const SSE_EVENT_RE = /^event:\s*(\S+)\r?\n/;
const SSE_DATA_RE = /^data:\s*(.+)$/m;

interface AgentChatOptions {
  description: string;
  strategy?: string;
  options?: Record<string, unknown>;
}

export function useAgentChat() {
  const abortRef = useRef<AbortController | null>(null);
  const startExecution = useAgentChatStore((s) => s.startExecution);
  const updateExecution = useAgentChatStore((s) => s.updateExecution);
  const addStep = useAgentChatStore((s) => s.addStep);
  const updateStep = useAgentChatStore((s) => s.updateStep);
  const addToolCall = useAgentChatStore((s) => s.addToolCall);
  const updateToolCall = useAgentChatStore((s) => s.updateToolCall);
  const addReflection = useAgentChatStore((s) => s.addReflection);
  const setContent = useAgentChatStore((s) => s.setContent);
  const setError = useAgentChatStore((s) => s.setError);
  const setDone = useAgentChatStore((s) => s.setDone);
  const setConnected = useAgentChatStore((s) => s.setConnected);
  const addPendingApproval = useAgentChatStore((s) => s.addPendingApproval);

  const connect = useCallback(async (opts: AgentChatOptions) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const strategy = opts.strategy ?? 'balanced';
    const exec = startExecution(opts.description, strategy);
    const sessionId = exec.session_id;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: opts.description,
          strategy,
          options: opts.options ?? {},
          session_id: sessionId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        setError(sessionId, `HTTP ${response.status}: ${errText}`);
        setConnected(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError(sessionId, 'No response body');
        setConnected(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const chunk of events) {
          if (!chunk.trim()) continue;
          const eventMatch = chunk.match(SSE_EVENT_RE);
          const dataMatch = chunk.match(SSE_DATA_RE);
          if (!eventMatch || !dataMatch) continue;

          const eventType = eventMatch[1];
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }

          const evtSessionId = (data.session_id as string) || sessionId;

          switch (eventType) {
            case 'plan': {
              updateExecution(evtSessionId, { status: 'executing' });
              const steps = (data.steps as Array<Record<string, unknown>>) ?? [];
              for (const s of steps) {
                addStep(evtSessionId, {
                  id: (s.id as string) || `step_${Math.random().toString(36).slice(2, 6)}`,
                  tool_name: (s.tool_name as string) || '',
                  params: (s.params as Record<string, unknown>) ?? {},
                  status: ((s.status as string) || 'pending') as import('@/stores/agentChatStore').AgentStepStatus,
                });
              }
              break;
            }
            case 'step_start': {
              updateExecution(evtSessionId, { status: 'executing' });
              updateStep(evtSessionId, data.step_id as string, { status: 'running' });
              break;
            }
            case 'approval_required': {
              addPendingApproval({
                req_id: data.req_id as string,
                step_id: data.step_id as string,
                tool_name: data.tool_name as string,
                params: (data.params as Record<string, unknown>) ?? {},
                risk_level: (data.risk_level as string) ?? 'L3',
                reason: (data.reason as string) ?? '',
                created_at: Date.now(),
              });
              break;
            }
            case 'tool_call': {
              const tcStatus = (data.status as string) === 'awaiting_approval'
                ? 'awaiting_approval'
                : 'running';
              addToolCall(evtSessionId, {
                step_id: data.step_id as string,
                tool_name: data.tool_name as string,
                params: (data.params as Record<string, unknown>) ?? {},
                status: tcStatus,
              });
              break;
            }
            case 'tool_result': {
              updateToolCall(evtSessionId, data.step_id as string, {
                status: (data.success as boolean) ? 'success' : 'failed',
                result: data.error ? String(data.error) : undefined,
                duration_ms: typeof data.duration_ms === 'number' ? data.duration_ms : undefined,
              });
              updateStep(evtSessionId, data.step_id as string, {
                status: (data.success as boolean) ? 'completed' : 'failed',
                result: {
                  success: !!data.success,
                  data: data.data,
                  error: data.error ? String(data.error) : undefined,
                  duration_ms: typeof data.duration_ms === 'number' ? data.duration_ms : undefined,
                },
              });
              break;
            }
            case 'reflection': {
              updateExecution(evtSessionId, { status: 'reflecting' });
              addReflection(evtSessionId, {
                text: (data.text as string) || '',
                timestamp: Date.now(),
              });
              break;
            }
            case 'content': {
              updateExecution(evtSessionId, { status: 'summarizing' });
              setContent(evtSessionId, (data.text as string) || '');
              break;
            }
            case 'done': {
              setDone(evtSessionId);
              break;
            }
            case 'error': {
              setError(evtSessionId, (data.error as string) || 'Unknown error');
              break;
            }
          }
        }
      }

      setConnected(false);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setConnected(false);
        return;
      }
      setError(sessionId, (err as Error).message || 'Connection failed');
      setConnected(false);
    }
  }, [startExecution, updateExecution, addStep, updateStep, addToolCall, updateToolCall, addReflection, setContent, setError, setDone, setConnected, addPendingApproval]);

  const disconnect = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setConnected(false);
  }, [setConnected]);

  return { connect, disconnect };
}
