import { useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderOpen, Search, ArrowUpDown, Filter, CheckSquare, Square,
  Play, Loader2, X, Eye, Trash2, Clock, Inbox, Upload, CheckCircle2,
  FileCheck, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RawFile } from '@/services/dataService';
import {
  formatBytes, formatDate, getFileIcon, getFileCategory,
  getFileTypeColor, getFileTypeBg, type FileTypeFilter,
} from '@/lib/fileUtils';

interface Props {
  files: RawFile[];
  filteredFiles: RawFile[];
  loadingFiles: boolean;
  selectedPaths: Set<string>;
  searchQuery: string;
  sortMode: 'newest' | 'name' | 'size';
  fileTypeFilter: FileTypeFilter;
  showUningestedOnly: boolean;
  ingestingPaths: Set<string>;
  deletingPaths: Set<string>;
  batchIngesting: boolean;
  batchDeleting: boolean;
  hoveredPath: string | null;
  onSearchChange: (value: string) => void;
  onSortModeChange: (mode: 'newest' | 'name' | 'size') => void;
  onFileTypeFilterChange: (filter: FileTypeFilter) => void;
  onToggleUningested: () => void;
  onToggleSelect: (path: string) => void;
  onToggleSelectAll: () => void;
  onBatchIngest: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
  onPreview: (file: RawFile) => void;
  onIngest: (file: RawFile) => void;
  onDelete: (file: RawFile) => void;
  onHover: (path: string | null) => void;
  onTriggerFileInput: () => void;
}

const FileListItem = memo(function FileListItem({
  file,
  index,
  isSelected,
  isIngesting,
  isDeleting,
  isHovered,
  isIngested,
  onToggleSelect,
  onPreview,
  onIngest,
  onDelete,
  onHover,
}: {
  file: RawFile;
  index: number;
  isSelected: boolean;
  isIngesting: boolean;
  isDeleting: boolean;
  isHovered: boolean;
  isIngested: boolean;
  onToggleSelect: (path: string) => void;
  onPreview: (file: RawFile) => void;
  onIngest: (file: RawFile) => void;
  onDelete: (file: RawFile) => void;
  onHover: (path: string | null) => void;
}) {
  const { t } = useTranslation();
  const Icon = getFileIcon(file.name);
  const category = getFileCategory(file.name);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ delay: Math.min(index * 0.015, 0.2), duration: 0.2 }}
      onMouseEnter={() => onHover(file.path)}
      onMouseLeave={() => onHover(null)}
      role="listitem"
      className={`group flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 cursor-default border ${
        isSelected
          ? 'bg-apple-blue/5 border-apple-blue/20 shadow-sm'
          : 'bg-transparent border-transparent hover:bg-[var(--bg-secondary)] hover:border-[var(--border-subtle)]'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggleSelect(file.path)}
        role="checkbox"
        aria-checked={isSelected}
        className="shrink-0 text-[var(--text-tertiary)] hover:text-apple-blue transition-colors p-2 rounded-xl hover:bg-[var(--bg-primary)]"
      >
        {isSelected ? (
          <CheckSquare size={18} className="text-apple-blue" />
        ) : (
          <Square
            size={18}
            className={`${
              isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            } transition-opacity`}
          />
        )}
      </button>

      {/* File Icon */}
      <div
        className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${getFileTypeBg(
          file.name
        )}`}
      >
        <Icon size={20} className={getFileTypeColor(file.name)} />
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {file.name}
          </span>
          {isIngested && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 font-semibold rounded-full shrink-0 bg-apple-green/10 text-apple-green"
              title={t('upload.ingested')}
            >
              <FileCheck size={10} />
              {t('upload.ingested')}
            </span>
          )}
          <span
            className={`text-[10px] px-2 py-0.5 font-medium rounded-full shrink-0 ${
              category === 'document'
                ? 'bg-blue-500/10 text-blue-600'
                : category === 'spreadsheet'
                ? 'bg-emerald-500/10 text-emerald-600'
                : category === 'code'
                ? 'bg-amber-500/10 text-amber-600'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
            }`}
          >
            {category}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] mt-0.5">
          <span className="font-mono tabular-nums">{formatBytes(file.size)}</span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {formatDate(file.modified)}
          </span>
          <span className="truncate max-w-[180px] hidden sm:inline">{file.path}</span>
        </div>
      </div>

      {/* Actions — always visible on mobile, hover-only on desktop */}
      <div
        className={`flex items-center gap-1 shrink-0 transition-opacity duration-200 ${
          isHovered || isSelected
            ? 'opacity-100'
            : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
        }`}
      >
        <button
          onClick={() => onPreview(file)}
          className="p-2.5 rounded-xl hover:bg-[var(--bg-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
          title={t('upload.preview')}
          aria-label={t('upload.preview')}
        >
          <Eye size={16} />
        </button>
        <button
          onClick={() => onIngest(file)}
          disabled={isIngesting}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-apple-blue text-white text-xs font-semibold hover:bg-apple-blue-hover transition-all disabled:opacity-50 shadow-sm shadow-apple-blue/20 hover:shadow-md hover:shadow-apple-blue/30"
          title={t('upload.ingest')}
        >
          {isIngesting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          <span className="hidden sm:inline">{isIngesting ? t('upload.ingesting') : t('upload.ingest')}</span>
        </button>
        <button
          onClick={() => onDelete(file)}
          disabled={isDeleting}
          className="p-2.5 rounded-xl hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition-colors disabled:opacity-50 min-w-[40px] min-h-[40px] flex items-center justify-center"
          title={t('upload.delete')}
          aria-label={t('upload.delete')}
        >
          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </motion.div>
  );
});

