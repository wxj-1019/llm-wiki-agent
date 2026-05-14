---
title: "Map"
type: entity
tags: [javascript, typescript, data-structure, collection, key-value]
sources: [UseIngestStream.md, useingeststream-ingest-job-sse-stream-consumer-hook.md]
---

# Map

`Map` is the standard JavaScript/TypeScript built-in collection object that holds key-value pairs and remembers the original insertion order of the keys. In this wiki's context, it appears specifically as a module-level `activeConnections` registry within the `useIngestStream` module, used to track active [[EventSource]] instances keyed by `jobId`. This usage leverages `Map`'s efficient set, get, and delete operations for managing concurrent stream connections, where each [[jobId]] maps to exactly one [[EventSource]] instance. The guard against duplicate connections is achieved by checking whether a given jobId already exists as a key in the Map before establishing a new SSE connection. The `disconnectIngestStream` function subsequently removes entries from this Map upon manual connection closure, ensuring cleanup of stale references. `Map` is preferred over plain objects in this role for its predictable iteration, clear API for size tracking, and avoidance of prototype-chain pitfalls.