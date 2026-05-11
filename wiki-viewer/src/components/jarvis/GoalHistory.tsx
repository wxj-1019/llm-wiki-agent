import { useEffect, useState } from 'react';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { ExecutionPanel } from './ExecutionPanel';
import { History, RefreshCw, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function GoalHistory() {
  const history = useAgentChatStore((s) => s.history);
  const historyLoading = useAgentChatStore((s) => s.historyLoading);
  const loadHistory = useAgentChatStore((s) => s.loadHistory);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const selected = history.find((h) => h.session_id === selectedSession);

  return (
    <div className="space-y-4">
      <div className="apple-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History size={18} className="text-apple-blue" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Execution History</h2>
          </div>
          <button
            onClick={() => loadHistory()}
            disabled={historyLoading}
            className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm"
          >
            {historyLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] italic">No execution history yet</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {history.map((exec) => (
              <button
                key={exec.session_id}
                onClick={() => setSelectedSession(exec.session_id === selectedSession ? null : exec.session_id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  exec.session_id === selectedSession
                    ? 'bg-apple-blue/5 border border-apple-blue/20'
                    : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate pr-2">
                    {exec.goal}
                  </span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                    exec.status === 'done' ? 'bg-apple-green/10 text-apple-green' :
                    exec.status === 'error' ? 'bg-apple-red/10 text-apple-red' :
                    'bg-apple-blue/10 text-apple-blue'
                  }`}>
                    {exec.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(exec.started_at).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    {exec.steps.length} steps
                  </span>
                  {exec.error && (
                    <span className="text-[10px] text-apple-red flex items-center gap-1">
                      <XCircle size={10} /> error
                    </span>
                  )}
                  {!exec.error && exec.status === 'done' && (
                    <span className="text-[10px] text-apple-green flex items-center gap-1">
                      <CheckCircle size={10} /> done
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && <ExecutionPanel execution={selected} />}
    </div>
  );
}
