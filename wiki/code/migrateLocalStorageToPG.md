---
title: "migrateLocalStorageToPG"
type: code_func
tags: [typescript, migration, localStorage, postgresql]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# migrateLocalStorageToPG(): Promise<{ migrated: number; errors: string[] }>

Migrates legacy chat sessions from localStorage (`wiki-chat-sessions`) to the PostgreSQL-backed backend. On success, clears localStorage.

## Signature
```typescript
export async function migrateLocalStorageToPG(): Promise<{ migrated: number; errors: string[] }>
```

## Returns
- `migrated: number` — Count of successfully migrated sessions
- `errors: string[]` — Per-session error messages

## Migration flow
1. Reads `wiki-chat-sessions` from localStorage
2. Parses JSON to find sessions array
3. For each session: creates a backend session via [[createChatSession]], then appends messages via [[appendChatMessage]]
4. On successful migration of all sessions (errors.length === 0), clears localStorage
5. Returns migration count and any per-session errors