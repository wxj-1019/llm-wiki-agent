import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, FileText, FileImage, FileSpreadsheet, FileCode } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  dragActive: boolean;
  uploading: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const fileTypeIcons = [
  { Icon: FileText, label: 'Document' },
  { Icon: FileImage, label: 'Image' },
  { Icon: FileSpreadsheet, label: 'Spreadsheet' },
  { Icon: FileCode, label: 'Code' },
];

export function UploadZone({ dragActive, uploading, onDrag, onDrop, onFileInput }: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
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
        className={`relative border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-300 overflow-hidden ${
          dragActive
            ? 'border-apple-blue bg-apple-blue/5 scale-[1.01] shadow-lg shadow-apple-blue/10'
            : uploading
            ? 'opacity-60 cursor-not-allowed border-[var(--border-default)]'
            : 'border-[var(--border-strong)] hover:border-apple-blue/50 hover:bg-apple-blue/[0.02] hover:shadow-md hover:shadow-black/5'
        }`}
      >
        {/* Ambient background on drag */}
        {dragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-apple-blue/5 pointer-events-none"
          />
        )}

        <motion.div
          animate={dragActive ? { scale: 1.15, y: -8 } : { scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className="relative z-10"
        >
          <div
            className={`mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
              dragActive ? 'bg-apple-blue/15' : 'bg-[var(--bg-secondary)]'
            }`}
          >
            <CloudUpload
              size={32}
              className={dragActive ? 'text-apple-blue' : 'text-[var(--text-tertiary)]'}
            />
          </div>
        </motion.div>

        <div className="relative z-10">
          <p
            className={`text-base sm:text-lg font-semibold mb-1 transition-colors duration-200 ${
              dragActive ? 'text-apple-blue' : 'text-[var(--text-primary)]'
            }`}
          >
            {dragActive ? t('upload.dragActive') : t('upload.dropHint')}
          </p>
          <p className="text-sm text-[var(--text-tertiary)] max-w-md mx-auto leading-relaxed">
            {t('upload.dragFormatHint')}
          </p>

          {/* Supported format icons — subtle hint */}
          {!dragActive && !uploading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex items-center justify-center gap-2.5 mt-5"
            >
              {fileTypeIcons.map(({ Icon, label }, i) => (
                <div
                  key={i}
                  title={label}
                  className="w-9 h-9 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-apple-blue hover:border-apple-blue/30 transition-colors"
                >
                  <Icon size={15} />
                </div>
              ))}
            </motion.div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          // @ts-expect-error webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          className="hidden"
          onChange={onFileInput}
          accept=".md,.txt,.pdf,.docx,.pptx,.xlsx,.html,.csv,.json,.xml,.rst,.rtf,.epub,.ipynb,.yaml,.yml,.tsv,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg"
        />
      </div>
    </motion.div>
  );
}
