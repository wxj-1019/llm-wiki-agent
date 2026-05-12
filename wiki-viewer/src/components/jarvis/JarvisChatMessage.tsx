import { motion } from 'framer-motion';
import { User, Bot, Wrench, AlertCircle, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import type { AgentStep, AgentToolCall } from '@/stores/agentChatStore';

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'error';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: number;
  metadata?: {
    steps?: AgentStep[];
    tool_calls?: AgentToolCall[];
    status?: string;
    risk_level?: string;
    params?: Record<string, unknown>;
    req_id?: string;
  };
}

interface JarvisChatMessageProps {
  message: ChatMessage;
  onApprove?: (reqId: string) => void;
  onReject?: (reqId: string) => void;
  isLoading?: boolean;
}

export function JarvisChatMessage({ message, onApprove, onReject, isLoading }: JarvisChatMessageProps) {
  const { role, content, metadata } = message;

  if (role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex justify-end"
      >
        <div className="flex items-start gap-2 max-w-[80%]">
          <div className="apple-card px-4 py-3 bg-[var(--apple-blue)]/10 border-[var(--apple-blue)]/20">
            <p className="text-sm text-[var(--text-primary)]">{content}</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 mt-1">
            <User size={14} className="text-[var(--text-secondary)]" />
          </div>
        </div>
      </motion.div>
    );
  }

  if (role === 'assistant') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex justify-start"
      >
        <div className="flex items-start gap-2 max-w-[85%]">
          <div className="w-7 h-7 rounded-full bg-[var(--apple-teal)]/10 flex items-center justify-center shrink-0 mt-1">
            <Bot size={14} className="text-[var(--apple-teal)]" />
          </div>
          <div className="apple-card px-4 py-3">
            <div className="prose prose-sm max-w-none text-[var(--text-primary)]">
              <MarkdownRenderer content={content} />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (role === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex justify-center"
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-apple-red/10 border border-apple-red/20 text-apple-red text-xs">
          <AlertCircle size={14} />
          <span>{content}</span>
        </div>
      </motion.div>
    );
  }

  // System message (execution steps, tool calls, approvals)
  const status = metadata?.status;
  const isRunning = status === 'running' || status === 'planning' || status === 'executing';
  const isDone = status === 'done' || status === 'completed';
  const isFailed = status === 'error' || status === 'failed';
  const isApproval = metadata?.req_id && onApprove && onReject;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex justify-start pl-9"
    >
      <div className={`apple-card px-3 py-2 max-w-[85%] ${
        isApproval ? 'border-amber-500/20 bg-amber-500/5' :
        isFailed ? 'border-apple-red/20 bg-apple-red/5' :
        isRunning ? 'border-[var(--apple-blue)]/20 bg-[var(--apple-blue)]/5' :
        isDone ? 'border-apple-green/20 bg-apple-green/5' :
        'bg-[var(--bg-tertiary)]/40'
      }`}>
        <div className="flex items-center gap-2 mb-1">
          {isApproval ? (
            <AlertTriangle size={12} className="text-amber-500" />
          ) : isFailed ? (
            <XCircle size={12} className="text-apple-red" />
          ) : isRunning ? (
            <Loader2 size={12} className="animate-spin text-[var(--apple-blue)]" />
          ) : isDone ? (
            <CheckCircle size={12} className="text-apple-green" />
          ) : (
            <Wrench size={12} className="text-[var(--text-tertiary)]" />
          )}
          <span className="text-[11px] font-mono-data font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            {isApproval ? 'Approval Required' : content}
          </span>
          {metadata?.risk_level && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${riskBadge(metadata.risk_level)}`}>
              {metadata.risk_level}
            </span>
          )}
        </div>

        {isApproval && (
          <div className="space-y-2">
            {metadata?.params && Object.keys(metadata.params).length > 0 && (
              <pre className="text-[10px] bg-[var(--bg-secondary)] p-2 rounded overflow-x-auto text-[var(--text-tertiary)] font-mono-data">
                {JSON.stringify(metadata.params, null, 2)}
              </pre>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { const rid = metadata?.req_id; if (rid) onApprove?.(rid); }}
                disabled={isLoading}
                className="apple-button flex items-center gap-1 px-2.5 py-1 text-[10px] bg-apple-green/10 text-apple-green hover:bg-apple-green/20 disabled:opacity-40"
              >
                {isLoading ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                Approve
              </button>
              <button
                onClick={() => { const rid = metadata?.req_id; if (rid) onReject?.(rid); }}
                disabled={isLoading}
                className="apple-button flex items-center gap-1 px-2.5 py-1 text-[10px] bg-apple-red/10 text-apple-red hover:bg-apple-red/20 disabled:opacity-40"
              >
                <XCircle size={10} />
                Reject
              </button>
            </div>
          </div>
        )}

        {metadata?.steps && metadata.steps.length > 0 && (
          <div className="space-y-1 mt-1">
            {metadata.steps.map((step, idx) => (
              <div key={step.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-[var(--text-tertiary)] w-4">{idx + 1}.</span>
                {step.status === 'completed' && <CheckCircle size={10} className="text-apple-green shrink-0" />}
                {step.status === 'failed' && <XCircle size={10} className="text-apple-red shrink-0" />}
                {step.status === 'running' && <Loader2 size={10} className="animate-spin text-[var(--apple-blue)] shrink-0" />}
                {step.status === 'pending' && <span className="w-2.5 h-2.5 rounded-full border-2 border-[var(--border-default)] shrink-0" />}
                <span className="text-[var(--text-secondary)] truncate">{step.tool_name}</span>
                {step.result?.duration_ms && (
                  <span className="text-[10px] text-[var(--text-tertiary)] font-mono-data ml-auto">{step.result.duration_ms}ms</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function riskBadge(level: string): string {
  switch (level) {
    case 'L0': return 'bg-apple-green/10 text-apple-green';
    case 'L1': return 'bg-[var(--apple-teal)]/10 text-[var(--apple-teal)]';
    case 'L2': return 'bg-apple-orange/10 text-apple-orange';
    case 'L3': return 'bg-apple-red/10 text-apple-red';
    case 'L4': return 'bg-apple-red/10 text-apple-red';
    default: return 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]';
  }
}
