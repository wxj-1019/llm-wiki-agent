import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload, FileText, Eye, Play, Loader2, AlertCircle, CheckCircle,
  Trash2, CheckSquare, Square, Search, FileType, FileSpreadsheet,
  FileCode, File, Filter, ArrowUpDown, X, FolderOpen, ClipboardCopy,
  CloudUpload, Clock, HardDrive, Inbox, ArrowUp, ArrowDown,
  FileArchive, FileImage
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchRawFiles, uploadFile, uploadText, triggerIngest,
  fetchRawFileContent, deleteRawFile
} from '@/services/dataService';
import type { RawFile, UploadResult, IngestResult } from '@/services/dataService';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCountUp } from '@/hooks/useCountUp';
import { useWikiStore } from '@/stores/wikiStore';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; message: string; type: ToastType }
type SortMode = 'newest' | 'name' | 'size';
type FileTypeFilter = 'all' | 'document' | 'spreadsheet' | 'code' | 'other';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) return FileSpreadsheet;
  if (['json', 'yaml', 'yml', 'xml', 'html', 'htm', 'ipynb'].includes(ext)) return FileCode;
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return FileArchive;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return FileImage;
  if (['pdf', 'docx', 'pptx', 'rtf', 'epub', 'rst'].includes(ext)) return FileType;
  return FileText;
}

function getFileCategory(name: string): FileTypeFilter {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['md', 'txt', 'pdf', 'docx', 'pptx', 'rtf', 'epub', 'rst'].includes(ext)) return 'document';
  if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) return 'spreadsheet';
  if (['json', 'yaml', 'yml', 'xml', 'html', 'htm', 'ipynb'].includes(ext)) return 'code';
  return 'other';
}

function getFileTypeColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'text-red-500';
  if (['docx', 'doc'].includes(ext)) return 'text-blue-500';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'text-emerald-500';
  if (['md', 'txt'].includes(ext)) return 'text-apple-blue';
  if (['json', 'yaml', 'yml'].includes(ext)) return 'text-amber-500';
  if (['zip', 'tar', 'gz'].includes(ext)) return 'text-violet-500';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'text-pink-500';
  return 'text-[var(--text-tertiary)]';
}

function getFileTypeBg(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'bg-red-500/8';
  if (['docx', 'doc'].includes(ext)) return 'bg-blue-500/8';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'bg-emerald-500/8';
  if (['md', 'txt'].includes(ext)) return 'bg-apple-blue/8';
  if (['json', 'yaml', 'yml'].includes(ext)) return 'bg-amber-500/8';
  if (['zip', 'tar', 'gz'].includes(ext)) return 'bg-violet-500/8';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'bg-pink-500/8';
  return 'bg-[var(--bg-tertiary)]';
}

