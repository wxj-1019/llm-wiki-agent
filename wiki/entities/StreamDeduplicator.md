---
title: "StreamDeduplicator"
type: entity
tags: [utility, streaming, deduplication]
sources: [usechat-agent-kit-chat-state-management-hook]
last_updated: 2026-05-14
---

`StreamDeduplicator` from `lib/streamUtils` is a utility class used by [[useChat]] to process streaming LLM response chunks. It prevents duplicate or out-of-order content by tracking processed chunk identifiers. Used in conjunction with `mergeStreamChunk` to append new content to the existing assistant message without duplication.

Called with: `const deduper = new StreamDeduplicator(); const result = deduper.process(part.chunk);`

If `result` is falsy, the chunk is a duplicate and should be skipped.