import { useAgentChatStore } from '@/stores/agentChatStore';
import { CheckCircle, XCircle, Loader2, AlertTriangle, Clock, Brain, MessageSquare } from 'lucide-react';

export function ExecutionPanel() {
  const current = useAgentChatStore((s) => s.currentExecution);

  if (!current) return null;

  const isRunning = current.status === 'executing' || current.status === 'planning' || current.status === 'reflecting' || current.status === 'summarizing';

  return (
    <div className="apple-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 size={18} className="animate-spin text-apple-blue" />
          ) : current.status === 'done' ? (
            <CheckCircle size={18} className="text-apple-green" />
          ) : current.status === 'error' ? (
            <XCircle size={18} className="text-apple-red" />
          ) : (
            <Clock size={18} className="text-[var(--text-tertiary)]" />
          )}
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Execution
          </h3>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          current.status === 'done' ? 'bg-apple-green/10 text-apple-green' :
          current.status === 'error' ? 'bg-apple-red/10 text-apple-red' :
          isRunning ? 'bg-apple-blue/10 text-apple-blue' :
          'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]'
        }`}>
          {current.status}
        </span>
      </div>

      {/* Plan Steps */}
      {current.steps.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-[var(--text-tertiary)]">Plan Steps</div>
          <div className="space-y-1">
            {current.steps.map((step, idx) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                  step.status === 'running' ? 'bg-apple-blue/5 border border-apple-blue/20' :
                  step.status === 'completed' ? 'bg-apple-green/5' :
                  step.status === 'failed' ? 'bg-apple-red/5' :
                  step.status === 'awaiting_approval' ? 'bg-amber-500/5 border border-amber-500/20' :
                  'bg-[var(--bg-secondary)]'
                }`}
              >
                <span className="text-xs text-[var(--text-tertiary)] w-5">{idx + 1}.</span>
                {step.status === 'completed' && <CheckCircle size={12} className="text-apple-green shrink-0" />}
                {step.status === 'failed' && <XCircle size={12} className="text-apple-red shrink-0" />}
                {step.status === 'running' && <Loader2 size={12} className="animate-spin text-apple-blue shrink-0" />}
                {step.status === 'awaiting_approval' && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
                {step.status === 'pending' && <span className="w-3 h-3 rounded-full border-2 border-[var(--border-default)] shrink-0" />}
                <span className="flex-1 truncate">{step.tool_name}</span>
                {step.result?.duration_ms && (
                  <span className="text-xs text-[var(--text-tertiary)] tabular-nums">{step.result.duration_ms}ms</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool Calls */}
      {current.tool_calls.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-[var(--text-tertiary)]">Tool Calls</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {current.tool_calls.map((call) => (
              <div key={call.step_id} className="p-2 rounded-lg bg-[var(--bg-secondary)] text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-primary)]">{call.tool_name}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                    call.status === 'success' ? 'bg-apple-green/10 text-apple-green' :
                    call.status === 'failed' ? 'bg-apple-red/10 text-apple-red' :
                    call.status === 'awaiting_approval' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-apple-blue/10 text-apple-blue'
                  }`}>
                    {call.status}
                  </span>
                  {call.duration_ms && (
                    <span className="text-[var(--text-tertiary)] tabular-nums">{call.duration_ms}ms</span>
                  )}
                </div>
                {call.result && (
                  <div className="text-[var(--text-tertiary)] truncate">{call.result}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflections */}
      {current.reflections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Brain size={12} className="text-apple-purple" />
            <span className="text-xs text-[var(--text-tertiary)]">Reflections</span>
          </div>
          <div className="space-y-2">
            {current.reflections.map((r, i) => (
              <div key={i} className="p-3 rounded-lg bg-apple-purple/5 text-xs text-[var(--text-secondary)] italic">
                &quot;{r.text}&quot;
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Content */}
      {current.content && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare size={12} className="text-apple-green" />
            <span className="text-xs text-[var(--text-tertiary)]">Summary</span>
          </div>
          <div className="p-3 rounded-lg bg-apple-green/5 text-sm text-[var(--text-primary)] whitespace-pre-wrap">
            {current.content}
          </div>
        </div>
      )}

      {/* Error */}
      {current.error && (
        <div className="p-3 rounded-lg bg-apple-red/5 text-xs text-apple-red">
          {current.error}
        </div>
      )}
    </div>
  );
}
