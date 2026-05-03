import { useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderOpen, Search, ArrowUpDown, Filter, CheckSquare, Square,
  Play, Loader2, X, Eye, Trash2, Clock, Inbox, Upload,
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
  ingestingPaths: Set<string>;
  deletingPaths: Set<string>;
  batchIngesting: boolean;
  hoveredPath: string | null;
  onSearchChange: (value: string) => void;
  onSortModeChange: (mode: 'newest' | 'name' | 'size') => void;
  onFileTypeFilterChange: (filter: FileTypeFilter) => void;
  onToggleSelect: (path: string) => void;
  onToggleSelectAll: () => void;
  onBatchIngest: () => void;
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
      exit={{ opacity: 0, y: -6 }}
      transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.2 }}
      onMouseEnter={() => onHover(file.path)}
      onMouseLeave={() => onHover(null)}
      role="listitem"
      className={`group flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-default ${
        isSelected
          ? 'bg-apple-blue/5 border-l-2 border-l-apple-blue/30'
          : 'hover:bg-[var(--bg-secondary)] border-l-2 border-l-transparent'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggleSelect(file.path)}
        className="shrink-0 text-[var(--text-tertiary)] hover:text-apple-blue transition-colors p-1 rounded-lg hover:bg-[var(--bg-secondary)]"
      >
        {isSelected ? (
          <CheckSquare size={18} className="text-apple-blue" />
        ) : (
          <Square size={18} className={`${isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} />
        )}
      </button>

      {/* File Icon */}
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${getFileTypeBg(file.name)}`}>
        <Icon size={20} className={getFileTypeColor(file.name)} />
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{file.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 font-medium rounded-full shrink-0 ${
            category === 'document' ? 'bg-blue-500/10 text-blue-600' :
            category === 'spreadsheet' ? 'bg-emerald-500/10 text-emerald-600' :
            category === 'code' ? 'bg-amber-500/10 text-amber-600' :
            'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
          }`}>
            {category}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] mt-0.5">
          <span className="font-mono">{formatBytes(file.size)}</span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {formatDate(file.modified)}
          </span>
          <span className="truncate max-w-[200px]">{file.path}</span>
        </div>
      </div>

      {/* Actions - hover reveal */}
      <div className={`flex items-center gap-0.5 shrink-0 transition-opacity duration-200 ${
        isHovered || isSelected ? 'opacity-100' : 'opacity-0'
      }`}>
        <button
          onClick={() => onPreview(file)}
          className="p-2 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          title={t('upload.preview')}
        >
          <Eye size={16} />
        </button>
        <button
          onClick={() => onIngest(file)}
          disabled={isIngesting}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-apple-blue text-white text-xs font-semibold hover:bg-apple-blue/90 transition-colors disabled:opacity-50"
          title={t('upload.ingest')}
        >
          {isIngesting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          <span className="hidden sm:inline">{isIngesting ? t('upload.ingesting') : t('upload.ingest')}</span>
        </button>
        <button
          onClick={() => onDelete(file)}
          disabled={isDeleting}
          className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition-colors disabled:opacity-50"
          title={t('upload.delete')}
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
  ingestingPaths,
  deletingPaths,
  batchIngesting,
  hoveredPath,
  onSearchChange,
  onSortModeChange,
  onFileTypeFilterChange,
  onToggleSelect,
  onToggleSelectAll,
  onBatchIngest,
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

  const filterPills = [
    { key: 'all' as FileTypeFilter, label: t('upload.fileType.all'), count: files.length },
    { key: 'document' as FileTypeFilter, label: t('upload.fileType.document'), count: files.filter((f) => getFileCategory(f.name) === 'document').length },
    { key: 'spreadsheet' as FileTypeFilter, label: t('upload.fileType.spreadsheet'), count: files.filter((f) => getFileCategory(f.name) === 'spreadsheet').length },
    { key: 'code' as FileTypeFilter, label: t('upload.fileType.code') || 'Code', count: files.filter((f) => getFileCategory(f.name) === 'code').length },
    { key: 'other' as FileTypeFilter, label: t('upload.fileType.other'), count: files.filter((f) => getFileCategory(f.name) === 'other').length },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="apple-card p-0 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border-default)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <FolderOpen size={16} className="text-[var(--text-tertiary)]" />
          {t('upload.filesList')}
          <span className="text-xs text-[var(--text-tertiary)] font-normal bg-[var(--bg-secondary)] px-2 py-0.5 rounded-lg">
            {filteredFiles.length}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('action.searchPlaceholder')}
              className="apple-input pl-8 text-xs w-44"
            />
          </div>
          <button
            onClick={() => onSortModeChange(sortMode === 'newest' ? 'name' : sortMode === 'name' ? 'size' : 'newest')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title={t('browse.sort.label')}
          >
            <ArrowUpDown size={13} />
            {sortMode === 'newest' ? t('upload.sort.newest') : sortMode === 'name' ? t('upload.sort.name') : t('upload.sort.size')}
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      {files.length > 0 && (
        <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center gap-2 overflow-x-auto">
          <Filter size={14} className="text-[var(--text-tertiary)] shrink-0" />
          {filterPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => onFileTypeFilterChange(pill.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
                fileTypeFilter === pill.key
                  ? 'bg-apple-blue text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {pill.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                fileTypeFilter === pill.key ? 'bg-white/20' : 'bg-[var(--bg-primary)]'
              }`}>
                {pill.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Batch Actions Bar */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={false}
            animate={{ height: 'auto', opacity: 1 }}
            className="px-5 py-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/50"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleSelectAll}
                className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg px-2 py-1"
              >
                {isAllSelected ? <CheckSquare size={16} className="text-apple-blue" /> : <Square size={16} />}
                <span className="font-medium">{isAllSelected ? t('upload.deselectAll') : t('upload.selectAll')}</span>
              </button>
              <AnimatePresence>
                {selectedPaths.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-3"
                  >
                    <div className="h-4 w-px bg-[var(--border-default)]" />
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {t('upload.selected', { count: selectedPaths.size })}
                    </span>
                    <button
                      onClick={onBatchIngest}
                      disabled={batchIngesting}
                      className="apple-button flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      {batchIngesting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                      {t('upload.ingestSelected', { count: selectedPaths.size })}
                    </button>
                    <button
                      onClick={onClearSelection}
                      className="text-xs text-[var(--text-tertiary)] hover:text-red-500 transition-colors rounded-lg p-1"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File List Content */}
      <div className="p-2" role="list" aria-label={t('upload.filesList')}>
        {loadingFiles ? (
          <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] py-16 justify-center">
            <Loader2 size={18} className="animate-spin text-apple-blue" />
            {t('upload.loading')}
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-16">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--bg-secondary)] mb-5"
            >
              <Inbox size={36} className="text-[var(--text-tertiary)]" />
            </motion.div>
            <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-1">{t('upload.empty.title')}</h3>
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
          <div className="text-center py-12">
            <Search size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-tertiary)]">{t('browse.empty.title')}</p>
            <button
              onClick={() => { onSearchChange(''); onFileTypeFilterChange('all'); }}
              className="text-xs text-apple-blue hover:underline mt-2"
            >
              {t('browse.empty.noResults.clearFilters')}
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredFiles.map((file, index) => (
              <FileListItem
                key={file.path}
                file={file}
                index={index}
                isSelected={selectedPaths.has(file.path)}
                isIngesting={ingestingPaths.has(file.path)}
                isDeleting={deletingPaths.has(file.path)}
                isHovered={hoveredPath === file.path}
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
    </motion.div>
  );
}
