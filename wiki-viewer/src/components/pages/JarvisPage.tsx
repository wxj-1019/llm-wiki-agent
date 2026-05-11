import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Activity, RefreshCw, AlertCircle, Play, Pause, Square,
  Zap, Target, Brain, Clock, Wrench, CheckCircle, XCircle,
  TrendingUp, Shield, Lock, Cpu, LayoutDashboard,
  MessageSquare, Columns3, GitBranch, Lightbulb,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { useAgentChat } from '@/hooks/useAgentChat';
import { GoalInput } from '@/components/jarvis/GoalInput';
import { JarvisAvatar } from '@/components/jarvis/JarvisAvatar';
import { JarvisChatMessage, type ChatMessage } from '@/components/jarvis/JarvisChatMessage';
import { NeuralPulseBar } from '@/components/jarvis/NeuralPulseBar';
import { KanbanBoard, type KanbanTask } from '@/components/jarvis/KanbanBoard';
import { EvolutionTimeline } from '@/components/jarvis/EvolutionTimeline';
import { EvolutionHistoryPanel } from '@/components/jarvis/EvolutionHistoryPanel';
import { LearningInsights } from '@/components/jarvis/LearningInsights';
import { ToolHeatmap } from '@/components/jarvis/ToolHeatmap';
import { RealTimeMonitor } from '@/components/jarvis/RealTimeMonitor';
import { SmartSuggestions } from '@/components/jarvis/SmartSuggestions';

interface SafetyStatus {
  emergency_stopped: boolean;
  rate_usage: Record<string, string>;
  red_lines: string[];
  blocked_count: number;
}

interface AgentStatus {
  status: string;
  cycle_count: number;
  last_cycle_time: string;
  total_tool_calls: number;
  total_success: number;
  total_failed: number;
  success_rate: string;
  pending_approvals: number;
  current_plan_steps: number;
  insights_count: number;
  daily_stats: Record<string, { cycles: number; tool_calls: number; successes: number; failures: number }>;
  safety: SafetyStatus;
  event_stats: Record<string, number>;
}

interface ToolItem {
  name: string;
  description: string;
  risk_level: string;
  category: string;
  call_count: number;
  success_count: number;
  fail_count: number;
  avg_duration_ms: number;
}

interface AgentEvent {
  id: string;
  timestamp: string;
  name: string;
  category: string;
  detail: string;
  source?: string;
}

interface AgentGoal {
  id: string;
  title?: string;
  description: string;
  progress: number;
  status: string;
  priority?: string;
}

interface LearningSummary {
  total_lessons: number;
  categories: Record<string, number>;
  top_patterns: { pattern: string; count: number }[];
  confidence_distribution: Record<string, number>;
}

