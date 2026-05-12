import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Webhook, Link2, GitBranch, FileInput, Send, Loader2,
  CheckCircle, XCircle, Terminal, Tag, AlertCircle,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { clipUrl, webhookIngest } from '@/services/dataService';
import { useNotificationStore } from '@/stores/notificationStore';

interface WebhookResult {
  success: boolean;
  message: string;
  stdout?: string;
  stderr?: string;
  saved_file?: string | null;
}

export function WebhookManagerPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('webhooks.title', 'Webhooks'));
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [clipUrlVal, setClipUrlVal] = useState('');
  const [clipTitle, setClipTitle] = useState('');
  const [clipTags, setClipTags] = useState('');
  const [clipLoading, setClipLoading] = useState(false);
  const [clipResult, setClipResult] = useState<WebhookResult | null>(null);

  const [ingestPath, setIngestPath] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState<WebhookResult | null>(null);

  const handleClip = useCallback(async () => {
    if (!clipUrlVal.trim()) return;
    setClipLoading(true);
    setClipResult(null);
    try {
      const data = await clipUrl(
        clipUrlVal.trim(),
        clipTitle.trim(),
        clipTags.split(',').map((s) => s.trim()).filter(Boolean),
      );
      const result: WebhookResult = {
        success: data.success,
        message: data.saved_file ? `Saved to ${data.saved_file}` : 'Clip completed',
        stdout: data.stdout,
        stderr: data.stderr,
        saved_file: data.saved_file,
      };
      setClipResult(result);
      addNotification(result.message, result.success ? 'success' : 'error');
    } catch (e) {
      const result: WebhookResult = { success: false, message: (e as Error).message };
      setClipResult(result);
      addNotification(result.message, 'error');
    } finally {
      setClipLoading(false);
    }
  }, [clipUrlVal, clipTitle, clipTags, addNotification]);

  const handleIngest = useCallback(async () => {
    if (!ingestPath.trim()) return;
    setIngestLoading(true);
    setIngestResult(null);
    try {
      const data = await webhookIngest(ingestPath.trim());
      const result: WebhookResult = {
        success: data.success,
        message: data.success ? 'Ingest triggered' : 'Ingest failed',
        stdout: data.stdout,
        stderr: data.stderr,
      };
      setIngestResult(result);
      addNotification(result.message, result.success ? 'success' : 'error');
    } catch (e) {
      const result: WebhookResult = { success: false, message: (e as Error).message };
      setIngestResult(result);
      addNotification(result.message, 'error');
    } finally {
      setIngestLoading(false);
    }
  }, [ingestPath, addNotification]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center gap-3 mb-8">
        <Webhook size={28} className="text-apple-blue" />
        <h1 className="text-3xl font-semibold">{t('webhooks.title', 'Webhook Manager')}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* URL Clip */}
        <div className="apple-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg text-apple-blue bg-apple-blue/10 flex items-center justify-center">
              <Link2 size={18} />
            </div>
            <div>
              <h2 className="font-medium text-[var(--text-primary)]">{t('webhooks.clip.title', 'Clip URL')}</h2>
              <p className="text-xs text-[var(--text-secondary)]">{t('webhooks.clip.desc', 'Clip a web page via Jina Reader and trigger ingest')}</p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="url"
              value={clipUrlVal}
              onChange={(e) => setClipUrlVal(e.target.value)}
              placeholder={t('webhooks.clip.urlPlaceholder', 'https://example.com/article')}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-apple-blue focus:shadow-[0_0_0_4px_rgba(10,132,255,0.08)] transition-all"
            />
            <input
              type="text"
              value={clipTitle}
              onChange={(e) => setClipTitle(e.target.value)}
              placeholder={t('webhooks.clip.titlePlaceholder', 'Optional title override')}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-apple-blue focus:shadow-[0_0_0_4px_rgba(10,132,255,0.08)] transition-all"
            />
            <div className="relative">
              <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={clipTags}
                onChange={(e) => setClipTags(e.target.value)}
                placeholder={t('webhooks.clip.tagsPlaceholder', 'tag1, tag2, tag3')}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-apple-blue focus:shadow-[0_0_0_4px_rgba(10,132,255,0.08)] transition-all"
              />
            </div>
            <button
              onClick={handleClip}
              disabled={clipLoading || !clipUrlVal.trim()}
              className="apple-button flex items-center justify-center gap-2 w-full disabled:opacity-50"
            >
              {clipLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {clipLoading ? t('webhooks.clip.sending') : t('webhooks.clip.send')}
            </button>
          </div>

          {clipResult && (
            <div className={`mt-3 text-xs rounded-xl p-3 border ${
              clipResult.success
                ? 'bg-apple-green/5 border-apple-green/20'
                : 'bg-apple-red/5 border-apple-red/20'
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                {clipResult.success ? <CheckCircle size={12} className="text-apple-green" /> : <XCircle size={12} className="text-apple-red" />}
                <span className={clipResult.success ? 'text-apple-green' : 'text-apple-red'}>{clipResult.message}</span>
              </div>
              {clipResult.stdout && (
                <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--text-secondary)]">{clipResult.stdout}</pre>
              )}
              {clipResult.stderr && (
                <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] text-apple-red/80">{clipResult.stderr}</pre>
              )}
            </div>
          )}
        </div>

        {/* Direct Ingest */}
        <div className="apple-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg text-apple-green bg-apple-green/10 flex items-center justify-center">
              <FileInput size={18} />
            </div>
            <div>
              <h2 className="font-medium text-[var(--text-primary)]">{t('webhooks.ingest.title', 'Direct Ingest')}</h2>
              <p className="text-xs text-[var(--text-secondary)]">{t('webhooks.ingest.desc', 'Trigger ingest of a raw file by path')}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Terminal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={ingestPath}
                onChange={(e) => setIngestPath(e.target.value)}
                placeholder={t('webhooks.ingest.pathPlaceholder', 'raw/my-file.md')}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-apple-blue focus:shadow-[0_0_0_4px_rgba(10,132,255,0.08)] transition-all"
              />
            </div>
            <button
              onClick={handleIngest}
              disabled={ingestLoading || !ingestPath.trim()}
              className="apple-button flex items-center justify-center gap-2 w-full disabled:opacity-50"
            >
              {ingestLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {ingestLoading ? t('webhooks.ingest.sending') : t('webhooks.ingest.send')}
            </button>
          </div>

          {ingestResult && (
            <div className={`mt-3 text-xs rounded-xl p-3 border ${
              ingestResult.success
                ? 'bg-apple-green/5 border-apple-green/20'
                : 'bg-apple-red/5 border-apple-red/20'
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                {ingestResult.success ? <CheckCircle size={12} className="text-apple-green" /> : <XCircle size={12} className="text-apple-red" />}
                <span className={ingestResult.success ? 'text-apple-green' : 'text-apple-red'}>{ingestResult.message}</span>
              </div>
              {ingestResult.stdout && (
                <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--text-secondary)]">{ingestResult.stdout}</pre>
              )}
              {ingestResult.stderr && (
                <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] text-apple-red/80">{ingestResult.stderr}</pre>
              )}
            </div>
          )}
        </div>

        {/* GitHub Webhook Info */}
        <div className="apple-card p-5 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg text-apple-purple bg-apple-purple/10 flex items-center justify-center">
              <GitBranch size={18} />
            </div>
            <div>
              <h2 className="font-medium text-[var(--text-primary)]">{t('webhooks.github.title', 'GitHub Webhook')}</h2>
              <p className="text-xs text-[var(--text-secondary)]">{t('webhooks.github.desc', 'Configure GitHub push webhook to auto-ingest on push events')}</p>
            </div>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-xs font-mono text-[var(--text-secondary)] space-y-1">
            <p><span className="text-[var(--text-tertiary)]">POST</span> /api/webhook/github</p>
            <p><span className="text-[var(--text-tertiary)]">Headers:</span> X-GitHub-Event: push</p>
            <p><span className="text-[var(--text-tertiary)]">Query:</span> ?token=&lt;WEBHOOK_SECRET&gt;</p>
            <p className="text-[var(--text-tertiary)] mt-2">{t('webhooks.github.note', 'Requires WEBHOOK_SECRET environment variable to be set.')}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
