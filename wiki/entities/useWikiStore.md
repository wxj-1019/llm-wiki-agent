---
title: "useWikiStore"
type: entity
tags: [frontend, typescript, react, state-management, store, zustand]
sources: [UploadPage.md, header-component-wiki-viewer-navigation-bar.md, uploadpage-file-upload-component.md]
---

# useWikiStore

`useWikiStore` is a custom React hook that provides centralized state management for the [[LLMWikiViewer]] frontend, likely implemented via Zustand or a similar lightweight state library. It serves as the single source of truth for application-wide state, including file upload operations (tracking `files`, `loadingFiles`, `uploading`, and `uploadProgress` as used by the [[UploadPage]] component), SSE connection status (monitored by the [[Header]] component via its notification and status indicators), and global UI state such as theme preferences and sidebar toggle. Components throughout the application access and mutate shared state through this hook, enabling reactive updates without prop drilling. Key actions associated with `useWikiStore` include `setFiles`, `setUploadProgress`, `addFile`, `removeFile`, `setFetchedUrl`, `setSearchQuery`, and theme toggling functions, all of which are dispatched from UI components like [[UploadPage]], [[Header]], and the search panel to synchronize user interactions with the store's immutable state tree.