# Chat Module Bug Fix Plan

## Scope
修复对话模块审计报告中发现的所有 P0/P1/P2/P3 级别 Bug，涉及 5 个文件。

## Files to Modify

| File | Fixes |
|---|---|
| `wiki-viewer/src/components/search/types.ts` | Add `id` to ChatEntry |
| `wiki-viewer/src/services/chatService.ts` | SSE timeout, error surfacing, type hardening |
| `wiki-viewer/src/components/pages/SearchPage.tsx` | Closure fix, state mutation fix, contextPages, error handling, tab cancel |
| `wiki-viewer/src/components/search/ChatTab.tsx` | Key fix, loading indicator, scroll |
| `tools/api_server.py` | Duplicate query fix |

---

## Phase 1: Type Foundation (`types.ts`)

### Task 1.1 | Add `id` to ChatEntry
- **Input:** Current `ChatEntry` interface
- **Output:** `ChatEntry` with `id: string` field
- **Risk:** P2 — affects all consumers of ChatEntry
- **Changes:**
  ```typescript
  export interface ChatEntry {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: { path: string; preview: string }[];
  }
  ```
- **Rollback:** Remove `id` field

---

## Phase 2: SSE Service Hardening (`chatService.ts`)

### Task 2.1 | Add timeout to `readSseStream` (BUG-7)
- **Input:** Current `readSseStream` generator
- **Output:** Generator with configurable timeout (default 60s)
- **Risk:** P1 — infinite hang on backend stall
- **Changes:**
  - Add `STREAM_TIMEOUT_MS = 60_000` constant
  - Wrap `reader.read()` with `Promise.race` against a timeout
  - On timeout, yield error chunk and return
- **Rollback:** Remove timeout wrapper

### Task 2.2 | Surface error chunks properly (BUG-13)
- **Input:** Current `parseSseEvent` returns `{ error }` but `readSseStream` yields and returns
- **Output:** Error chunks properly yielded with a marker so consumers can distinguish
- **Risk:** P1 — errors silently swallowed
- **Changes:**
  - In `readSseStream`: after yielding error chunk, mark generator as done (already does `return`)
  - Ensure `chatWithWikiStream` and `chatWithLLMStream` propagate errors
- **Rollback:** Revert error handling

### Task 2.3 | Harden `parseSseEvent` for edge cases (BUG-3, BUG-8)
- **Input:** Current parser
- **Output:** More robust parser
- **Risk:** P0 — data loss on malformed SSE
- **Changes:**
  - Guard `JSON.parse` to only handle objects (reject arrays/primitives)
  - Add `try/catch` around the entire parse with a console.warn for debugging
  - The current buffer + `\n\n` split approach is actually correct for SSE spec; just add the JSON guard
- **Rollback:** Revert parser

### Task 2.4 | Type hardening for `WikiChatChunk` (BUG-11)
- **Input:** Current all-optional interface
- **Output:** Discriminated union type
- **Risk:** P2 — type safety
- **Changes:**
  ```typescript
  export type WikiChatChunk =
    | { type: 'chunk'; chunk: string }
    | { type: 'sources'; sources: WikiChatSource[] }
    | { type: 'status'; status: string }
    | { type: 'error'; error: string }
    | { type: 'done' };
  ```
  - Update `parseSseEvent` to return typed chunks
  - Update consumers in `SearchPage.tsx`
- **Rollback:** Revert to flat interface

---

## Phase 3: SearchPage State Management (`SearchPage.tsx`)

### Task 3.1 | Fix stale closure (BUG-1) + mutable object (BUG-2)
- **Input:** Current `handleChatSend` with closure over `chatEntries`
- **Output:** Reliable state updates using functional `setChatEntries` and immutable copies
- **Risk:** P0 — message loss on rapid sends
- **Changes:**
  - Use `setChatEntries(prev => ...)` functional updates throughout
  - Build assistant entry immutably: accumulate content in a local `let` variable, spread into new object each iteration
  - Use `crypto.randomUUID()` or `Date.now()` for `id` field
  - Remove `chatEntries` from useCallback deps (no longer needed with functional updates)
