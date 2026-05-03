import { useTranslation } from 'react-i18next';
import { FileText, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  pasteTitle: string;
  pasteContent: string;
  savingText: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSave: () => void;
}

export function PasteTextPanel({
  pasteTitle,
  pasteContent,
  savingText,
  onTitleChange,
  onContentChange,
  onSave,
}: Props) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="apple-card p-0 overflow-hidden"
    >
      <div className="p-5 border-b border-[var(--border-default)]">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <FileText size={16} className="text-apple-blue" />
          {t('upload.pasteTitle')}
        </h2>
      </div>
      <div className="p-5 space-y-3">
        <input
          value={pasteTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t('upload.titlePlaceholder')}
          className="apple-input w-full"
        />
        <textarea
          value={pasteContent}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={t('upload.pastePlaceholder')}
          rows={5}
          className="apple-input w-full resize-none font-mono text-sm"
        />
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
  );
}
