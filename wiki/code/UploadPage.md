---
title: "UploadPage"
type: code_module
tags: [frontend, typescript, react, component]
sources: [uploadpage-file-upload-component]
last_updated: 2026-05-14
---

## `UploadPage` Component

**Source:** `wiki-viewer/src/pages/UploadPage.tsx`

**Purpose:** Main file upload and management page for the [[LLMWikiViewer]] frontend.

### State
- `dragActive: boolean` — drag-over state
- `files: RawFile[]` — list of raw files from backend
- `loadingFiles: boolean` — loading indicator
- `uploading: boolean` — upload in progress
- `uploadProgress: { current: number; total: number } | null` — upload progress
- `pasteTitle: string`, `pasteContent: string` — paste text form state
- `savingText: boolean` — text save in progress
- `fetchUrl: string`, `fetchName: string` — URL fetch form state
- `fetchingUrl: boolean`, `fetchResult: { saved: string | null; quality: string | null } | null` — URL fetch state
- `previewContent: string | null`, `previewName: string`, `previewLoading: boolean` — preview state
- `showUningestedOnly: boolean` — filter toggle
- `deletingPaths: Set<string>` — files being deleted
- `selectedPaths: Set<string>` — batch selection
- `searchQuery: string`, `sortMode: SortMode`, `fileTypeFilter: FileTypeFilter` — list controls
- `expandedMethod: AddMethod` — which add panel is open
- `ingestErrorLog: { title: string; stdout: string; stderr: string; returncode: number } | null` — error details

### Key Functions
- `loadFiles()` — fetches raw file list via `fetchRawFiles()`
- `doUploadFiles(fileList: File[])` — uploads files sequentially, auto-ingests images via `ingestImageFile()`, triggers graph refresh
- `handleDrop(e: React.DragEvent)` / `handleDrag(e)` — drag-and-drop handlers
- `handleSaveText()` — saves pasted text via `uploadText()`
- `handleFetchUrl()` — fetches URL article via `fetchUrlArticle()`
- `confirmBatchDelete()` — deletes all selected files

### Imports
- Hooks: `useFocusTrap`, `useBodyScrollLock`, `useIngestStream`, `useDocumentTitle`, `useCountUp`
- Services: `dataService` (fetchRawFiles, uploadFile, uploadText, etc.)
- Stores: `useIngestStore`, `useWikiStore`, `useNotificationStore`
- Icons: `lucide-react`
- Animations: `framer-motion`
- i18n: `react-i18next`

Connections: [[APIServer]], [[DataService]], [[useFocusTrap]], [[useBodyScrollLock]], [[useIngestStream]], [[useCountUp]], [[useWikiStore]], [[useNotificationStore]], [[IngestStore]], [[FileUtils]]