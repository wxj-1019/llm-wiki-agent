import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, CloudUpload } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  dragActive: boolean;
  uploading: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function UploadZone({ dragActive, uploading, onDrag, onDrop, onFileInput }: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="apple-card p-0 overflow-hidden"
    >
      <div className="p-5 border-b border-[var(--border-default)]">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <CloudUpload size={16} className="text-apple-blue" />
          {t('upload.recentUploads')}
        </h2>
      </div>
      <div className="p-5">
        <div
          onDragEnter={onDrag}
          onDragOver={onDrag}
          onDragLeave={onDrag}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (!uploading && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={t('upload.dropHint')}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all relative overflow-hidden ${
            dragActive
              ? 'border-apple-blue bg-apple-blue/5 scale-[1.01]'
              : uploading
              ? 'opacity-50 cursor-not-allowed border-[var(--border-default)]'
              : 'border-[var(--border-default)] hover:border-apple-blue/40 hover:bg-apple-blue/[0.02] hover:scale-[1.01]'
          }`}
        >
          <motion.div
            animate={dragActive ? { scale: 1.15, y: -8 } : { scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <Upload size={40} className={`mx-auto mb-3 ${dragActive ? 'text-apple-blue' : 'text-[var(--text-tertiary)]'}`} />
          </motion.div>
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            {dragActive ? t('upload.dragActive') : t('upload.dropHint')}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-2 max-w-xs mx-auto leading-relaxed">
            {t('upload.dragFormatHint')}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onFileInput}
          accept=".md,.txt,.pdf,.docx,.pptx,.xlsx,.html,.csv,.json,.xml,.rst,.rtf,.epub,.ipynb,.yaml,.yml,.tsv,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg"
        />
      </div>
    </motion.div>
  );
}
