import { useState, useCallback } from 'react';
import { useAgentChatStore, type AgentExecutionState } from '@/stores/agentChatStore';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { CheckCircle, XCircle, Loader2, AlertTriangle, Clock, Brain, MessageSquare, Shield, History } from 'lucide-react';

interface ExecutionPanelProps {
  execution?: AgentExecutionState | null;
}

function riskColor(level: string): string {
  switch (level) {
    case 'L0': return 'bg-apple-green/10 text-apple-green';
    case 'L1': return 'bg-apple-blue/10 text-apple-blue';
    case 'L2': return 'bg-apple-orange/10 text-apple-orange';
    case 'L3': return 'bg-apple-red/10 text-apple-red';
    case 'L4': return 'bg-apple-red/10 text-apple-red';
    default: return 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]';
  }
}

function riskDot(level: string): string {
  switch (level) {
    case 'L0': return 'bg-apple-green';
    case 'L1': return 'bg-apple-blue';
    case 'L2': return 'bg-apple-orange';
    case 'L3': return 'bg-apple-red';
    case 'L4': return 'bg-apple-red';
    default: return 'bg-[var(--text-tertiary)]';
  }
}

export function ExecutionPanel({ execution }: ExecutionPanelProps = {}) {
  const storeCurrent = useAgentChatStore((s) => s.currentExecution);
  const storePending = useAgentChatStore((s) => s.pendingApprovals);
  const removePendingApproval = useAgentChatStore((s) => s.removePendingApproval);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const current = execution ?? storeCurrent;
  const pendingApprovals = execution ? [] : storePending;

  const resolveApproval = useCallback(async (reqId: string, action: 'approve' | 'reject') => {
    setActionLoading(reqId);
    try {
      const res = await fetch(`/api/jarvis/approvals/${reqId}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      removePendingApproval(reqId);
    } catch (e) {
      console.error('Approval failed:', e);
    } finally {
      setActionLoading(null);
    }
  }, [removePendingApproval]);

  if (!current) return null;

  const isRunning = current.status === 'executing' || current.status === 'planning' || current.status === 'reflecting' || current.status === 'summarizing';
  const isHistorical = !!execution;

  return (
    <div className="apple-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isHistorical ? (
            <History size={18} className="text-[var(--text-tertiary)]" />
          ) : isRunning ? (
            <Loader2 size={18} className="animate-spin text-apple-blue" />
          ) : current.status === 'done' ? (
            <CheckCircle size={18} className="text-apple-green" />
          ) : current.status === 'error' ? (
            <XCircle size={18} className="text-apple-red" />
          ) : (
            <Clock size={18} className="text-[var(--text-tertiary)]" />
          )}
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            {isHistorical ? 'Execution Replay' : 'Execution'}
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

      {/* Goal info for historical executions */}
      {isHistorical && current.goal && (
        <div className="text-sm text-[var(--text-secondary)]">
          <span className="text-[var(--text-tertiary)]">Goal:</span> {current.goal}
        </div>
      )}

      {/* Approval Dialogs */}
      {!isHistorical && pendingApprovals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-amber-500" />
            <span className="text-xs font-semibold text-amber-500">Approval Required</span>
          </div>
          {pendingApprovals.map((approval) => (
            <div key={approval.req_id} className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{approval.tool_name}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${riskColor(approval.risk_level)}`}>
                    {approval.risk_level}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-tertiary)]">{approval.req_id}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{approval.reason}</p>
              {Object.keys(approval.params).length > 0 && (
                <pre className="text-[10px] bg-[var(--bg-secondary)] p-2 rounded overflow-x-auto text-[var(--text-tertiary)]">
                  {JSON.stringify(approval.params, null, 2)}
                </pre>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => resolveApproval(approval.req_id, 'approve')}
                  disabled={actionLoading === approval.req_id}
                  className="apple-button flex items-center gap-1.5 px-3 py-1.5 text-xs bg-apple-green/10 text-apple-green hover:bg-apple-green/20"
                >
                  {actionLoading === approval.req_id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  Approve
                </button>
                <button
                  onClick={() => resolveApproval(approval.req_id, 'reject')}
                  disabled={actionLoading === approval.req_id}
                  className="apple-button flex items-center gap-1.5 px-3 py-1.5 text-xs bg-apple-red/10 text-apple-red hover:bg-apple-red/20"
                >
                  <XCircle size={12} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${riskDot(typeof step.risk_level === 'string' ? step.risk_level : 'L1')}`} />
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

      {/* Final Content with Markdown */}
      {current.content && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare size={12} className="text-apple-green" />
            <span className="text-xs text-[var(--text-tertiary)]">Summary</span>
          </div>
          <div className="p-3 rounded-lg bg-apple-green/5 text-sm text-[var(--text-primary)]">
            <MarkdownRenderer content={current.content} />
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
