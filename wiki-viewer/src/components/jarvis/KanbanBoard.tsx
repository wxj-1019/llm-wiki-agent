import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle, Shield, SkipForward } from 'lucide-react';

export type KanbanTaskStatus = 'pending' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'skipped';

export interface KanbanTask {
  id: string;
  title: string;
  status: KanbanTaskStatus;
  risk_level?: string;
  progress?: number;
  tool_name?: string;
  duration_ms?: number;
  created_at?: number;
}

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onTaskClick?: (task: KanbanTask) => void;
}

interface Column {
  id: string;
  label: string;
  statuses: KanbanTaskStatus[];
  color: string;
  icon: typeof Clock;
}

const COLUMNS: Column[] = [
  { id: 'pending', label: 'Queued', statuses: ['pending'], color: 'var(--text-tertiary)', icon: Clock },
  { id: 'running', label: 'In Progress', statuses: ['running'], color: 'var(--apple-blue)', icon: Loader2 },
  { id: 'approval', label: 'Approval', statuses: ['awaiting_approval'], color: 'var(--apple-orange)', icon: Shield },
  { id: 'done', label: 'Done', statuses: ['completed', 'skipped'], color: 'var(--apple-green)', icon: CheckCircle },
  { id: 'failed', label: 'Failed', statuses: ['failed'], color: 'var(--apple-red)', icon: XCircle },
];

function riskColor(level?: string): string {
  switch (level) {
    case 'L0': return 'var(--apple-green)';
    case 'L1': return 'var(--apple-teal)';
    case 'L2': return 'var(--apple-orange)';
    case 'L3': return 'var(--apple-red)';
    case 'L4': return 'var(--apple-red)';
    default: return 'var(--text-tertiary)';
  }
}

function StatusIcon({ status, size = 12 }: { status: KanbanTaskStatus; size?: number }) {
  switch (status) {
    case 'completed': return <CheckCircle size={size} className="text-apple-green" />;
    case 'failed': return <XCircle size={size} className="text-apple-red" />;
    case 'running': return <Loader2 size={size} className="animate-spin text-apple-blue" />;
    case 'awaiting_approval': return <AlertTriangle size={size} className="text-apple-orange" />;
    case 'skipped': return <SkipForward size={size} className="text-[var(--text-tertiary)]" />;
    default: return <span className="block rounded-full border-2" style={{ width: size, height: size, borderColor: 'var(--border-strong)' }} />;
  }
}

function TaskCard({ task, onClick }: { task: KanbanTask; onClick?: (task: KanbanTask) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      onClick={() => onClick?.(task)}
      className="rounded-lg p-1.5 cursor-pointer transition-all hover:shadow-sm group"
      style={{
        backgroundColor: 'var(--bg-primary)',
        border: `1px solid var(--border-default)`,
      }}
    >
      <div className="flex items-start gap-1.5">
        <StatusIcon status={task.status} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {task.title}
          </p>
          {task.tool_name && (
            <p className="text-[10px] font-mono-data truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {task.tool_name}
            </p>
          )}
        </div>
        {task.risk_level && (
          <span
            className="text-[9px] font-bold px-1 py-0.5 rounded shrink-0"
            style={{
              backgroundColor: `color-mix(in srgb, ${riskColor(task.risk_level)} 12%, transparent)`,
              color: riskColor(task.risk_level),
            }}
          >
            {task.risk_level}
          </span>
        )}
      </div>

      {task.status === 'running' && task.progress != null && (
        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: 'var(--apple-blue)', boxShadow: '0 0 6px rgba(10,132,255,0.3)' }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, task.progress)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}

      {task.duration_ms != null && task.status !== 'running' && task.status !== 'pending' && (
        <div className="mt-1.5 text-[9px] font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
          {task.duration_ms < 1000 ? `${task.duration_ms}ms` : `${(task.duration_ms / 1000).toFixed(1)}s`}
        </div>
      )}
    </motion.div>
  );
}

export function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  const isEmpty = tasks.length === 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => col.statuses.includes(t.status));
          const Icon = col.icon;
          const isRunningCol = col.id === 'running';

          return (
            <div key={col.id} className="space-y-2">
              {/* Column header */}
              <div className="flex items-center gap-1.5 px-1">
                <Icon
                  size={12}
                  className={isRunningCol ? 'animate-spin' : ''}
                  style={{ color: col.color }}
                />
                <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: col.color }}>
                  {col.label}
                </span>
                {colTasks.length > 0 && (
                  <span
                    className="text-[9px] font-mono-data px-1 py-0.5 rounded-full ml-auto"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${col.color} 12%, transparent)`,
                      color: col.color,
                    }}
                  >
                    {colTasks.length}
                  </span>
                )}
              </div>

              {/* Cards */}
              <div
                className="rounded-lg p-1 min-h-[40px] space-y-1 transition-colors"
                style={{
                  backgroundColor: `color-mix(in srgb, ${col.color} 3%, transparent)`,
                  border: `1px dashed color-mix(in srgb, ${col.color} 15%, transparent)`,
                }}
              >
                {colTasks.length === 0 ? (
                  <div className="text-center py-2">
                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)', opacity: 0.4 }}>—</span>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onClick={onTaskClick} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isEmpty && (
        <div className="text-center py-2">
          <span className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
            No active tasks — submit a goal to get started
          </span>
        </div>
      )}
    </div>
  );
}
