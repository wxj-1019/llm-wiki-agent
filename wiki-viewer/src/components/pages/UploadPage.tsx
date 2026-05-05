import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, FolderOpen, HardDrive, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchRawFiles, uploadFile, uploadText, triggerIngest,
  fetchRawFileContent, deleteRawFile, ingestImageFile,
} from '@/services/dataService';
import type { RawFile, UploadResult, IngestResult } from '@/services/dataService';
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
  const [imageIngestingPaths, setImageIngestingPaths] = useState<Set<string>>(new Set());
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
  const [batchIngesting, setBatchIngesting] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

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
    return { totalFiles: files.length, totalSize };
  }, [files]);

  const animatedTotalFiles = useCountUp(stats.totalFiles);

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

  const isImageFile = useCallback((name: string) => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name), []);

  const doUploadFiles = useCallback(async (fileList: File[]) => {
    setUploading(true);
    setUploadProgress({ current: 0, total: fileList.length });
    for (let i = 0; i < fileList.length; i++) {
      setUploadProgress({ current: i, total: fileList.length });
      const file = fileList[i];
      try {
        if (isImageFile(file.name)) {
          setImageIngestingPaths((prev) => new Set(prev).add(file.name));
          const result = await ingestImageFile(file);
          if (result.success) {
            showToast(t('upload.success.imageIngest', { path: result.md_path }), 'success');
            refreshGraphData();
          } else {
            showToast(t('upload.error.imageIngest', { error: result.stderr || 'Unknown' }), 'error');
          }
          setImageIngestingPaths((prev) => { const n = new Set(prev); n.delete(file.name); return n; });
        } else {
          const result: UploadResult = await uploadFile(file);
          showToast(t('upload.success.upload', { path: result.path }), 'success');
        }
      } catch (err) {
        showToast(String(err), 'error');
        setImageIngestingPaths((prev) => { const n = new Set(prev); n.delete(file.name); return n; });
      }
    }
    setUploadProgress({ current: fileList.length, total: fileList.length });
    setTimeout(() => {
      setUploadProgress(null);
      setUploading(false);
    }, 400);
    await loadFiles();
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
    const failed: string[] = [];
    for (const path of selectedPaths) {
      try {
        const result = await triggerIngest(path);
        if (result.success) {
          successCount++;
        } else {
          failed.push(path);
        }
      } catch (e) {
        failed.push(path);
      }
    }
    const total = selectedPaths.size;
    if (failed.length > 0) {
      showToast(`${successCount}/${total} ${t('upload.success.ingest')} (${failed.length} failed)`, successCount > 0 ? 'success' : 'error');
    } else {
      showToast(`${successCount}/${total} ${t('upload.success.ingest')}`, 'success');
    }
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

  const uploadPercent = uploadProgress ? (uploadProgress.current / uploadProgress.total) * 100 : 0;

  return (
    <div className="pb-12">
      {/* Skip link for keyboard navigation */}
      <a
        href="#upload-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-apple-blue focus:text-white focus:rounded-xl"
      >
        {t('upload.skipToContent') || 'Skip to main content'}
      </a>
      {/* Global Drag Overlay -->
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
            className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--bg-primary)] border-2 border-dashed border-apple-blue rounded-3xl p-16 text-center"
            >
              <CloudUpload size={64} className="mx-auto mb-4 text-apple-blue" />
              <p className="text-xl font-semibold text-apple-blue">{t('upload.dragActive')}</p>
              <p className="text-sm text-[var(--text-tertiary)] mt-2">{t('upload.dragFormatHint')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div id="upload-main" className="mb-8" tabIndex={-1}>
        <h1 className="text-3xl font-semibold tracking-tight">{t('upload.title')}</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">{t('upload.dragFormatHint')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: t('upload.stats.totalFiles'), value: animatedTotalFiles, icon: FolderOpen, color: 'text-apple-blue', bg: 'bg-apple-blue/8', suffix: '' },
          { label: t('upload.stats.totalSize'), value: formatBytes(stats.totalSize), icon: HardDrive, color: 'text-apple-purple', bg: 'bg-apple-purple/8', suffix: '', raw: true },
          { label: t('upload.stats.ingested'), value: files.filter((f) => f.ingested).length, icon: CheckCircle, color: 'text-apple-green', bg: 'bg-apple-green/8', suffix: '' },
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
                  <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono">
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
        <UploadZone
          dragActive={dragActive}
          uploading={uploading}
          onDrag={handleDrag}
          onDrop={handleDrop}
          onFileInput={handleFileInput}
        />
        <PasteTextPanel
          pasteTitle={pasteTitle}
          pasteContent={pasteContent}
          savingText={savingText}
          onTitleChange={setPasteTitle}
          onContentChange={setPasteContent}
          onSave={handleSaveText}
        />
      </div>

      {/* Preview Panel */}
      <PreviewPanel
        previewContent={previewContent}
        previewName={previewName}
        onClose={() => { setPreviewContent(null); setPreviewName(''); }}
        onCopy={() => {
          if (previewContent) {
            navigator.clipboard.writeText(previewContent).then(() => showToast(t('upload.copySuccess'), 'success'));
          }
        }}
      />

      {/* Files List */}
      <FileList
        files={files}
        filteredFiles={filteredFiles}
        loadingFiles={loadingFiles}
        selectedPaths={selectedPaths}
        searchQuery={searchQuery}
        sortMode={sortMode}
        fileTypeFilter={fileTypeFilter}
        ingestingPaths={ingestingPaths}
        deletingPaths={deletingPaths}
        batchIngesting={batchIngesting}
        hoveredPath={hoveredPath}
        onSearchChange={setSearchQuery}
        onSortModeChange={setSortMode}
        onFileTypeFilterChange={setFileTypeFilter}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onBatchIngest={handleBatchIngest}
        onClearSelection={() => setSelectedPaths(new Set())}
        onPreview={handlePreview}
        onIngest={handleIngest}
        onDelete={handleDelete}
        onHover={setHoveredPath}
        onTriggerFileInput={() => fileInputRef.current?.click()}
      />
    </div>
  );
}