export function FileList({
  files,
  filteredFiles,
  loadingFiles,
  selectedPaths,
  searchQuery,
  sortMode,
  fileTypeFilter,
  showUningestedOnly,
  ingestingPaths,
  deletingPaths,
  batchIngesting,
  batchDeleting,
  hoveredPath,
  onSearchChange,
  onSortModeChange,
  onFileTypeFilterChange,
  onToggleUningested,
  onToggleSelect,
  onToggleSelectAll,
  onBatchIngest,
  onBatchDelete,
  onClearSelection,
  onPreview,
  onIngest,
  onDelete,
  onHover,
  onTriggerFileInput,
}: Props) {
  const { t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isAllSelected = filteredFiles.length > 0 && selectedPaths.size === filteredFiles.length;
  const hasSelection = selectedPaths.size > 0;
  const uningestedCount = files.filter((f) => !f.ingested).length;

  const filterPills = [
    { key: 'all' as FileTypeFilter, label: t('upload.fileType.all'), count: files.length },
    { key: 'document' as FileTypeFilter, label: t('upload.fileType.document'), count: files.filter((f) => getFileCategory(f.name) === 'document').length },
    { key: 'spreadsheet' as FileTypeFilter, label: t('upload.fileType.spreadsheet'), count: files.filter((f) => getFileCategory(f.name) === 'spreadsheet').length },
    { key: 'code' as FileTypeFilter, label: t('upload.fileType.code') || 'Code', count: files.filter((f) => getFileCategory(f.name) === 'code').length },
    { key: 'other' as FileTypeFilter, label: t('upload.fileType.other'), count: files.filter((f) => getFileCategory(f.name) === 'other').length },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="apple-card p-0 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border-default)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-center">
            <FolderOpen size={16} className="text-[var(--text-tertiary)]" />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">{t('upload.filesList')}</h2>
            <p className="text-xs text-[var(--text-tertiary)]">
              {t('upload.stats.totalFiles')}: <span className="font-mono text-[var(--text-secondary)]">{files.length}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('action.searchPlaceholder')}
              aria-label={t('action.searchPlaceholder')}
              className="apple-input pl-9 text-sm w-full sm:w-52"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => onSortModeChange(sortMode === 'newest' ? 'name' : sortMode === 'name' ? 'size' : 'newest')}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--border-strong)] transition-colors shrink-0"
            title={t('browse.sort.label')}
          >
            <ArrowUpDown size={13} />
            <span className="hidden sm:inline">
              {sortMode === 'newest' ? t('upload.sort.newest') : sortMode === 'name' ? t('upload.sort.name') : t('upload.sort.size')}
            </span>
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      {files.length > 0 && (
        <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <Filter size={14} className="text-[var(--text-tertiary)] shrink-0" />
          {filterPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => onFileTypeFilterChange(pill.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
                fileTypeFilter === pill.key && !showUningestedOnly
                  ? 'bg-apple-blue text-white shadow-sm shadow-apple-blue/20'
                  : 'bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--border-strong)]'
              }`}
            >
              {pill.label}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  fileTypeFilter === pill.key && !showUningestedOnly ? 'bg-white/20' : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]'
                }`}
              >
                {pill.count}
              </span>
            </button>
          ))}
          <div className="w-px h-4 bg-[var(--border-default)] mx-1" />
          <button
            onClick={onToggleUningested}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
              showUningestedOnly
                ? 'bg-apple-orange text-white shadow-sm shadow-apple-orange/20'
                : 'bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--border-strong)]'
            }`}
            title={t('upload.showUningested') || '只显示未摄取的文件'}
          >
            <AlertCircle size={12} />
            <span>{t('upload.uningested') || '未摄取'}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                showUningestedOnly ? 'bg-white/20' : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]'
              }`}
            >
              {uningestedCount}
            </span>
          </button>
        </div>
      )}

      {/* Select-all bar (subtle, always visible when files exist) */}
      {files.length > 0 && (
        <div className="px-5 py-2.5 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/40 flex items-center justify-between">
          <button
            onClick={onToggleSelectAll}
            className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg px-2 py-1.5 hover:bg-[var(--bg-primary)]"
          >
            {isAllSelected ? (
              <CheckSquare size={16} className="text-apple-blue" />
            ) : (
              <Square size={16} />
            )}
            <span className="font-medium">
              {isAllSelected ? t('upload.deselectAll') : t('upload.selectAll')}
            </span>
          </button>

          <AnimatePresence>
            {hasSelection && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="text-xs text-apple-blue font-medium bg-apple-blue/10 px-2.5 py-1 rounded-full"
              >
                {t('upload.selected', { count: selectedPaths.size })}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* File List Content */}
      <div className="p-2 pb-4" role="list" aria-label={t('upload.filesList')}>
        {loadingFiles ? (
          <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] py-20 justify-center">
            <Loader2 size={18} className="animate-spin text-apple-blue" />
            {t('upload.loading')}
          </div>
        ) : files.length === 0 ? (
          <div className="empty-state-warm m-2">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] mb-4"
            >
              <Inbox size={28} className="text-[var(--text-tertiary)]" />
            </motion.div>
            <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-1">
              {t('upload.empty.title')}
            </h3>
            <p className="text-sm text-[var(--text-tertiary)] max-w-sm mx-auto leading-relaxed mb-4">
              {t('upload.empty.description')}
            </p>
            <button
              onClick={onTriggerFileInput}
              className="apple-button text-sm inline-flex items-center gap-2"
            >
              <Upload size={14} />
              {t('upload.dropHint')}
            </button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-16">
            <Search size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-tertiary)]">{t('browse.empty.title')}</p>
            <button
              onClick={() => {
                onSearchChange('');
                onFileTypeFilterChange('all');
                if (showUningestedOnly) onToggleUningested();
              }}
              className="text-xs text-apple-blue hover:underline mt-2"
            >
              {t('browse.empty.noResults.clearFilters')}
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredFiles.map((file, index) => (
              <FileListItem
                key={file.path}
                file={file}
                index={index}
                isSelected={selectedPaths.has(file.path)}
                isIngesting={ingestingPaths.has(file.path)}
                isDeleting={deletingPaths.has(file.path)}
                isHovered={hoveredPath === file.path}
                isIngested={!!file.ingested}
                onToggleSelect={onToggleSelect}
                onPreview={onPreview}
                onIngest={onIngest}
                onDelete={onDelete}
                onHover={onHover}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Batch Action Bar */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="sticky bottom-3 mx-3 mb-3"
          >
            <div className="glass rounded-2xl p-3 shadow-xl shadow-black/10 flex items-center justify-between gap-3 border border-[var(--border-strong)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-apple-blue/10 flex items-center justify-center shrink-0">
                  <CheckSquare size={14} className="text-apple-blue" />
                </div>
                <span className="text-sm font-medium truncate">
                  {t('upload.selected', { count: selectedPaths.size })}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onBatchIngest}
                  disabled={batchIngesting}
                  className="apple-button flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
                >
                  {batchIngesting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  {t('upload.ingestSelected', { count: selectedPaths.size })}
                </button>
                <button
                  onClick={onBatchDelete}
                  disabled={batchDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full transition-colors disabled:opacity-50 font-medium"
                >
                  {batchDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {t('upload.batchDelete', { count: selectedPaths.size })}
                </button>
                <button
                  onClick={onClearSelection}
                  className="p-2 text-[var(--text-tertiary)] hover:text-red-500 transition-colors rounded-xl hover:bg-red-500/10"
                  title={t('common.close')}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
