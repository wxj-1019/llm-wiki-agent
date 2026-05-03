import { useTranslation } from 'react-i18next';
import { Eye, X, ClipboardCopy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';

interface Props {
  previewContent: string | null;
  previewName: string;
  onClose: () => void;
  onCopy: () => void;
}

export function PreviewPanel({ previewContent, previewName, onClose, onCopy }: Props) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {previewContent !== null && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="apple-card p-0 mb-8 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
            <div className="flex items-center gap-3 min-w-0">
              <Eye size={16} className="text-apple-blue shrink-0" />
              <h2 className="text-sm font-semibold truncate">{previewName}</h2>
              <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-lg shrink-0">
                {t('upload.preview.rawContent')}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {previewContent && (
                <button
                  onClick={onCopy}
                  className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  title={t('upload.copyContent')}
                >
                  <ClipboardCopy size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                title={t('upload.preview.close')}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-5">
            <MarkdownRenderer content={previewContent} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