export function UploadPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('upload.title'));
  const refreshGraphData = useWikiStore((s) => s.refreshGraphData);

  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<RawFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [savingText, setSavingText] = useState(false);

  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');

  const [ingestingPaths, setIngestingPaths] = useState<Set<string>>(new Set());
  const [deletingPaths, setDeletingPaths] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
  const [batchIngesting, setBatchIngesting] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach(clearTimeout);
      toastTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimersRef.current.delete(timer);
    }, 4000);
    toastTimersRef.current.add(timer);
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      setLoadingFiles(true);
      const data = await fetchRawFiles();
      setFiles(data);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setLoadingFiles(false);
    }
  }, [showToast]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const stats = useMemo(() => {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    return { totalFiles: files.length, totalSize };
  }, [files]);

  const animatedTotalFiles = useCountUp(stats.totalFiles);
  const animatedTotalSize = useCountUp(Math.round(stats.totalSize / 1024));

  const filteredFiles = useMemo(() => {
    let result = files;
    if (fileTypeFilter !== 'all') {
      result = result.filter((f) => getFileCategory(f.name) === fileTypeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      if (sortMode === 'newest') return b.modified - a.modified;
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      return b.size - a.size;
    });
    return result;
  }, [files, fileTypeFilter, searchQuery, sortMode]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const doUploadFiles = useCallback(async (fileList: File[]) => {
    setUploading(true);
    setUploadProgress({ current: 0, total: fileList.length });
    for (let i = 0; i < fileList.length; i++) {
      setUploadProgress({ current: i, total: fileList.length });
      try {
        const result: UploadResult = await uploadFile(fileList[i]);
        showToast(t('upload.success.upload', { path: result.path }), 'success');
      } catch (err) {
        showToast(String(err), 'error');
      }
    }
    setUploadProgress({ current: fileList.length, total: fileList.length });
    setTimeout(() => {
      setUploadProgress(null);
      setUploading(false);
    }, 400);
    await loadFiles();
  }, [loadFiles, showToast, t]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files;
    if (!dropped || dropped.length === 0) return;
    await doUploadFiles(Array.from(dropped));
  }, [doUploadFiles]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    await doUploadFiles(Array.from(selected));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [doUploadFiles]);

  const handleSaveText = useCallback(async () => {
    if (!pasteTitle.trim() || !pasteContent.trim()) {
      showToast(t('upload.error.required'), 'error');
      return;
    }
    try {
      setSavingText(true);
      const result: UploadResult = await uploadText(pasteTitle, pasteContent);
      showToast(t('upload.success.upload', { path: result.path }), 'success');
      setPasteTitle('');
      setPasteContent('');
      await loadFiles();
    } catch (err) {
      showToast(String(err), 'error');
    } finally {
      setSavingText(false);
    }
  }, [pasteTitle, pasteContent, loadFiles, showToast, t]);

  const handlePreview = useCallback(async (file: RawFile) => {
    if (file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.txt')) {
      try {
        const text = await fetchRawFileContent(file.path);
        setPreviewContent(text);
        setPreviewName(file.name);
        return;
      } catch { /* fallback */ }
    }
    setPreviewContent(
      `# ${file.name}\n\n- **${t('upload.preview.path')}**: ${file.path}\n- **${t('upload.preview.size')}**: ${formatBytes(file.size)}\n- **${t('upload.preview.type')}**: ${t('upload.preview.binaryDesc')}`
    );
    setPreviewName(file.name);
  }, [t]);

  const handleIngest = useCallback(async (file: RawFile) => {
    try {
      setIngestingPaths((prev) => new Set(prev).add(file.path));
      const result: IngestResult = await triggerIngest(file.path);
      if (result.success) {
        showToast(t('upload.success.ingest'), 'success');
        refreshGraphData();
      } else {
        showToast(t('upload.error.ingest'), 'error');
      }
    } catch (err) {
      showToast(String(err), 'error');
    } finally {
      setIngestingPaths((prev) => { const n = new Set(prev); n.delete(file.path); return n; });
    }
  }, [showToast, t, refreshGraphData]);

  const handleDelete = useCallback(async (file: RawFile) => {
    if (!confirm(t('upload.deleteConfirm'))) return;
    try {
      setDeletingPaths((prev) => new Set(prev).add(file.path));
      await deleteRawFile(file.path);
      showToast(t('upload.delete') + ': ' + file.name, 'success');
      setSelectedPaths((prev) => { const n = new Set(prev); n.delete(file.path); return n; });
      await loadFiles();
    } catch (err) {
      showToast(String(err), 'error');
    } finally {
      setDeletingPaths((prev) => { const n = new Set(prev); n.delete(file.path); return n; });
    }
  }, [showToast, t, loadFiles]);

  const handleBatchIngest = useCallback(async () => {
    if (selectedPaths.size === 0) {
      showToast(t('upload.nothingSelected'), 'error');
      return;
    }
    setBatchIngesting(true);
    let successCount = 0;
    for (const path of selectedPaths) {
      try {
        const result = await triggerIngest(path);
        if (result.success) successCount++;
      } catch { /* continue */ }
    }
    showToast(t('upload.success.ingest') + ` (${successCount}/${selectedPaths.size})`, successCount > 0 ? 'success' : 'error');
    setSelectedPaths(new Set());
    setBatchIngesting(false);
    refreshGraphData();
  }, [selectedPaths, showToast, t, refreshGraphData]);

  const toggleSelect = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const n = new Set(prev);
      if (n.has(path)) n.delete(path); else n.add(path);
      return n;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedPaths.size === filteredFiles.length && filteredFiles.length > 0) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filteredFiles.map((f) => f.path)));
    }
  }, [selectedPaths.size, filteredFiles]);

  const isAllSelected = filteredFiles.length > 0 && selectedPaths.size === filteredFiles.length;

  const filterPills: { key: FileTypeFilter; label: string; count: number }[] = useMemo(() => [
    { key: 'all', label: t('upload.fileType.all'), count: files.length },
    { key: 'document', label: t('upload.fileType.document'), count: files.filter((f) => getFileCategory(f.name) === 'document').length },
    { key: 'spreadsheet', label: t('upload.fileType.spreadsheet'), count: files.filter((f) => getFileCategory(f.name) === 'spreadsheet').length },
    { key: 'code', label: t('upload.fileType.code') || 'Code', count: files.filter((f) => getFileCategory(f.name) === 'code').length },
    { key: 'other', label: t('upload.fileType.other'), count: files.filter((f) => getFileCategory(f.name) === 'other').length },
  ], [files, t]);

  const uploadPercent = uploadProgress ? (uploadProgress.current / uploadProgress.total) * 100 : 0;

  return (
    <div className="pb-12">
      {/* Global Drag Overlay */}
      <AnimatePresence>
        {dragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className="fixed inset-0 z-[100] bg-apple-blue/10 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--bg-primary)] border-2 border-dashed border-apple-blue rounded-3xl p-16 text-center shadow-2xl"
            >
              <CloudUpload size={64} className="mx-auto mb-4 text-apple-blue" />
              <p className="text-xl font-semibold text-apple-blue">{t('upload.dragActive')}</p>
              <p className="text-sm text-[var(--text-tertiary)] mt-2">{t('upload.dragFormatHint')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notifications */}
      <div className="fixed top-20 right-6 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium backdrop-blur-sm ${
                toast.type === 'success'
                  ? 'bg-apple-green/10 text-apple-green border border-apple-green/20'
                  : toast.type === 'error'
                  ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                  : 'bg-[var(--bg-secondary)]/90 text-[var(--text-primary)] border border-[var(--border-default)]'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle size={16} /> : toast.type === 'error' ? <AlertCircle size={16} /> : <Eye size={16} />}
              <span className="max-w-xs">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t('upload.title')}</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">{t('upload.dragFormatHint')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: t('upload.stats.totalFiles'), value: animatedTotalFiles, icon: FolderOpen, color: 'text-apple-blue', bg: 'bg-apple-blue/8', suffix: '' },
          { label: t('upload.stats.totalSize'), value: formatBytes(stats.totalSize), icon: HardDrive, color: 'text-apple-purple', bg: 'bg-apple-purple/8', suffix: '', raw: true },
          { label: t('upload.stats.ingested'), value: files.filter((f) => f.name.endsWith('.md')).length, icon: CheckCircle, color: 'text-apple-green', bg: 'bg-apple-green/8', suffix: '' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`apple-card p-5 flex items-center gap-4 ${s.bg}`}
          >
            <div className={`p-3 rounded-xl bg-[var(--bg-primary)] ${s.color}`}>
              <s.icon size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">{s.raw ? s.value : s.value + s.suffix}</div>
              <div className="text-xs text-[var(--text-tertiary)] font-medium">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Upload Progress */}
      <AnimatePresence>
        {uploadProgress && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div className="apple-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Loader2 size={18} className="animate-spin text-apple-blue" />
                  <span className="text-sm font-semibold">{t('upload.uploading')}</span>
                  <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-md font-mono">
                    {uploadProgress.current}/{uploadProgress.total}
                  </span>
                </div>
                <span className="text-xs text-[var(--text-tertiary)] font-medium">{Math.round(uploadPercent)}%</span>
              </div>
              <div className="w-full h-2.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-apple-blue rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${uploadPercent}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Drag & Drop */}
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
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all relative overflow-hidden ${
                dragActive
                  ? 'border-apple-blue bg-apple-blue/5 scale-[1.01]'
                  : uploading
                  ? 'opacity-50 cursor-not-allowed border-[var(--border-default)]'
                  : 'border-[var(--border-default)] hover:border-apple-blue/40 hover:bg-apple-blue/[0.02]'
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
              onChange={handleFileInput}
              accept=".md,.txt,.pdf,.docx,.pptx,.xlsx,.html,.csv,.json,.xml,.rst,.rtf,.epub,.ipynb,.yaml,.yml,.tsv"
            />
          </div>
        </motion.div>

        {/* Paste Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="apple-card p-0 overflow-hidden"
        >
          <div className="p-5 border-b border-[var(--border-default)]">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <FileText size={16} className="text-apple-purple" />
              {t('upload.pasteTitle')}
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <input
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder={t('upload.titlePlaceholder')}
              className="apple-input w-full"
            />
            <textarea
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder={t('upload.pastePlaceholder')}
              rows={5}
              className="apple-input w-full resize-none font-mono text-sm"
            />
            <button
              onClick={handleSaveText}
              disabled={savingText || !pasteTitle.trim() || !pasteContent.trim()}
              className="apple-button-warm text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {savingText ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              {t('upload.saveText')}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Preview Panel */}
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
                <Eye size={16} className="text-apple-green shrink-0" />
                <h2 className="text-sm font-semibold truncate">{previewName}</h2>
                <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-md shrink-0">
                  {t('upload.preview.rawContent')}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {previewContent && (
                  <button
                    onClick={() => navigator.clipboard.writeText(previewContent).then(() => showToast(t('upload.copySuccess'), 'success'))}
                    className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    title={t('upload.copyContent')}
                  >
                    <ClipboardCopy size={16} />
                  </button>
                )}
                <button
                  onClick={() => { setPreviewContent(null); setPreviewName(''); }}
                  className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
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

      {/* Files List */}
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
            <span className="text-xs text-[var(--text-tertiary)] font-normal bg-[var(--bg-secondary)] px-2 py-0.5 rounded-md">
              {filteredFiles.length}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('action.search') + '...'}
                className="apple-input pl-8 text-xs w-44"
              />
            </div>
            <button
              onClick={() => setSortMode((prev) => prev === 'newest' ? 'name' : prev === 'name' ? 'size' : 'newest')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
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
                onClick={() => setFileTypeFilter(pill.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
                  fileTypeFilter === pill.key
                    ? 'bg-apple-blue text-white shadow-sm'
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
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
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
                        onClick={handleBatchIngest}
                        disabled={batchIngesting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-apple-blue text-white text-xs font-semibold hover:bg-apple-blue/90 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {batchIngesting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                        {t('upload.ingestSelected', { count: selectedPaths.size })}
                      </button>
                      <button
                        onClick={() => setSelectedPaths(new Set())}
                        className="text-xs text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
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
        <div className="p-2">
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
                className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[var(--bg-secondary)] mb-5"
              >
                <Inbox size={36} className="text-[var(--text-tertiary)]" />
              </motion.div>
              <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-1">{t('upload.empty.title')}</h3>
              <p className="text-sm text-[var(--text-tertiary)] max-w-sm mx-auto leading-relaxed mb-4">
                {t('upload.empty.description')}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="apple-button-warm text-sm inline-flex items-center gap-2"
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
                onClick={() => { setSearchQuery(''); setFileTypeFilter('all'); }}
                className="text-xs text-apple-blue hover:underline mt-2"
              >
                {t('browse.empty.noResults.clearFilters')}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredFiles.map((file, index) => {
                const Icon = getFileIcon(file.name);
                const isSelected = selectedPaths.has(file.path);
                const isIngesting = ingestingPaths.has(file.path);
                const isDeleting = deletingPaths.has(file.path);
                const isHovered = hoveredPath === file.path;
                const category = getFileCategory(file.name);

                return (
                  <motion.div
                    key={file.path}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.2 }}
                    onMouseEnter={() => setHoveredPath(file.path)}
                    onMouseLeave={() => setHoveredPath((prev) => prev === file.path ? null : prev)}
                    className={`group flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-default ${
                      isSelected
                        ? 'bg-apple-blue/[0.06] border-l-[3px] border-l-apple-blue'
                        : 'hover:bg-[var(--bg-secondary)] border-l-[3px] border-l-transparent'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(file.path)}
                      className="shrink-0 text-[var(--text-tertiary)] hover:text-apple-blue transition-colors p-1 rounded-md hover:bg-[var(--bg-secondary)]"
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wide shrink-0 ${
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
                        onClick={() => handlePreview(file)}
                        className="p-2 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                        title={t('upload.preview')}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleIngest(file)}
                        disabled={isIngesting}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-apple-blue text-white text-xs font-semibold hover:bg-apple-blue/90 transition-colors disabled:opacity-50 shadow-sm"
                        title={t('upload.ingest')}
                      >
                        {isIngesting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                        <span className="hidden sm:inline">{isIngesting ? t('upload.ingesting') : t('upload.ingest')}</span>
                      </button>
                      <button
                        onClick={() => handleDelete(file)}
                        disabled={isDeleting}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition-colors disabled:opacity-50"
                        title={t('upload.delete')}
                      >
                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
