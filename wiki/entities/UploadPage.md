---
title: "UploadPage"
type: entity
tags: [frontend, component]
sources: [uploadpage-file-upload-component]
last_updated: 2026-05-14
---

**UploadPage** is a React component in the [[LLMWikiViewer]] frontend that provides file upload and management functionality. It supports drag-and-drop file upload, text pasting, URL fetching, file listing with sort/filter/search, batch selection and delete, image ingest via vision API, and an error log dialog.

Key features:
- Three add methods: file upload, paste text, URL fetch
- Image files auto-trigger `ingestImageFile()` for vision model processing
- Batch operations: delete and ingest for multiple selected files
- File preview, stats summary, progress tracking
- Framer Motion animations for modals and panels

Connections: [[APIServer]], [[DataService]], [[useFocusTrap]], [[useBodyScrollLock]], [[useIngestStream]], [[useCountUp]], [[useWikiStore]], [[useNotificationStore]], [[IngestStore]], [[FileUtils]]