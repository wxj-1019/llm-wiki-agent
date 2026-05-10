import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Bot, Activity, RefreshCw, AlertCircle, Play, Pause, Square,
  Zap, Target, Brain, Clock, Wrench, CheckCircle, XCircle,
  TrendingUp,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

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

  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [goals, setGoals] = useState<AgentGoal[]>([]);
  const [learning, setLearning] = useState<LearningSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const API_BASE = '/api/jarvis';

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
        fetch(`${API_BASE}/events?limit=10`),
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
      setEvents(rawEvents.map((e: Record<string, unknown>) => ({
        id: (e.id as string) || '',
        timestamp: (e.timestamp as string) || '',
        name: (e.name as string) || '',
        category: (e.category as string) || '',
        detail: (e.detail ?? (typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload ?? ''))) as string,
        source: e.source as string | undefined,
      })));
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw size={24} className="animate-spin text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-tertiary)]">{t('common.loading', 'Loading...')}</p>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <AlertCircle size={24} className="text-apple-red" />
        <p className="text-sm text-apple-red">{error}</p>
        <button onClick={fetchAll} className="apple-button text-xs">{t('error.retry')}</button>
      </div>
    );
  }

  const agentState = status?.status ?? 'stopped';
  const isRunning = agentState === 'running';
  const isPaused = agentState === 'paused';
  const isStopped = agentState === 'stopped';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <Bot size={28} className="text-apple-blue" />
          {t('nav.jarvis', 'Jarvis')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm"
          >
            <RefreshCw size={14} />
            {t('status.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="apple-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isRunning ? 'bg-apple-green/10 text-apple-green' : isPaused ? 'bg-amber-500/10 text-amber-500' : 'bg-apple-red/10 text-apple-red'}`}>
                  <Activity size={16} />
                </div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Agent Status</h2>
              </div>
              <div className="flex items-center gap-2">
                {!isStopped ? (
                  <>
                    <button
                      onClick={() => sendAction('stop')}
                      disabled={actionLoading !== null}
                      className="apple-button flex items-center gap-1.5 px-3 py-1.5 text-xs bg-apple-red/10 text-apple-red hover:bg-apple-red/20"
                    >
                      {actionLoading === 'stop' ? <RefreshCw size={12} className="animate-spin" /> : <Square size={12} />}
                      Stop
                    </button>
                    <button
                      onClick={() => sendAction(isPaused ? 'start' : 'pause')}
                      disabled={actionLoading !== null}
                      className="apple-button flex items-center gap-1.5 px-3 py-1.5 text-xs"
                    >
                      {actionLoading === (isPaused ? 'start' : 'pause') ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : isPaused ? (
                        <Play size={12} />
                      ) : (
                        <Pause size={12} />
                      )}
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => sendAction('start')}
                    disabled={actionLoading !== null}
                    className="apple-button flex items-center gap-1.5 px-3 py-1.5 text-xs bg-apple-green/10 text-apple-green hover:bg-apple-green/20"
                  >
                    {actionLoading === 'start' ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                    Start
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-[var(--text-tertiary)]">State</div>
                <div className={`text-sm font-medium mt-1 ${isRunning ? 'text-apple-green' : isPaused ? 'text-amber-500' : 'text-apple-red'}`}>
                  {agentState.charAt(0).toUpperCase() + agentState.slice(1)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)]">Cycles</div>
                <div className="text-sm font-medium text-[var(--text-primary)] mt-1 tabular-nums">
                  {status?.cycle_count ?? 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)]">Last Cycle</div>
                <div className="text-sm font-medium text-[var(--text-primary)] mt-1">
                  {status?.last_cycle_time
                    ? new Date(status.last_cycle_time).toLocaleTimeString()
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={Wrench} label="Total Tools" value={String(tools.length)} color="text-apple-blue" bg="bg-apple-blue/10" />
            <StatCard icon={Zap} label="Tool Calls" value={String(status?.total_tool_calls ?? 0)} color="text-apple-green" bg="bg-apple-green/10" />
            <StatCard icon={TrendingUp} label="Success Rate" value={status?.success_rate ?? '0.0%'} color="text-apple-purple" bg="bg-apple-purple/10" />
            <StatCard icon={AlertCircle} label="Failed" value={String(status?.total_failed ?? 0)} color="text-apple-red" bg="bg-apple-red/10" />
          </div>

          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-apple-orange" />
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Recent Events</h2>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] italic">No events yet</p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 py-2 border-b border-[var(--border-default)] last:border-0">
                    <div className="text-xs text-[var(--text-tertiary)] whitespace-nowrap mt-0.5 tabular-nums">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{event.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryBadge(event.category)}`}>
                          {event.category}
                        </span>
                      </div>
                      {event.detail && (
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">{event.detail}</p>
                      )}
                      {!event.detail && event.source && (
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">source: {event.source}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {tools.length > 0 && (
            <div className="apple-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wrench size={16} className="text-apple-blue" />
                  <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Registered Tools</h2>
                </div>
                <span className="text-xs text-[var(--text-tertiary)]">{tools.length} tools</span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {tools.map((tool) => (
                  <div key={tool.name} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      tool.risk_level === 'L0' ? 'bg-apple-green' :
                      tool.risk_level === 'L1' ? 'bg-apple-blue' :
                      tool.risk_level === 'L2' ? 'bg-apple-orange' : 'bg-apple-red'
                    }`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[var(--text-primary)] truncate">{tool.name}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)] truncate">{tool.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target size={16} className="text-apple-blue" />
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Current Goals</h2>
            </div>
            {goals.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] italic">No active goals</p>
            ) : (
              <div className="space-y-3">
                {goals.map((goal) => (
                  <div key={goal.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text-primary)]">{goal.description}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">{goal.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-apple-blue rounded-full transition-all duration-500"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {learning && (
            <div className="apple-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain size={16} className="text-apple-purple" />
                <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Learning Summary</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Total Lessons</span>
                  <span className="font-medium text-[var(--text-primary)] tabular-nums">{learning.total_lessons}</span>
                </div>
                {Object.keys(learning.categories ?? {}).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(learning.categories ?? {}).map(([cat, count]) => (
                      <div key={cat} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-tertiary)]">{cat}</span>
                        <span className="text-[var(--text-secondary)] tabular-nums">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(learning.top_patterns ?? []).length > 0 && (
                  <div className="pt-2 border-t border-[var(--border-default)]">
                    <div className="text-xs text-[var(--text-tertiary)] mb-2">Top Patterns</div>
                    <div className="space-y-1">
                      {learning.top_patterns.slice(0, 5).map((p, i) => (
                        <div key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5">
                          <CheckCircle size={10} className="text-apple-green mt-0.5 shrink-0" />
                          <span className="truncate">{p.pattern}</span>
                          <span className="text-[var(--text-tertiary)] ml-auto shrink-0">({p.count}x)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {Object.keys(learning.confidence_distribution ?? {}).length > 0 && (
                  <div className="pt-2 border-t border-[var(--border-default)]">
                    <div className="text-xs text-[var(--text-tertiary)] mb-1">Confidence</div>
                    <div className="flex gap-3">
                      {Object.entries(learning.confidence_distribution ?? {}).map(([band, count]) => (
                        <span key={band} className={`text-xs font-medium ${
                          band === 'high' ? 'text-apple-green' : band === 'medium' ? 'text-apple-orange' : 'text-apple-red'
                        }`}>
                          {band}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-xs text-amber-500">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="apple-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center ${color}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="text-xl font-semibold text-[var(--text-primary)] tabular-nums">{value}</div>
      <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{label}</div>
    </div>
  );
}

function categoryBadge(category?: string): string {
  const map: Record<string, string> = {
    tool: 'bg-apple-blue/10 text-apple-blue',
    system: 'bg-apple-purple/10 text-apple-purple',
    learning: 'bg-apple-green/10 text-apple-green',
    goal: 'bg-apple-orange/10 text-apple-orange',
    error: 'bg-apple-red/10 text-apple-red',
  };
  if (!category) return 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]';
  return map[category.toLowerCase()] ?? 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]';
}
