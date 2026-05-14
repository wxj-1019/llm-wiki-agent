---
title: "Zustand"
type: entity
tags: [frontend, state-management, library]
sources: [wikistore-zustand-global-state-store]
last_updated: 2026-05-14
---

Zustand is a lightweight state management library for React/JavaScript applications. It provides a hook-based API with minimal boilerplate and supports middleware for persistence, immutability, and subscriptions. Used extensively in the [[LLMWikiViewer]] frontend for stores like [[WikiStore]], [[NotificationStore]], [[IngestJobStore]], [[SystemConfigStore]], and [[AgentChatStore]].

## Usage in WikiStore

The `useWikiStore` is created via `create<WikiState>(...)` from Zustand. It subscribes to relevant state changes for automatic persistence.

## Related
- [[LocalStorage]] — persistence backend used with Zustand stores