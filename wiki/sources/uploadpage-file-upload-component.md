---
title: "UploadPage — File Upload & Management Component for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, upload, drag-and-drop]
date: 2026-05-14
source_file: UploadPage.tsx
---

## Summary
The `UploadPage` component (`UploadPage.tsx`) is the file upload and management interface for the [[LLMWikiViewer]] frontend. It provides drag-and-drop file upload, text pasting, URL fetching, file list management with status indicators, preview, batch operations, image ingest via vision API, and an error log dialog — all in a single-page layout with Framer Motion animations.

## Key Claims
- **Drag-and-drop upload**: `handleDrop` / `handleDrag` callbacks support single and batch file upload; image files (`.png`, `.jpg`, `.gif`, `.webp`, `.bmp`, `.svg`) auto-trigger `ingestImageFile()` for vision model processing.
- **Three add methods**: File upload (drag/click), paste text (title + content via `uploadText`), URL fetch (via `fetchUrlArticle`). Controlled by `AddMethod` type: `'none' | 'paste' | 'url'`.
- **Smart file list**: Displays `files` from `fetchRawFiles()` with sorting (`newest`, `name`, `size`), filtering (`all`, `unedited`, `audio`, `code`, `data`, `image`, `markdown`, `text`), search, and `showUningestedOnly` toggle.
- **Batch selection**: `selectedPaths` set for multi-select with batch delete (confirmation dialog using `useFocusTrap` + `useBodyScrollLock`) and `batchIngest` via `connectIngestStream`.
- **Preview panel**: `PreviewPanel` shows file content via `fetchRawFileContent`; `PreviewPanel` modal uses `AnimatePresence`.
- **Upload progress**: `uploadProgress` state drives in-progress display during uploads via `doUploadFiles` loop.
- **Error log dialog**: `ingestErrorLog` state populates a dialog with `stdout`/`stderr`/`returncode` from failed ingest jobs.
- **Stats summary**: `stats` memo computes total file count, total size, and ingested count from `files` array.
- **Image ingest flow**: Image files are sent to `ingestImageFile()` which triggers vision model processing; on success, `refreshGraphData()` is called.
- **Framer Motion animations**: `AnimatePresence` + `motion.div` for add method panels, preview dialog, batch delete confirm, and error log dialog.

## Key Quotes
> "Summary toast for batch upload: `{successCount}/{fileList.length} 上传成功 ({failCount} 失败)`" — Batch upload feedback logic

## Connections
- [[APIServer]] — backend API consumed by `fetchRawFiles`, `uploadFile`, `uploadText`, `fetchRawFileContent`, `deleteRawFile`, `ingestImageFile`, `fetchUrlArticle`
- [[DataService]] — `dataService.ts` provides all HTTP client functions
- [[useFocusTrap]] — keyboard focus trapping for modals
- [[useBodyScrollLock]] — prevents background scroll when modals are open
- [[useIngestStream]] — WebSocket stream for real-time ingest job updates
- [[useCountUp]] — animated counter for file count
- [[useWikiStore]] — global wiki state (for graph refresh)
- [[useNotificationStore]] — toast notification system
- [[IngestStore]] — ingest job tracking store
- [[FileUtils]] — `formatBytes`, `getFileCategory` helpers
- [[UploadZone]], [[PasteTextPanel]], [[PreviewPanel]], [[FileList]] — sub-components

## Contradictions
- None found.