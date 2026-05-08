import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useTranslation } from 'react-i18next';
import { FolderOpen, HardDrive, CheckCircle, Loader2, CloudUpload, Plus, X, ChevronDown, Trash2, AlertCircle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchRawFiles, uploadFile, uploadText,
  fetchRawFileContent, deleteRawFile, ingestImageFile,
  fetchUrlArticle,
} from '@/services/dataService';
import type { RawFile, UploadResult } from '@/services/dataService';
import { useIngestStore } from '@/stores/ingestStore';
import { connectIngestStream } from '@/hooks/useIngestStream';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCountUp } from '@/hooks/useCountUp';
import { useWikiStore } from '@/stores/wikiStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { formatBytes, getFileCategory, type FileTypeFilter } from '@/lib/fileUtils';
import { UploadZone } from '@/components/upload/UploadZone';
import { PasteTextPanel } from '@/components/upload/PasteTextPanel';
import { PreviewPanel } from '@/components/upload/PreviewPanel';
import { FileList } from '@/components/upload/FileList';

type SortMode = 'newest' | 'name' | 'size';
type AddMethod = 'none' | 'paste' | 'url';

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

  const [fetchUrl, setFetchUrl] = useState('');
  const [fetchName, setFetchName] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [fetchResult, setFetchResult] = useState<{ saved: string | null; quality: string | null } | null>(null);

  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [showUningestedOnly, setShowUningestedOnly] = useState(false);

  const jobs = useIngestStore((s) => s.jobs);
  const [deletingPaths, setDeletingPaths] = useState<Set<string>>(new Set());

  const addNotification = useNotificationStore((s) => s.addNotification);

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const [expandedMethod, setExpandedMethod] = useState<AddMethod>('none');

  const [ingestErrorLog, setIngestErrorLog] = useState<{ title: string; stdout: string; stderr: string; returncode: number } | null>(null);
  const errorLogDialogRef = useFocusTrap<HTMLDivElement>(!!ingestErrorLog);
  useBodyScrollLock(!!ingestErrorLog);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    addNotification(message, type);
  }, [addNotification]);

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
    const ingestedCount = files.filter((f) => f.ingested).length;
    return { totalFiles: files.length, totalSize, ingestedCount };
  }, [files]);

  const animatedTotalFiles = useCountUp(stats.totalFiles);

  const filteredFiles = useMemo(() => {
    let result = files;
    if (showUningestedOnly) {
      result = result.filter((f) => !f.ingested);
    }
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
  }, [files, fileTypeFilter, searchQuery, sortMode, showUningestedOnly]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const isImageFile = useCallback((name: string) => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name), []);

  const doUploadFiles = useCallback(async (fileList: File[]) => {
    setUploading(true);
    setUploadProgress({ current: 0, total: fileList.length });
    let successCount = 0;
    let failCount = 0;
    let needGraphRefresh = false;
    for (let i = 0; i < fileList.length; i++) {
      setUploadProgress({ current: i, total: fileList.length });
      const file = fileList[i];
      try {
        if (isImageFile(file.name)) {
          const result = await ingestImageFile(file);
          if (result.success) {
            successCount++;
            showToast(t('upload.success.imageIngest', { path: result.md_path }), 'success');
            needGraphRefresh = true;
          } else {
            failCount++;
            showToast(t('upload.error.imageIngest', { error: result.stderr || 'Unknown' }), 'error');
          }
        } else {
          const result: UploadResult = await uploadFile(file);
          successCount++;
          showToast(t('upload.success.upload', { path: result.path }), 'success');
        }
      } catch (err) {
        failCount++;
        showToast(String(err), 'error');
      }
    }
    if (needGraphRefresh) {
      refreshGraphData();
    }
    setUploadProgress({ current: fileList.length, total: fileList.length });
    setTimeout(() => {
      setUploadProgress(null);
      setUploading(false);
    }, 400);
    await loadFiles();
    // Summary toast for batch upload
    if (fileList.length > 1) {
      if (failCount > 0) {
        showToast(`${successCount}/${fileList.length} 上传成功 (${failCount} 失败)`, successCount > 0 ? 'success' : 'error');
      } else {
        showToast(`${successCount} 个文件上传成功`, 'success');
      }
    }
  }, [loadFiles, showToast, t, refreshGraphData, isImageFile]);

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

  const handleFetchUrl = useCallback(async () => {
    if (!fetchUrl.trim()) {
      showToast(t('upload.enterUrl'), 'error');
      return;
    }
    try {
      setFetchingUrl(true);
      setFetchResult(null);
      const result = await fetchUrlArticle(fetchUrl.trim(), fetchName.trim());
      if (result.success && result.saved_file) {
        showToast(`Fetched: ${result.saved_file} (Quality: ${result.quality || 'N/A'})`, 'success');
        setFetchResult({ saved: result.saved_file, quality: result.quality });
        setFetchUrl('');
        setFetchName('');
        await loadFiles();
      } else {
        showToast(result.stderr || t('upload.fetchFailed'), 'error');
      }
    } catch (err) {
      showToast(String(err), 'error');
    } finally {
      setFetchingUrl(false);
    }
  }, [fetchUrl, fetchName, loadFiles, showToast, t]);

  const handlePreview = useCallback(async (file: RawFile) => {
    setPreviewLoading(true);
    setPreviewName(file.name);
    setPreviewContent(null);
    if (file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.txt')) {
      try {
        const text = await fetchRawFileContent(file.path);
        setPreviewContent(text);
        setPreviewLoading(false);
        return;
      } catch { /* fallback */ }
    }
    setPreviewContent(
      `# ${file.name}\n\n- **${t('upload.preview.path')}**: ${file.path}\n- **${t('upload.preview.size')}**: ${formatBytes(file.size)}\n- **${t('upload.preview.type')}**: ${t('upload.preview.binaryDesc')}`
    );
    setPreviewLoading(false);
  }, [t]);

  const handleIngest = useCallback((file: RawFile) => {
    const jobId = useIngestStore.getState().startJob(file.path, file.name);
    connectIngestStream(jobId, file.path);
  }, []);

  const handleDelete = useCallback(async (file: RawFile) => {
    if (!confirm(t('upload.deleteConfirm'))) return;
    try {
      setDeletingPaths((prev) => new Set(prev).add(file.path));
      await deleteRawFile(file.path);
      showToast(t('upload.deletedFile', { name: file.name }), 'success');
      setSelectedPaths((prev) => { const n = new Set(prev); n.delete(file.path); return n; });
      await loadFiles();
    } catch (err) {
      showToast(String(err), 'error');
    } finally {
      setDeletingPaths((prev) => { const n = new Set(prev); n.delete(file.path); return n; });
    }
  }, [showToast, t, loadFiles]);

  const handleBatchIngest = useCallback(() => {
    if (selectedPaths.size === 0) {
      showToast(t('upload.nothingSelected'), 'error');
      return;
    }
    let skippedCount = 0;
    for (const path of selectedPaths) {
      const file = files.find((f) => f.path === path);
      if (file) {
        if (file.ingested) {
          skippedCount++;
          continue;
        }
        const jobId = useIngestStore.getState().startJob(file.path, file.name);
        connectIngestStream(jobId, file.path);
      }
    }
    if (skippedCount > 0) {
      showToast(`${skippedCount} 个文件已摄取，已自动跳过`, 'info');
    }
  }, [selectedPaths, files, showToast, t]);

  const [batchDeleting, setBatchDeleting] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const deleteDialogRef = useFocusTrap<HTMLDivElement>(showBatchDeleteConfirm);
  useBodyScrollLock(showBatchDeleteConfirm);

  // Listen for completed/failed ingest jobs and refresh data
  // Initialize with already-completed jobs so page reload / Strict Mode doesn't re-process them
  const completedIdsRef = useRef<Set<string>>(new Set(jobs.filter((j) => j.status !== 'running').map((j) => j.id)));
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const tRef = useRef(t);
  tRef.current = t;
  const refreshGraphDataRef = useRef(refreshGraphData);
  refreshGraphDataRef.current = refreshGraphData;
  const loadFilesRef = useRef(loadFiles);
  loadFilesRef.current = loadFiles;
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let hasNewCompleted = false;
    for (const job of jobs) {
      if (job.status !== 'running' && !completedIdsRef.current.has(job.id)) {
        completedIdsRef.current.add(job.id);
        hasNewCompleted = true;
        if (job.status === 'failed') {
          const stdout = job.logs.filter((l) => !l.startsWith('stderr:')).join('\n');
          const stderr = job.logs.filter((l) => l.startsWith('stderr:')).map((l) => l.slice(7)).join('\n');
          showToastRef.current(`${tRef.current('upload.error.ingest')}: ${job.name}`, 'error');
          setIngestErrorLog({
            title: job.name,
            stdout,
            stderr,
            returncode: job.returncode ?? 1,
          });
        }
        if (job.status === 'completed') {
          showToastRef.current(`${tRef.current('upload.success.ingest')}: ${job.name}`, 'success');
        }
      }
    }
    if (hasNewCompleted) {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        refreshGraphDataRef.current();
        loadFilesRef.current();
      }, 300);
    }
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [jobs]);

  // Global Escape handler for batch delete modal (motion.div doesn't auto-focus)
  useEffect(() => {
    if (!showBatchDeleteConfirm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowBatchDeleteConfirm(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showBatchDeleteConfirm]);

  // Global Escape handler for error log modal
  useEffect(() => {
    if (!ingestErrorLog) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIngestErrorLog(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [ingestErrorLog]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedPaths.size === 0) {
      showToast(t('upload.nothingSelected'), 'error');
      return;
    }
    setShowBatchDeleteConfirm(true);
  }, [selectedPaths.size, showToast, t]);

  const confirmBatchDelete = useCallback(async () => {
    setShowBatchDeleteConfirm(false);
    setBatchDeleting(true);
    let successCount = 0;
    const failed: string[] = [];
    for (const path of selectedPaths) {
      try {
        await deleteRawFile(path);
        successCount++;
      } catch (e) {
        failed.push(path);
      }
    }
    const total = selectedPaths.size;
    if (failed.length > 0) {
      showToast(`${successCount}/${total} ${t('upload.delete')} (${failed.length} failed)`, successCount > 0 ? 'success' : 'error');
    } else {
      showToast(`${successCount}/${total} ${t('upload.delete')}`, 'success');
    }
    setSelectedPaths(new Set());
    setBatchDeleting(false);
    await loadFiles();
  }, [selectedPaths, showToast, t, loadFiles]);

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

  const uploadPercent = uploadProgress ? (uploadProgress.current / uploadProgress.total) * 100 : 0;

  const statsBar = (
    <div className="flex items-center gap-4 sm:gap-6 text-xs text-[var(--text-tertiary)]">
      <div className="flex items-center gap-1.5">
        <FolderOpen size={13} className="text-apple-blue" />
        <span className="font-medium text-[var(--text-secondary)]">{animatedTotalFiles}</span>
        <span>{t('upload.stats.totalFiles')}</span>
      </div>
      <div className="w-px h-3 bg-[var(--border-default)]" />
      <div className="flex items-center gap-1.5">
        <HardDrive size={13} className="text-apple-purple" />
        <span className="font-medium text-[var(--text-secondary)]">{formatBytes(stats.totalSize)}</span>
      </div>
      <div className="w-px h-3 bg-[var(--border-default)] hidden sm:block" />
      <div className="hidden sm:flex items-center gap-1.5">
        <CheckCircle size={13} className="text-apple-green" />
        <span className="font-medium text-[var(--text-secondary)]">{stats.ingestedCount}</span>
        <span>{t('upload.stats.ingested')}</span>
      </div>
    </div>
  );

  return (
    <div className="pb-12 max-w-5xl mx-auto">
      {/* Skip link */}
      <a
        href="#upload-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-apple-blue focus:text-white focus:rounded-xl"
      >
        {t('upload.skipToContent') || 'Skip to main content'}
      </a>

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
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--bg-primary)] border-2 border-dashed border-apple-blue rounded-3xl p-14 sm:p-20 text-center shadow-2xl"
            >
              <CloudUpload size={72} className="mx-auto mb-5 text-apple-blue" />
              <p className="text-2xl font-bold text-apple-blue">{t('upload.dragActive')}</p>
              <p className="text-sm text-[var(--text-tertiary)] mt-2">{t('upload.dragFormatHint')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div id="upload-main" className="mb-6" tabIndex={-1}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-heading-1">{t('upload.title')}</h1>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">{t('upload.dragFormatHint')}</p>
          </div>
          {statsBar}
        </div>
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
                  <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono rounded-lg">
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

      {/* Main Upload Zone */}
      <UploadZone
        dragActive={dragActive}
        uploading={uploading}
        onDrag={handleDrag}
        onDrop={handleDrop}
        onFileInput={handleFileInput}
      />

      {/* Secondary Add Methods */}
      <div className="mt-4">
        <div className="flex items-center justify-center">
          <button
            onClick={() => setExpandedMethod(expandedMethod === 'none' ? 'paste' : 'none')}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all"
          >
            {expandedMethod === 'none' ? (
              <>
                <Plus size={15} />
                <span>{t('upload.addContent')}</span>
                <ChevronDown size={14} className="transition-transform" />
              </>
            ) : (
              <>
                <X size={15} />
                <span>{t('common.close')}</span>
              </>
            )}
          </button>
        </div>

        <AnimatePresence>
          {expandedMethod !== 'none' && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <PasteTextPanel
                pasteTitle={pasteTitle}
                pasteContent={pasteContent}
                savingText={savingText}
                fetchUrl={fetchUrl}
                fetchName={fetchName}
                fetchingUrl={fetchingUrl}
                fetchResult={fetchResult}
                activeTab={expandedMethod === 'paste' ? 'paste' : 'url'}
                onTitleChange={setPasteTitle}
                onContentChange={setPasteContent}
                onSave={handleSaveText}
                onFetchUrl={handleFetchUrl}
                onFetchUrlChange={setFetchUrl}
                onFetchNameChange={setFetchName}
                onTabChange={(tab) => setExpandedMethod(tab === 'paste' ? 'paste' : 'url')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* File List — Full Width */}
      <div className="mt-8">
        <FileList
          files={files}
          filteredFiles={filteredFiles}
          loadingFiles={loadingFiles}
          selectedPaths={selectedPaths}
          searchQuery={searchQuery}
          sortMode={sortMode}
          fileTypeFilter={fileTypeFilter}
          showUningestedOnly={showUningestedOnly}
          deletingPaths={deletingPaths}
          batchDeleting={batchDeleting}
          hoveredPath={hoveredPath}
          onSearchChange={setSearchQuery}
          onSortModeChange={setSortMode}
          onFileTypeFilterChange={setFileTypeFilter}
          onToggleUningested={() => setShowUningestedOnly((v) => !v)}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onBatchIngest={handleBatchIngest}
          onBatchDelete={handleBatchDelete}
          onClearSelection={() => setSelectedPaths(new Set())}
          onPreview={handlePreview}
          onIngest={handleIngest}
          onDelete={handleDelete}
          onHover={setHoveredPath}
          onTriggerFileInput={() => fileInputRef.current?.click()}
        />
      </div>

      {/* Hidden file input for empty-state CTA */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInput}
        accept=".md,.txt,.pdf,.docx,.pptx,.xlsx,.html,.csv,.json,.xml,.rst,.rtf,.epub,.ipynb,.yaml,.yml,.tsv,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg"
      />

      {/* Preview Panel */}
      <PreviewPanel
        previewContent={previewContent}
        previewName={previewName}
        isLoading={previewLoading}
        onClose={() => { setPreviewContent(null); setPreviewName(''); setPreviewLoading(false); }}
        onCopy={() => {
          if (previewContent) {
            navigator.clipboard.writeText(previewContent).then(() => showToast(t('upload.copySuccess'), 'success'));
          }
        }}
      />

      {/* Error Log Modal */}
      <AnimatePresence>
        {ingestErrorLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
            onClick={() => setIngestErrorLog(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="error-log-title"
          >
            <motion.div
              ref={errorLogDialogRef}
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-primary)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-[var(--border-default)] overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <AlertCircle size={18} className="text-red-500" />
                  </div>
                  <div>
                    <h3 id="error-log-title" className="text-sm font-semibold">{t('upload.ingestErrorTitle') || '摄入失败详情'}</h3>
                    <p className="text-xs text-[var(--text-tertiary)]">{ingestErrorLog.title} · returncode: {ingestErrorLog.returncode}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIngestErrorLog(null)}
                  className="p-2 rounded-xl hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                  aria-label={t('common.close')}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {ingestErrorLog.stderr && (
                  <div>
                    <div className="text-xs font-semibold text-red-500 mb-1.5 flex items-center gap-1.5">
                      <AlertCircle size={12} />
                      stderr
                    </div>
                    <pre className="bg-[var(--bg-secondary)] rounded-xl p-3 text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words border border-[var(--border-default)] max-h-[30vh] overflow-y-auto">
                      {ingestErrorLog.stderr}
                    </pre>
                  </div>
                )}
                {ingestErrorLog.stdout && (
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-tertiary)] mb-1.5 flex items-center gap-1.5">
                      <FileText size={12} />
                      stdout
                    </div>
                    <pre className="bg-[var(--bg-secondary)] rounded-xl p-3 text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words border border-[var(--border-default)] max-h-[30vh] overflow-y-auto">
                      {ingestErrorLog.stdout}
                    </pre>
                  </div>
                )}
              </div>
              <div className="px-5 py-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]/40 shrink-0 flex justify-end">
                <button onClick={() => setIngestErrorLog(null)} className="apple-button-ghost px-4 py-2 text-sm">
                  {t('common.close')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Delete Confirm Modal */}
      <AnimatePresence>
        {showBatchDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowBatchDeleteConfirm(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-delete-title"
            onKeyDown={(e) => { if (e.key === 'Escape') setShowBatchDeleteConfirm(false); }}
          >
            <motion.div
              ref={deleteDialogRef}
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-1">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <h3 id="batch-delete-title" className="text-lg font-semibold">{t('upload.batchDeleteTitle')}</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {t('upload.batchDeleteConfirm', { count: selectedPaths.size })}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowBatchDeleteConfirm(false)} className="apple-button-ghost px-4 py-2 text-sm">
                  {t('common.close')}
                </button>
                <button onClick={confirmBatchDelete} className="apple-button apple-button-red px-4 py-2 text-sm">
                  {t('upload.delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
