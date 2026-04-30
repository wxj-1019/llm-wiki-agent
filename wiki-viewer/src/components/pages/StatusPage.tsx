import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Activity, Database, Network, Bot, FileText, Clock,
  Server, HardDrive, Zap, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface SystemStatus {
  wiki: {
    pages: number;
    sources: number;
    entities: number;
    concepts: number;
    syntheses: number;
    last_ingest: string | null;
  };
  graph: { ready: boolean; path: string | null };
  raw: { files: number };
  agent_kit: { generated: boolean; files: number };
  llm: { provider: string; model: string; api_key_set: boolean };
  server: { time: string; version: string };
}

export function StatusPage() {
  const { t } = useTranslation();
  useDocumentTitle('System Status');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw size={24} className="animate-spin text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-tertiary)]">Loading system status...</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <AlertCircle size={24} className="text-red-500" />
        <p className="text-sm text-red-500">Failed to load status: {error}</p>
        <button onClick={fetchStatus} className="apple-button text-xs">Retry</button>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Wiki Pages',
      value: status.wiki.pages,
      icon: Database,
      color: 'text-apple-blue',
      bg: 'bg-apple-blue/10',
    },
    {
      label: 'Sources',
      value: status.wiki.sources,
      icon: FileText,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Entities',
      value: status.wiki.entities,
      icon: Activity,
      color: 'text-apple-green',
      bg: 'bg-apple-green/10',
    },
    {
      label: 'Concepts',
      value: status.wiki.concepts,
      icon: Zap,
      color: 'text-apple-purple',
      bg: 'bg-apple-purple/10',
    },
    {
      label: 'Raw Files',
      value: status.raw.files,
      icon: HardDrive,
      color: 'text-apple-orange',
      bg: 'bg-apple-orange/10',
    },
    {
      label: 'Agent Kit Files',
      value: status.agent_kit.files,
      icon: Bot,
      color: 'text-apple-pink',
      bg: 'bg-apple-pink/10',
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <Activity size={28} className="text-apple-blue" />
          System Status
        </h1>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-[var(--bg-secondary)] rounded-2xl p-4 flex flex-col justify-between border border-[var(--border-default)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center ${card.color}`}>
                <card.icon size={16} />
              </div>
              <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">{card.label}</span>
            </div>
            <div className="text-2xl font-semibold text-[var(--text-primary)] mt-2 tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Status panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LLM Status */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 border border-[var(--border-default)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Bot size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">LLM Configuration</h2>
          </div>
          <div className="space-y-3">
            <StatusRow label="Provider" value={status.llm.provider} />
            <StatusRow label="Model" value={status.llm.model} />
            <StatusRow
              label="API Key"
              value={status.llm.api_key_set ? 'Configured' : 'Not set'}
              valueClass={status.llm.api_key_set ? 'text-emerald-500' : 'text-amber-500'}
            />
          </div>
        </div>

        {/* Graph Status */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 border border-[var(--border-default)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500">
              <Network size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Knowledge Graph</h2>
          </div>
          <div className="space-y-3">
            <StatusRow
              label="Status"
              value={status.graph.ready ? 'Ready' : 'Not built'}
              icon={status.graph.ready ? CheckCircle : AlertCircle}
              iconClass={status.graph.ready ? 'text-emerald-500' : 'text-amber-500'}
            />
            <StatusRow label="Path" value={status.graph.path || '—'} />
          </div>
        </div>

        {/* Agent Kit */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 border border-[var(--border-default)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500">
              <Bot size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Agent Kit</h2>
          </div>
          <div className="space-y-3">
            <StatusRow
              label="Generated"
              value={status.agent_kit.generated ? 'Yes' : 'No'}
              icon={status.agent_kit.generated ? CheckCircle : AlertCircle}
              iconClass={status.agent_kit.generated ? 'text-emerald-500' : 'text-amber-500'}
            />
            <StatusRow label="Files" value={String(status.agent_kit.files)} />
          </div>
        </div>

        {/* Server */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 border border-[var(--border-default)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Server size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Server</h2>
          </div>
          <div className="space-y-3">
            <StatusRow label="Version" value={status.server.version} />
            <StatusRow label="Time" value={status.server.time} />
            <StatusRow
              label="Last Ingest"
              value={status.wiki.last_ingest || 'Never'}
              icon={Clock}
              iconClass="text-[var(--text-tertiary)]"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatusRow({
  label,
  value,
  icon: Icon,
  valueClass,
  iconClass,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  valueClass?: string;
  iconClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <div className={`flex items-center gap-1.5 font-medium ${valueClass || 'text-[var(--text-primary)]'}`}>
        {Icon && <Icon size={14} className={iconClass} />}
        <span>{value}</span>
      </div>
    </div>
  );
}
