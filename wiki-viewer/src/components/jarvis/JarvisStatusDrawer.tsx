import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, X, Wrench, Target,
  Brain, CheckCircle, AlertCircle, Lock,
} from 'lucide-react';

interface ToolItem {
  name: string; description: string; risk_level: string; category: string;
  call_count: number; success_count: number; fail_count: number; avg_duration_ms: number;
}

interface AgentGoal {
  id: string; title?: string; description: string; progress: number; status: string; priority?: string;
}

interface LearningSummary {
  total_lessons: number; categories: Record<string, number>;
  top_patterns: { pattern: string; count: number }[];
  confidence_distribution: Record<string, number>;
}

interface SafetyStatus {
  emergency_stopped: boolean; rate_usage: Record<string, string>;
  red_lines: string[]; blocked_count: number;
}

interface AgentStatus {
  status: string; cycle_count: number; last_cycle_time: string;
  total_tool_calls: number; total_success: number; total_failed: number;
  success_rate: string; pending_approvals: number; current_plan_steps: number;
  insights_count: number; safety: SafetyStatus;
}

interface JarvisStatusDrawerProps {
  open: boolean;
  onClose: () => void;
  status: AgentStatus | null;
  tools: ToolItem[];
  goals: AgentGoal[];
  learning: LearningSummary | null;
}

export function JarvisStatusDrawer({ open, onClose, status, tools, goals, learning }: JarvisStatusDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-80 z-50 bg-[var(--bg-primary)] border-l border-[var(--border-default)] overflow-y-auto"
          >
            <div className="p-4 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">System Status</h2>
                <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                  <X size={16} />
                </button>
              </div>

              {/* Agent Status mini-card */}
              <div className="apple-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={14} className={
                    status?.status === 'running' ? 'text-apple-green' :
                    status?.status === 'paused' ? 'text-apple-orange' : 'text-apple-red'
                  } />
                  <span className="text-xs font-mono-data font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {(status?.status ?? 'stopped').toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <MiniStat label="Cycles" value={String(status?.cycle_count ?? 0)} />
                  <MiniStat label="Calls" value={String(status?.total_tool_calls ?? 0)} />
                  <MiniStat label="Success" value={status?.success_rate ?? '0%'} />
                  <MiniStat label="Failed" value={String(status?.total_failed ?? 0)} />
                </div>
              </div>

              {/* Tools */}
              {tools.length > 0 && (
                <div>
                  <div className="jarvis-section-heading mb-2">
                    <Wrench size={11} className="text-[var(--apple-teal)]" />
                    Tools
                  </div>
                  <div className="space-y-1">
                    {tools.map((t) => (
                      <div key={t.name} className="flex items-center gap-2 text-[11px]">
                        <span className={`w-1.5 h-1.5 rounded-full risk-${t.risk_level}`} />
                        <span className="text-[var(--text-secondary)] truncate flex-1">{t.name}</span>
                        <span className="text-[var(--text-tertiary)] font-mono-data">{t.call_count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Goals */}
              {goals.length > 0 && (
                <div>
                  <div className="jarvis-section-heading mb-2">
                    <Target size={11} className="text-[var(--apple-purple)]" />
                    Goals
                  </div>
                  <div className="space-y-2">
                    {goals.map((g) => (
                      <div key={g.id}>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-[var(--text-secondary)] truncate">{g.description}</span>
                          <span className="text-[var(--text-tertiary)] font-mono-data">{g.progress}%</span>
                        </div>
                        <div className="w-full h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--apple-teal)] rounded-full transition-all" style={{ width: `${g.progress}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Learning */}
              {learning && (
                <div>
                  <div className="jarvis-section-heading mb-2">
                    <Brain size={11} className="text-[var(--apple-purple)]" />
                    Learning
                  </div>
                  <div className="text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">Lessons</span>
                      <span className="text-[var(--text-primary)] font-bold font-mono-data">{learning.total_lessons}</span>
                    </div>
                    {learning.top_patterns?.slice(0, 3).map((p, i) => (
                      <div key={i} className="flex items-center gap-1 text-[10px]">
                        <CheckCircle size={9} className="text-apple-green shrink-0" />
                        <span className="text-[var(--text-secondary)] truncate">{p.pattern}</span>
                        <span className="text-[var(--text-tertiary)] ml-auto">x{p.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Safety */}
              {status?.safety && (
                <div>
                  <div className="jarvis-section-heading mb-2">
                    <Lock size={11} className="text-apple-red" />
                    Safety
                  </div>
                  <div className="text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">Blocked</span>
                      <span className={status.safety.blocked_count > 0 ? 'text-apple-red' : 'text-apple-green'}>
                        {status.safety.blocked_count}
                      </span>
                    </div>
                    {status.safety.red_lines?.map((line, i) => (
                      <div key={i} className="flex items-center gap-1 text-[10px] text-apple-red">
                        <AlertCircle size={9} />
                        <span className="truncate">{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-tertiary)]/50 rounded-lg p-2">
      <div className="text-[10px] text-[var(--text-tertiary)] font-mono-data uppercase">{label}</div>
      <div className="text-sm font-bold font-mono-data text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
