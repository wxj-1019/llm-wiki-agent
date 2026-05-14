---
title: "CrashRecoveryPattern"
type: concept
tags: [state-management, persistence, resilience]
sources: [ingest-job-store-zustand-manager]
last_updated: 2026-05-14
---

# Crash Recovery Pattern

The **Crash Recovery Pattern** is a state management technique for handling unexpected interruptions in long-running processes. As implemented in [[useIngestStore]], on store initialization any persisted jobs with `running` status are automatically marked `failed` with a descriptive log entry, preventing phantom "zombie" jobs from appearing stuck. This is particularly important for [[SSEStreamProtocol|SSE-based]] workflows where the connection is lost on page navigation.

## Connections
- [[useIngestStore]] — implements this pattern with [[LocalStorage]] persistence
- [[IngestJob]] — the state object recovered
- [[IngestWorkflow]] — the workflow this pattern protects