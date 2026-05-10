import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ShieldCheck, RefreshCw, AlertCircle, CheckCircle, XCircle,
  Clock, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface Approval {
  id: string;
  tool_name: string;
  risk_level: string;
  params: Record<string, unknown>;
  reason: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  status: 'pending' | 'approved' | 'rejected';
  step?: { tool_name: string; params: Record<string, unknown>; risk_level: string } | null;
}

interface ApprovalStats {
  pending: number;
  approved_today: number;
  rejected_today: number;
}

type Tab = 'pending' | 'history';

export function ApprovalsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.approvals', 'Approvals'));

  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [historyApprovals, setHistoryApprovals] = useState<Approval[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const mapApproval = (raw: Record<string, unknown>): Approval => ({
    id: raw.id as string,
    tool_name: raw.tool_name as string ?? (raw.step as Record<string, string>)?.tool_name ?? '',
    risk_level: raw.risk_level as string ?? (raw.step as Record<string, string>)?.risk_level ?? 'L1',
    params: (raw.params ?? (raw.step as Record<string, Record<string, unknown>>)?.params ?? {}) as Record<string, unknown>,
    reason: raw.reason as string ?? '',
    created_at: raw.created_at as string ?? '',
    resolved_at: raw.resolved_at as string | undefined,
    resolved_by: raw.resolved_by as string | undefined,
    status: raw.status as 'pending' | 'approved' | 'rejected',
  });

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/jarvis/approvals?status=pending');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawList: Record<string, unknown>[] = data?.approvals ?? (Array.isArray(data) ? data : []);
      const list: Approval[] = rawList.map(mapApproval);
      setPendingApprovals(list);
      setStats({
        pending: list.length,
        approved_today: 0,
        rejected_today: 0,
      });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/jarvis/approvals?status=history');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawList: Record<string, unknown>[] = data?.approvals ?? (Array.isArray(data) ? data : []);
      const list: Approval[] = rawList.map(mapApproval);
      setHistoryApprovals(list);
      const today = new Date().toDateString();
      const approvedToday = list.filter(
        (a) => a.status === 'approved' && a.resolved_at && new Date(a.resolved_at).toDateString() === today,
      ).length;
      const rejectedToday = list.filter(
        (a) => a.status === 'rejected' && a.resolved_at && new Date(a.resolved_at).toDateString() === today,
      ).length;
      setStats((prev) => prev ? { ...prev, approved_today: approvedToday, rejected_today: rejectedToday } : null);
    } catch {
      // non-critical
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPending(), fetchHistory()]);
    setLoading(false);
  }, [fetchPending, fetchHistory]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const resolveApproval = useCallback(async (id: string, action: 'approve' | 'reject') => {
    setActionLoading((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/jarvis/approvals/${id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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

  if (error && pendingApprovals.length === 0 && historyApprovals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <AlertCircle size={24} className="text-apple-red" />
        <p className="text-sm text-apple-red">{error}</p>
        <button onClick={fetchAll} className="apple-button text-xs">{t('error.retry')}</button>
      </div>
    );
  }

  const currentList = tab === 'pending' ? pendingApprovals : historyApprovals;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <ShieldCheck size={28} className="text-apple-green" />
          {t('nav.approvals', 'Approvals')}
        </h1>
        <button
          onClick={fetchAll}
          className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm"
        >
          <RefreshCw size={14} />
          {t('status.refresh', 'Refresh')}
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="apple-card p-4 text-center">
            <div className="text-2xl font-semibold text-apple-orange tabular-nums">{stats.pending}</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">Pending</div>
          </div>
          <div className="apple-card p-4 text-center">
            <div className="text-2xl font-semibold text-apple-green tabular-nums">{stats.approved_today}</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">Approved Today</div>
          </div>
          <div className="apple-card p-4 text-center">
            <div className="text-2xl font-semibold text-apple-red tabular-nums">{stats.rejected_today}</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">Rejected Today</div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 mb-4 p-1 bg-[var(--bg-secondary)] rounded-xl w-fit">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-1.5 text-sm rounded-lg transition-all ${
            tab === 'pending'
              ? 'bg-[var(--bg-primary)] shadow-sm font-medium text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          Pending {pendingApprovals.length > 0 && `(${pendingApprovals.length})`}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-1.5 text-sm rounded-lg transition-all ${
            tab === 'history'
              ? 'bg-[var(--bg-primary)] shadow-sm font-medium text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          History
        </button>
      </div>

      <div className="space-y-3">
        {currentList.length === 0 ? (
          <div className="apple-card p-8 text-center">
            <Clock size={24} className="mx-auto text-[var(--text-tertiary)] mb-2" />
            <p className="text-sm text-[var(--text-tertiary)]">
              {tab === 'pending' ? 'No pending approvals' : 'No approval history'}
            </p>
          </div>
        ) : (
          currentList.map((approval) => {
            const isExpanded = expandedId === approval.id;
            return (
              <div key={approval.id} className="apple-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {approval.tool_name}
                      </span>
                      <RiskBadge level={approval.risk_level} />
                      {approval.status !== 'pending' && (
                        <span className={`flex items-center gap-1 text-xs ${
                          approval.status === 'approved' ? 'text-apple-green' : 'text-apple-red'
                        }`}>
                          {approval.status === 'approved' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {approval.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{approval.reason}</p>
                    <div className="text-xs text-[var(--text-tertiary)] mt-1">
                      {new Date(approval.created_at).toLocaleString()}
                    </div>
                  </div>

                  {tab === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => resolveApproval(approval.id, 'approve')}
                        disabled={actionLoading.has(approval.id)}
                        className="apple-button flex items-center gap-1 px-3 py-1.5 text-xs bg-apple-green/10 text-apple-green hover:bg-apple-green/20"
                      >
                        {actionLoading.has(approval.id) ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <CheckCircle size={12} />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => resolveApproval(approval.id, 'reject')}
                        disabled={actionLoading.has(approval.id)}
                        className="apple-button flex items-center gap-1 px-3 py-1.5 text-xs bg-apple-red/10 text-apple-red hover:bg-apple-red/20"
                      >
                        <XCircle size={12} />
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                  className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] mt-2 hover:text-[var(--text-secondary)]"
                >
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {isExpanded ? 'Hide params' : 'Show params'}
                </button>
                {isExpanded && (
                  <pre className="mt-2 p-3 bg-[var(--bg-secondary)] rounded-xl text-xs font-mono overflow-x-auto">
                    {JSON.stringify(approval.params, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
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

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    low: 'bg-apple-green/10 text-apple-green',
    medium: 'bg-apple-orange/10 text-apple-orange',
    high: 'bg-apple-red/10 text-apple-red',
    critical: 'bg-apple-red/20 text-apple-red font-semibold',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${styles[level] ?? 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
      {level === 'critical' && <AlertTriangle size={10} />}
      {level}
    </span>
  );
}