export function JarvisPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.jarvis', 'Jarvis'));

  /* ── Store ── */
  const executions = useAgentChatStore((s) => s.executions);
  const currentExecution = useAgentChatStore((s) => s.currentExecution);
  const pendingApprovals = useAgentChatStore((s) => s.pendingApprovals);
  const removePendingApproval = useAgentChatStore((s) => s.removePendingApproval);
  const { connect } = useAgentChat();

  /* ── Local state ── */
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [goals, setGoals] = useState<AgentGoal[]>([]);
  const [learning, setLearning] = useState<LearningSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'chat' | 'kanban' | 'evolution' | 'insights'>('chat');

  const [approvalLoading, setApprovalLoading] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const API_BASE = '/api/jarvis';

  /* Auto-switch to dark mode */
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.getAttribute('data-theme');
    html.setAttribute('data-theme', 'dark');
    return () => {
      if (previous) html.setAttribute('data-theme', previous);
      else html.removeAttribute('data-theme');
    };
  }, []);

  /* Scroll to bottom on new messages */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [executions, currentExecution, pendingApprovals]);

  function unpack<T>(res: Response): Promise<T | null> {
    return res.ok
      ? res.json().then((d) => {
          if (d && typeof d === 'object' && 'success' in d && d.success === false) return null;
          return (d?.data ?? d) as T;
        }).catch(() => null)
      : Promise.resolve(null);
  }

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, toolsRes, eventsRes, goalsRes, learningRes] = await Promise.all([
        fetch(`${API_BASE}/status`),
        fetch(`${API_BASE}/tools`),
        fetch(`${API_BASE}/events?limit=30`),
        fetch(`${API_BASE}/goals`),
        fetch(`${API_BASE}/learning`),
      ]);

      if (!statusRes.ok) throw new Error(`Status: HTTP ${statusRes.status}`);

      const statusData = await unpack<AgentStatus>(statusRes);
      const toolsData = await unpack<{ tools: ToolItem[]; total: number }>(toolsRes);
      const eventsData = await unpack<{ events: AgentEvent[] }>(eventsRes);
      const goalsData = await unpack<{ goals: AgentGoal[] }>(goalsRes);
      const learningRaw = await unpack<LearningSummary>(learningRes);

      if (statusData) setStatus(statusData);
      setTools(Array.isArray(toolsData?.tools) ? toolsData.tools : []);
      const rawEvents = Array.isArray(eventsData?.events) ? eventsData.events : [];
      setEvents(rawEvents.map((e: unknown) => {
        const ev = e as Record<string, unknown>;
        return {
          id: (ev.id as string) || '',
          timestamp: (ev.timestamp as string) || '',
          name: (ev.name as string) || '',
          category: (ev.category as string) || '',
          detail: (ev.detail ?? (typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload ?? ''))) as string,
          source: ev.source as string | undefined,
        };
      }));
      setGoals(Array.isArray(goalsData?.goals) ? goalsData.goals : []);

      const learningData = learningRaw && typeof learningRaw === 'object' ? {
        total_lessons: (learningRaw as LearningSummary).total_lessons ?? 0,
        categories: (learningRaw as LearningSummary).categories ?? {},
        top_patterns: (learningRaw as LearningSummary).top_patterns ?? [],
        confidence_distribution: (learningRaw as LearningSummary).confidence_distribution ?? {},
      } : null;
      setLearning(learningData);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll]);

  const sendAction = useCallback(async (action: string) => {
    setActionLoading(action);
    try {
      const res = await fetch(`${API_BASE}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  }, [fetchAll]);

  const handleSubmit = useCallback((description: string, strategy: string) => {
    connect({ description, strategy });
  }, [connect]);

  const resolveApproval = useCallback(async (reqId: string, action: 'approve' | 'reject') => {
    setApprovalLoading(reqId);
    try {
      const res = await fetch(`/api/jarvis/approvals/${reqId}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      removePendingApproval(reqId);
    } catch (e) {
      console.error('Approval failed:', e);
    } finally {
      setApprovalLoading(null);
    }
  }, [removePendingApproval]);

  /* ── Build chat messages from store ── */
  const messages = useMemo(() => {
    const msgs: ChatMessage[] = [];

    // Reversed so oldest first
    const allExecs = [...executions].reverse();

    for (const exec of allExecs) {
      // User message
      msgs.push({
        id: `${exec.session_id}-user`,
        role: 'user',
        content: exec.goal,
        timestamp: exec.started_at,
      });

      // Steps / execution status
      if (exec.steps.length > 0 || exec.status !== 'idle') {
        msgs.push({
          id: `${exec.session_id}-exec`,
          role: 'system',
          content: exec.status === 'done' ? 'Execution complete' :
                   exec.status === 'error' ? 'Execution failed' :
                   exec.status === 'planning' ? 'Planning...' :
                   exec.status === 'executing' ? 'Executing...' :
                   exec.status === 'reflecting' ? 'Reflecting...' :
                   exec.status === 'summarizing' ? 'Summarizing...' : 'Working...',
          timestamp: exec.started_at,
          metadata: { steps: exec.steps, status: exec.status },
        });
      }

      // Reflections
      for (const refl of exec.reflections) {
        msgs.push({
          id: `${exec.session_id}-refl-${refl.timestamp}`,
          role: 'assistant',
          content: refl.text,
          timestamp: refl.timestamp,
        });
      }

      // Final content
      if (exec.content) {
        msgs.push({
          id: `${exec.session_id}-content`,
          role: 'assistant',
          content: exec.content,
          timestamp: exec.finished_at ?? Date.now(),
        });
      }

      // Error
      if (exec.error) {
        msgs.push({
          id: `${exec.session_id}-err`,
          role: 'error',
          content: exec.error,
          timestamp: Date.now(),
        });
      }
    }

    // Pending approvals (attached to current execution)
    for (const apr of pendingApprovals) {
      msgs.push({
        id: `apr-${apr.req_id}`,
        role: 'system',
        content: `Approval required for ${apr.tool_name}`,
        timestamp: apr.created_at,
        metadata: {
          req_id: apr.req_id,
          risk_level: apr.risk_level,
          params: apr.params,
          status: 'awaiting_approval',
        },
      });
    }

    return msgs;
  }, [executions, pendingApprovals]);

  const agentState = status?.status ?? 'stopped';
  const isRunning = agentState === 'running';
  const isPaused = agentState === 'paused';
  const isStopped = agentState === 'stopped';
  const hasActiveExecution = currentExecution !== null && currentExecution.status !== 'done' && currentExecution.status !== 'error';

  /* ── Build Kanban tasks from execution state ── */
  const kanbanTasks = useMemo<KanbanTask[]>(() => {
    const tasks: KanbanTask[] = [];
    if (currentExecution) {
      for (const step of currentExecution.steps) {
        tasks.push({
          id: step.id,
          title: step.tool_name,
          status: step.status === 'awaiting_approval' ? 'awaiting_approval' :
                  step.status === 'running' ? 'running' :
                  step.status === 'completed' ? 'completed' :
                  step.status === 'failed' ? 'failed' :
                  step.status === 'skipped' ? 'skipped' : 'pending',
          risk_level: step.risk_level,
          tool_name: step.tool_name,
          duration_ms: step.result?.duration_ms,
        });
      }
    }
    for (const apr of pendingApprovals) {
      if (!tasks.find((t) => t.id === apr.req_id)) {
        tasks.push({
          id: apr.req_id,
          title: apr.tool_name,
          status: 'awaiting_approval',
          risk_level: apr.risk_level,
          tool_name: apr.tool_name,
        });
      }
    }
    return tasks;
  }, [currentExecution, pendingApprovals]);

  const avatarStatusText = hasActiveExecution
    ? currentExecution?.status === 'planning'
      ? 'Planning your request...'
      : currentExecution?.status === 'executing'
      ? 'Executing tasks...'
      : currentExecution?.status === 'reflecting'
      ? 'Reflecting on progress...'
      : currentExecution?.status === 'summarizing'
      ? 'Summarizing results...'
      : 'Processing...'
    : messages.length === 0
    ? 'How can I help you today?'
    : 'Ready for your next task.';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw size={24} className="animate-spin text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-tertiary)] font-mono-data">INITIALIZING...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col h-[calc(100vh-64px)]"
    >
      {/* Neural Pulse Bar */}
      <NeuralPulseBar tools={tools} isRunning={isRunning || hasActiveExecution} />

      {/* Header */}
      <div className="flex items-center justify-between px-1 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <Bot size={20} className="text-[var(--apple-teal)]" />
          <h1 className="text-lg font-bold tracking-widest uppercase font-mono-data text-[var(--text-primary)]">
            JARVIS
          </h1>
          <span className="text-[10px] font-mono-data text-[var(--text-tertiary)] border border-[var(--border-default)] px-1.5 py-0.5 rounded">
            v2.1
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode tabs */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            {[
              { key: 'chat' as const, icon: MessageSquare, label: 'Chat' },
              { key: 'kanban' as const, icon: Columns3, label: 'Kanban' },
              { key: 'evolution' as const, icon: GitBranch, label: 'Evolution' },
              { key: 'insights' as const, icon: Lightbulb, label: 'Insights' },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-all ${
                  viewMode === key
                    ? 'bg-apple-teal/15 text-apple-teal border border-apple-teal/30'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent'
                }`}
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>
          {/* Safety dot */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono-data">
            <Shield size={10} className={status?.safety?.emergency_stopped ? 'text-apple-red' : 'text-apple-green'} />
            <span className={status?.safety?.emergency_stopped ? 'text-apple-red' : 'text-apple-green'}>
              {status?.safety?.emergency_stopped ? 'STOP' : 'SAFE'}
            </span>
          </div>
          {/* Agent controls */}
          <div className="flex items-center gap-1">
            {!isStopped ? (
              <>
                <button
                  onClick={() => sendAction('stop')}
                  disabled={actionLoading !== null}
                  className="p-1.5 rounded border border-apple-red/30 text-apple-red hover:bg-apple-red/10 transition-colors disabled:opacity-40"
                  title="Stop"
                >
                  {actionLoading === 'stop' ? <RefreshCw size={12} className="animate-spin" /> : <Square size={12} />}
                </button>
                <button
                  onClick={() => sendAction(isPaused ? 'start' : 'pause')}
                  disabled={actionLoading !== null}
                  className="p-1.5 rounded border border-[var(--apple-blue)]/30 text-[var(--apple-blue)] hover:bg-[var(--apple-blue)]/10 transition-colors disabled:opacity-40"
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  {actionLoading === (isPaused ? 'start' : 'pause') ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : isPaused ? (
                    <Play size={12} />
                  ) : (
                    <Pause size={12} />
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={() => sendAction('start')}
                disabled={actionLoading !== null}
                className="p-1.5 rounded bg-apple-green/10 border border-apple-green/30 text-apple-green hover:bg-apple-green/20 transition-colors disabled:opacity-40"
                title="Start"
              >
                {actionLoading === 'start' ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
              </button>
            )}
          </div>
          <button
            onClick={fetchAll}
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ── Chat View ── */}
      {viewMode === 'chat' && (
        <>
          {/* ── Avatar Hero (collapses when chat has content) ── */}
          <AnimatePresence>
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, height: 0 }}
                className="flex flex-col items-center justify-center shrink-0 py-6"
              >
                <JarvisAvatar size={140} isActive={hasActiveExecution} />
                <p className="mt-4 text-sm text-[var(--text-secondary)] font-mono-data text-center">
                  {avatarStatusText}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Chat Messages ── */}
          <div className="flex-1 overflow-y-auto px-1 space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-tertiary)]">
                <p className="text-sm font-mono-data">Start a conversation with Jarvis</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['Run health check', 'List orphan pages', 'Build knowledge graph', 'Find broken links'].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSubmit(q, 'balanced')}
                      className="text-[11px] font-mono-data px-3 py-1.5 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--apple-teal)]/40 hover:text-[var(--apple-teal)] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <JarvisChatMessage
                key={msg.id}
                message={msg}
                onApprove={(reqId) => resolveApproval(reqId, 'approve')}
                onReject={(reqId) => resolveApproval(reqId, 'reject')}
                isLoading={approvalLoading === msg.metadata?.req_id}
              />
            ))}
            <div ref={chatEndRef} />
          </div>
        </>
      )}

      {/* ── Kanban View ── */}
      {viewMode === 'kanban' && (
        <div className="flex-1 overflow-y-auto px-1 py-3 space-y-4 min-h-0">
          <KanbanBoard tasks={kanbanTasks} />
        </div>
      )}

      {/* ── Evolution View ── */}
      {viewMode === 'evolution' && (
        <div className="flex-1 overflow-y-auto px-1 py-3 space-y-4 min-h-0">
          <EvolutionTimeline />
          <EvolutionHistoryPanel />
        </div>
      )}

      {/* ── Insights View ── */}
      {viewMode === 'insights' && (
        <div className="flex-1 overflow-y-auto px-1 py-3 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <RealTimeMonitor />
              <LearningInsights />
            </div>
            <div className="space-y-4">
              <SmartSuggestions />
              <ToolHeatmap />
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom: Input (always visible) ── */}
      <div className="shrink-0 pt-3 pb-2">
        <GoalInput onSubmit={handleSubmit} isLoading={hasActiveExecution} />
      </div>

      {/* Error toast */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs text-apple-red font-mono-data border border-apple-red/20 bg-apple-red/5 px-4 py-2 rounded-xl z-30"
        >
          <AlertCircle size={12} />
          <span>{error}</span>
        </motion.div>
      )}


    </motion.div>
  );
}