- **Rollback:** Revert to snapshot-based updates

### Task 3.2 | Fix contextPages only on first message (BUG-4)
- **Input:** Current `contextPages` logic only fires when `chatEntries.length === 0`
- **Output:** Always provide context pages when available
- **Risk:** P1 — RAG quality degradation after first message
- **Changes:**
  - Always pass `results.slice(0, 5).map(r => r.item.path)` as contextPages
  - Backend `_search_wiki` will also provide fallback if contextPages is empty
- **Rollback:** Revert to first-message-only

### Task 3.3 | Fix query fallback ambiguity (BUG-5)
- **Input:** `const msg = chatInput.trim() || query.trim()`
- **Output:** Only use `chatInput`; if empty, don't send
- **Risk:** P1 — unintended message send
- **Changes:**
  - Change to `const msg = chatInput.trim()`
  - If user presses Enter in the main search input while on chat tab, populate chatInput from query first, then send
  - In the main search input's `onKeyDown`, set `chatInput` to `query` before calling `handleChatSend` when on chat tab
- **Rollback:** Revert to fallback logic

### Task 3.4 | Cancel stream on tab switch (BUG-6)
- **Input:** Current cleanup only on unmount
- **Output:** Abort stream when switching away from chat tab
- **Risk:** P1 — background resource consumption
- **Changes:**
  - In `handleTabChange`, if switching away from 'chat' and `chatStreaming`, call `abortRef.current?.abort()`
- **Rollback:** Remove abort call

### Task 3.5 | Handle error chunks in streaming loop (BUG-13)
- **Input:** Current for-await loop ignores `chunk.error`
- **Output:** Error chunks displayed as assistant error message
- **Risk:** P1 — errors invisible to user
- **Changes:**
  - Add `if (chunk.type === 'error')` check (after discriminated union change)
  - Set assistant entry content to error message and break
- **Rollback:** Remove error check

---

## Phase 4: ChatTab UI Fixes (`ChatTab.tsx`)

### Task 4.1 | Use `id` as React key (BUG-10)
- **Changes:** `key={entry.id}` instead of `key={i}`

### Task 4.2 | Improve loading indicator (BUG-12)
- **Changes:** Show loading when `chatLoading && chatStreaming` regardless of content state

### Task 4.3 | Improve scroll behavior (UX-1)
- **Changes:** Use `requestAnimationFrame` + `scrollIntoView` for smoother streaming scroll

### Task 4.4 | Use stable keys for example buttons (UX-2)
- **Changes:** Use `ex` as key instead of `i`

---

## Phase 5: Backend Fix (`api_server.py`)

### Task 5.1 | Fix duplicate user message (BUG-9)
- **Input:** Current code appends `query` after iterating `payload.messages`
- **Output:** Only append `query` if it's not already the last user message
- **Risk:** P1 — LLM receives duplicate input
- **Changes:**
  ```python
  last_user_msg = next((m.content for m in reversed(payload.messages) if m.role == "user"), None)
  if last_user_msg != query:
      full_messages.append({"role": "user", "content": query})
  ```
- **Rollback:** Revert to always-append

---

## Phase 6: Verification

### Task 6.1 | Run frontend lint + typecheck
- `cd wiki-viewer && npm run lint`
- `npx tsc --noEmit` (if available)

### Task 6.2 | Manual verification checklist
- [ ] Send a chat message → verify streaming works
- [ ] Send a second message → verify first message preserved
- [ ] Rapid double-send → verify no message loss
- [ ] Switch tabs during streaming → verify stream stops
- [ ] Backend error → verify error shown in UI
- [ ] Empty input → verify no unintended send

---

## Build Order
```
Phase 1 (types) → Phase 2 (chatService) → Phase 3 (SearchPage) → Phase 4 (ChatTab) → Phase 5 (api_server) → Phase 6 (verify)
```

## Assumptions
- `crypto.randomUUID()` is available in the browser (supported in all modern browsers + localhost)
- Backend `api_server.py` changes are backward-compatible with existing frontend
- No external dependencies need to be added
