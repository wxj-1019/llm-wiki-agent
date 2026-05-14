---
title: "IngestProgress"
type: entity
tags: [frontend, component, ingestion, progress, ui]
sources: [RootLayoutComponent.md, root-layout-main-application-layout-component.md]
---

# IngestProgress

`IngestProgress` is a user interface component within the [[LLMWikiViewer]] frontend that displays the current status and progress of a content ingestion operation. It is rendered as part of the top-level application shell in the [[RootLayout]] component, appearing as a persistently visible progress bar or indicator while the system processes and indexes new wiki content. Its primary significance lies in providing real-time feedback to the user during potentially lengthy ingestion tasks, ensuring the interface remains transparent and responsive. The component is surfaced alongside other global UI elements such as the [[Header]], [[Sidebar]], [[CommandPalette]], [[AlertBanner]], and [[ToastContainer]], and is intended to be non-intrusive yet sufficiently prominent to convey operational state without blocking user interaction.