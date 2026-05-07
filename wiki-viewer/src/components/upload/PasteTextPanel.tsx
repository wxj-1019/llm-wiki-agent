import { useTranslation } from 'react-i18next';
import { FileText, Loader2, Link2, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  pasteTitle: string;
  pasteContent: string;
  savingText: boolean;
  fetchUrl: string;
  fetchName: string;
  fetchingUrl: boolean;
  fetchResult: { saved: string | null; quality: string | null } | null;
  activeTab: 'paste' | 'url';
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSave: () => void;
  onFetchUrl: () => void;
  onFetchUrlChange: (value: string) => void;
  onFetchNameChange: (value: string) => void;
  onTabChange: (tab: 'paste' | 'url') => void;
}

export function PasteTextPanel({
  pasteTitle,
  pasteContent,
  savingText,
  fetchUrl,
  fetchName,
  fetchingUrl,
  fetchResult,
  activeTab,
  onTitleChange,
  onContentChange,
  onSave,
  onFetchUrl,
  onFetchUrlChange,
  onFetchNameChange,
  onTabChange,
}: Props) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="apple-card p-0 overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1.5 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/40">
        <button
          onClick={() => onTabChange('paste')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'paste'
              ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <FileText size={15} />
          {t('upload.pasteTitle')}
        </button>
        <button
          onClick={() => onTabChange('url')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'url'
              ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <Globe size={15} />
          {t('upload.fetchFromUrl')}
        </button>
      </div>

      <div className="p-5">
        {activeTab === 'paste' ? (
          <motion.div
            key="paste"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <label htmlFor="paste-title" className="sr-only">
              {t('upload.titlePlaceholder')}
            </label>
            <input
              id="paste-title"
              value={pasteTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={t('upload.titlePlaceholder')}
              className="apple-input w-full"
            />
            <label htmlFor="paste-content" className="sr-only">
              {t('upload.pastePlaceholder')}
            </label>
            <textarea
              id="paste-content"
              value={pasteContent}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder={t('upload.pastePlaceholder')}
              rows={5}
              className="apple-input w-full resize-none font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-tertiary)]">
                {pasteContent.length > 0 && `${pasteContent.length} ${t('common.characters') || 'characters'}`}
              </span>
              <button
                onClick={onSave}
                disabled={savingText || !pasteTitle.trim() || !pasteContent.trim()}
                className="apple-button text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingText ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {t('upload.saveText')}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="url"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-apple-blue/10 flex items-center justify-center shrink-0 mt-0.5">
                <Link2 size={18} className="text-apple-blue" />
              </div>
              <div className="flex-1 space-y-3">
                <input
                  type="url"
                  placeholder="https://example.com/article"
                  value={fetchUrl}
                  onChange={(e) => onFetchUrlChange(e.target.value)}
                  className="apple-input w-full"
                  disabled={fetchingUrl}
                />
                <input
                  type="text"
                  placeholder={t('upload.fetchNamePlaceholder')}
                  value={fetchName}
                  onChange={(e) => onFetchNameChange(e.target.value)}
                  className="apple-input w-full"
                  disabled={fetchingUrl}
                />
                <button
                  onClick={onFetchUrl}
                  disabled={fetchingUrl || !fetchUrl.trim()}
                  className="apple-button w-full sm:w-auto flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  {fetchingUrl ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  {fetchingUrl ? t('upload.fetching') : t('upload.fetch')}
                </button>
              </div>
            </div>

            {fetchResult && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-apple-green/10 border border-apple-green/30 rounded-xl px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2 text-apple-green font-medium mb-1">
                  <FileText size={14} />
                  <span>{t('upload.fetchSuccess')}</span>
                </div>
                <div className="text-[var(--text-secondary)]">
                  <p className="font-mono text-xs">{fetchResult.saved}</p>
                  {fetchResult.quality && (
                    <p className="mt-1 text-xs">{t('upload.quality', { quality: fetchResult.quality })}</p>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
