---
title: "IngestSSEProtocol"
type: concept
tags: [sse, protocol, ingest, events]
sources: [useingeststream-ingest-job-sse-stream-consumer-hook]
last_updated: 2026-05-14
---

# IngestSSEProtocol

The `IngestSSEProtocol` defines the [[SSEStreamProtocol]] event schema used for real-time ingest job updates between the [[APIServer]] backend and the [[LLMWikiViewer]] frontend.

## Events
| Event | Payload | Description |
|---|---|---|
| `start` | none | Job started; status → `running` |
| `log` | `{"text": string, "progress": number}` | Progress log with 0-100 percentage |
| `stderr` | `{"text": string}` | Error output from the ingest process |
| `complete` | `{"status": string, "returncode": number}` | Job finished; status is final status |

## Error Handling
When the [[EventSource]] fires `onerror`, the connection is closed and the job is marked `failed` if it was previously `running`.

## Usage
Used by [[useIngestStream]] to consume ingest job status in the frontend, and emitted by the [[IngestionJobManager]] backend.