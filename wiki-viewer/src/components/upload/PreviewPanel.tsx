import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, X, ClipboardCopy, FileText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface Props {
  previewContent: string | null;
  previewName: string;
  isLoading: boolean;
  onClose: () => void;
  onCopy: () => void;
}

export function PreviewPanel({ previewContent, previewName, isLoading, onClose, onCopy }: Props) {
  const { t } = useTranslation();
  const isOpen = previewContent !== null || isLoading;
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  useBodyScrollLock(isOpen);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg-primary)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-[var(--border-default)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-apple-blue/10 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-apple-blue" />
                </div>
                <div className="min-w-0">
                  <h2 id="preview-title" className="text-sm font-semibold truncate">
                    {previewName}
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] mt-0.5">
                    <span className="flex items-center gap-1">
                      <Eye size={11} />
                      {t('upload.preview.rawContent')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!isLoading && (
                  <button
                    onClick={onCopy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    title={t('upload.copyContent')}
                  >
                    <ClipboardCopy size={14} />
                    <span className="hidden sm:inline">{t('common.copy')}</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                  title={t('upload.preview.close')}
                  aria-label={t('common.close')}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 relative">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={28} className="animate-spin text-apple-blue" />
                  <p className="text-sm text-[var(--text-secondary)]">{t('upload.loading')}</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <MarkdownRenderer content={previewContent || ''} />
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]/40 shrink-0">
              <p className="text-xs text-[var(--text-tertiary)] text-center">
                {t('upload.preview.closeHint') || '按 Esc 或点击背景关闭'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
