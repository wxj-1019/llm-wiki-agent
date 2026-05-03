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
  useDocumentTitle(t('status.title'));
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
        <p className="text-sm text-[var(--text-tertiary)]">{t('status.loading')}</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <AlertCircle size={24} className="text-red-500" />
        <p className="text-sm text-red-500">{t('status.error.title', { error })}</p>
        <button onClick={fetchStatus} className="apple-button text-xs">{t('error.retry')}</button>
      </div>
    );
  }

  const statCards = [
    {
      label: t('status.stat.wikiPages'),
      value: status.wiki.pages,
      icon: Database,
      color: 'text-apple-blue',
      bg: 'bg-apple-blue/10',
    },
    {
      label: t('status.stat.sources'),
      value: status.wiki.sources,
      icon: FileText,
      color: 'text-apple-green',
      bg: 'bg-apple-green/10',
    },
    {
      label: t('status.stat.entities'),
      value: status.wiki.entities,
      icon: Activity,
      color: 'text-apple-purple',
      bg: 'bg-apple-purple/10',
    },
    {
      label: t('status.stat.concepts'),
      value: status.wiki.concepts,
      icon: Zap,
      color: 'text-apple-orange',
      bg: 'bg-apple-orange/10',
    },
    {
      label: t('status.stat.rawFiles'),
      value: status.raw.files,
      icon: HardDrive,
      color: 'text-apple-orange',
      bg: 'bg-apple-orange/10',
    },
    {
      label: t('status.stat.agentKitFiles'),
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
          {t('status.title')}
        </h1>
        <button
          onClick={fetchStatus}
          className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm"
        >
          <RefreshCw size={14} />
          {t('status.refresh')}
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="apple-card p-4 flex flex-col justify-between"
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl ${card.bg} flex items-center justify-center ${card.color}`}>
                <card.icon size={16} />
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">{card.label}</span>
            </div>
            <div className="text-2xl font-semibold text-[var(--text-primary)] mt-2 tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Status panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LLM Status */}
        <div className="apple-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Bot size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('status.llm.title')}</h2>
          </div>
          <div className="space-y-3">
            <StatusRow label={t('status.llm.provider')} value={status.llm.provider} />
            <StatusRow label={t('status.llm.model')} value={status.llm.model} />
            <StatusRow
              label={t('status.llm.apiKey')}
              value={status.llm.api_key_set ? t('status.llm.configured') : t('status.llm.notSet')}
              valueClass={status.llm.api_key_set ? 'text-emerald-500' : 'text-amber-500'}
            />
          </div>
        </div>

        {/* Graph Status */}
        <div className="apple-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500">
              <Network size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('status.graph.title')}</h2>
          </div>
          <div className="space-y-3">
            <StatusRow
              label={t('status.graph.status')}
              value={status.graph.ready ? t('status.graph.ready') : t('status.graph.notBuilt')}
              icon={status.graph.ready ? CheckCircle : AlertCircle}
              iconClass={status.graph.ready ? 'text-emerald-500' : 'text-amber-500'}
            />
            <StatusRow label={t('status.graph.path')} value={status.graph.path || '—'} />
          </div>
        </div>

        {/* Agent Kit */}
        <div className="apple-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500">
              <Bot size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('status.agentKit.title')}</h2>
          </div>
          <div className="space-y-3">
            <StatusRow
              label={t('status.agentKit.generated')}
              value={status.agent_kit.generated ? t('status.yes') : t('status.no')}
              icon={status.agent_kit.generated ? CheckCircle : AlertCircle}
              iconClass={status.agent_kit.generated ? 'text-emerald-500' : 'text-amber-500'}
            />
            <StatusRow label={t('status.agentKit.files')} value={String(status.agent_kit.files)} />
          </div>
        </div>

        {/* Server */}
        <div className="apple-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Server size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('status.server.title')}</h2>
          </div>
          <div className="space-y-3">
            <StatusRow label={t('status.server.version')} value={status.server.version} />
            <StatusRow label={t('status.server.time')} value={status.server.time} />
            <StatusRow
              label={t('status.server.lastIngest')}
              value={status.wiki.last_ingest || t('status.never')}
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
