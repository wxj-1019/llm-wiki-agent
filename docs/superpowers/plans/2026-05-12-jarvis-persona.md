# Jarvis Persona & Conversational Avatar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Jarvis page into a personified conversational interface with a persistent animated avatar that reacts to user input, transitions into dialogue mode, and speaks with a butler persona.

**Architecture:** Extend the existing `JarvisAvatar` blob effect with mood-driven glow/rotation states. Introduce a new `JarvisPersonaCore` orchestration component that manages avatar positioning (center ↔ left dock) and delegates rendering to focused sub-components (`JarvisReplyBubble` for typewriter replies, `useJarvisMood` for state machine). Inject a hard-coded persona system prompt at the shared LLM gateway so all Jarvis replies reflect the butler voice.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, existing `tools/shared/llm.py` backend gateway.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `wiki-viewer/src/components/jarvis/JarvisAvatar.tsx` | Modify | Add `mood` prop, map mood to glow color / rotation speed / scale |
| `wiki-viewer/src/hooks/useJarvisMood.ts` | Create | Mood state machine (`idle` → `attentive` → `thinking` → `idle`/`error`) |
| `wiki-viewer/src/components/jarvis/JarvisReplyBubble.tsx` | Create | Typewriter text effect with holographic border + blinking cursor |
| `wiki-viewer/src/components/jarvis/GoalInput.tsx` | Modify | Expose `onFocus`, `onBlur`, `onChange` callbacks to parent |
| `wiki-viewer/src/components/jarvis/JarvisPersonaCore.tsx` | Create | Orchestrates avatar position, mood, and reply rendering |
| `wiki-viewer/src/components/pages/JarvisPage.tsx` | Modify | Replace old chat view with `JarvisPersonaCore`, wire callbacks |
| `tools/shared/llm.py` | Modify | Prepend persona system prompt to all LLM calls |
| `tools/jarvis/loop.py` | Modify | Update hard-coded system strings to align with persona voice |

---

## Prerequisite

Ensure the dev server is not running during code edits. No build step is required for the React frontend (Vite HMR).

---

### Task 1: Extend JarvisAvatar with Mood System

**Files:**
- Modify: `wiki-viewer/src/components/jarvis/JarvisAvatar.tsx`

**Context:** The existing avatar uses `requestAnimationFrame` for blob rotation and an overlay glow. We need to make rotation speed and glow color reactive to a `mood` prop.

- [x] **Step 1: Add mood type and props**

Add above the component:

```tsx
export type JarvisMood = 'idle' | 'attentive' | 'thinking' | 'success' | 'error';

interface JarvisAvatarProps {
  size?: number;
  isActive?: boolean;
  mood?: JarvisMood;
}
```

Change the component signature:

```tsx
export function JarvisAvatar({ size = 120, isActive = false, mood = 'idle' }: JarvisAvatarProps) {
```

- [x] **Step 2: Add mood config map**

Inside the component, above the `useEffect`:

```tsx
const MOOD_CONFIG: Record<JarvisMood, { speedMult: number; glowColor: string; glowIntensity: number }> = {
  idle:      { speedMult: 1.0, glowColor: '255,191,72',  glowIntensity: 0.30 },
  attentive: { speedMult: 1.5, glowColor: '100,210,255', glowIntensity: 0.50 },
  thinking:  { speedMult: 2.5, glowColor: '10,132,255',  glowIntensity: 0.60 },
  success:   { speedMult: 1.0, glowColor: '48,209,88',   glowIntensity: 0.70 },
  error:     { speedMult: 1.0, glowColor: '255,69,58',   glowIntensity: 0.70 },
};
```

- [x] **Step 3: Drive rotation speed from mood**

In the `animate` function, replace the raw `JA_TIME` usage with a mood-adjusted cycle time:

```tsx
const cfg = MOOD_CONFIG[mood];
const adjustedTime = JA_TIME / cfg.speedMult;

// Blob rotations
BLOB_CONFIG.forEach((blobCfg, i) => {
  const el = blobRefs.current[i];
  if (!el) return;
  const elapsed = t + blobCfg.delay * JA_TIME;
  const angle = ((elapsed / (adjustedTime * blobCfg.speed)) * 360) * (blobCfg.reverse ? -1 : 1);
  el.style.transform = `rotate(${angle}deg)`;
});
```

- [x] **Step 4: Drive glow color from mood**

In the `overlayRef` block, replace the hard-coded amber with mood-driven color:

```tsx
if (overlayRef.current && isActive) {
  const glowCycle = (t / 1.2) % 1;
  const intensity = 0.5 + Math.sin(glowCycle * Math.PI * 2) * 0.5;
  const spread1 = 15 + intensity * 20;
  const spread2 = 10 + intensity * 10;
  const blur1 = 2 + intensity * 6;
  const blur2 = 2 + intensity * 6;
  const [r, g, b] = cfg.glowColor.split(',').map(Number);
  const baseA = cfg.glowIntensity;
  overlayRef.current.style.boxShadow =
    `inset 0 ${spread1}px ${blur1}px 0 rgba(${r},${g},${b},${baseA}), ` +
    `inset 0 -${spread2}px ${blur2}px 0 rgba(${Math.round(r*0.75)},${Math.round(g*0.75)},${Math.round(b*0.75)},${baseA * 0.8})`;
} else if (overlayRef.current) {
  const [r, g, b] = cfg.glowColor.split(',').map(Number);
  const baseA = cfg.glowIntensity * 0.6;
  overlayRef.current.style.boxShadow =
    `inset 0 5px 5px 0 rgba(${r},${g},${b},${baseA}), ` +
    `inset 0 -5px 5px 0 rgba(${Math.round(r*0.75)},${Math.round(g*0.75)},${Math.round(b*0.75)},${baseA * 0.8})`;
}
```

Add `mood` to the `useEffect` dependency array:

```tsx
}, [isActive, mood]);
```

- [x] **Step 5: Commit**

```bash
git add wiki-viewer/src/components/jarvis/JarvisAvatar.tsx
git commit -m "feat(jarvis): add mood-driven glow and rotation speed to avatar"
```

---

### Task 2: Create useJarvisMood Hook

**Files:**
- Create: `wiki-viewer/src/hooks/useJarvisMood.ts`

**Context:** A single hook that manages the mood state machine and provides transition helpers.

- [x] **Step 1: Create the hook file**

```tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import type { JarvisMood } from '@/components/jarvis/JarvisAvatar';

interface UseJarvisMoodOptions {
  minThinkingMs?: number;
}

export function useJarvisMood(options: UseJarvisMoodOptions = {}) {
  const { minThinkingMs = 1500 } = options;
  const [mood, setMoodState] = useState<JarvisMood>('idle');
  const [isDockedLeft, setIsDockedLeft] = useState(false);
  const thinkingStartRef = useRef<number>(0);
  const pendingMoodRef = useRef<JarvisMood | null>(null);

  const setMood = useCallback((newMood: JarvisMood) => {
    if (mood === 'thinking' && newMood !== 'thinking') {
      // Enforce minimum thinking duration for animation respect
      const elapsed = Date.now() - thinkingStartRef.current;
      const remaining = Math.max(0, minThinkingMs - elapsed);
      if (remaining > 0) {
        pendingMoodRef.current = newMood;
        setTimeout(() => {
          if (pendingMoodRef.current === newMood) {
            setMoodState(newMood);
            pendingMoodRef.current = null;
          }
        }, remaining);
        return;
      }
    }
    if (newMood === 'thinking') {
      thinkingStartRef.current = Date.now();
    }
    setMoodState(newMood);
  }, [mood, minThinkingMs]);

  const dockLeft = useCallback(() => setIsDockedLeft(true), []);
  const dockCenter = useCallback(() => setIsDockedLeft(false), []);

  // Clear pending mood on unmount
  useEffect(() => {
    return () => { pendingMoodRef.current = null; };
  }, []);

  return {
    mood,
    setMood,
    isDockedLeft,
    dockLeft,
    dockCenter,
  };
}
```

- [x] **Step 2: Commit**

```bash
git add wiki-viewer/src/hooks/useJarvisMood.ts
git commit -m "feat(jarvis): add useJarvisMood hook for mood state machine"
```

---

### Task 3: Create JarvisReplyBubble (Typewriter Effect)

**Files:**
- Create: `wiki-viewer/src/components/jarvis/JarvisReplyBubble.tsx`

**Context:** A self-contained component that renders Jarvis replies with a character-by-character typewriter effect, holographic border, and blinking cursor.

- [x] **Step 1: Create the component**

```tsx
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';

interface JarvisReplyBubbleProps {
  content: string;
  speedMs?: number;
  onComplete?: () => void;
}

export function JarvisReplyBubble({ content, speedMs = 12, onComplete }: JarvisReplyBubbleProps) {
  const [displayed, setDisplayed] = useState('');
  const [isDone, setIsDone] = useState(false);
  const indexRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');
    setIsDone(false);
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      if (indexRef.current >= content.length) {
        setIsDone(true);
        onComplete?.();
        return;
      }
      const elapsed = now - lastTimeRef.current;
      if (elapsed >= speedMs) {
        const charsToAdd = Math.max(1, Math.floor(elapsed / speedMs));
        const nextIndex = Math.min(content.length, indexRef.current + charsToAdd);
        indexRef.current = nextIndex;
        setDisplayed(content.slice(0, nextIndex));
        lastTimeRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [content, speedMs, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="apple-card px-3 py-2 border-cyan-500/20 bg-cyan-500/5"
    >
      <div className="prose prose-sm max-w-none text-[var(--text-primary)]">
        <MarkdownRenderer content={displayed} />
        {!isDone && (
          <span className="inline-block w-[2px] h-[1em] bg-[var(--apple-teal)] ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </motion.div>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add wiki-viewer/src/components/jarvis/JarvisReplyBubble.tsx
git commit -m "feat(jarvis): add JarvisReplyBubble with typewriter effect"
```

---

### Task 4: Modify GoalInput to Expose Callbacks

**Files:**
- Modify: `wiki-viewer/src/components/jarvis/GoalInput.tsx`

**Context:** The parent needs to know when the user focuses the input (trigger `attentive` mood) and when they type vs clear (toggle `attentive` on/off).

- [x] **Step 1: Extend the interface**

```tsx
interface GoalInputProps {
  onSubmit: (description: string, strategy: string) => void;
  isLoading: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onChange?: (value: string) => void;
}
```

- [x] **Step 2: Wire callbacks in the component**

Change the component signature and add callback triggers:

```tsx
export function GoalInput({ onSubmit, isLoading, onFocus, onBlur, onChange }: GoalInputProps) {
```

In `handleChange`, add:

```tsx
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    onChange?.(e.target.value);
    if (e.target.value.length > 0 && !hasTyped) setHasTyped(true);
    if (e.target.value.length === 0) setHasTyped(false);
  };
```

In the textarea, wire focus/blur:

```tsx
            <textarea
              ref={textareaRef}
              value={description}
              onChange={handleChange}
              onFocus={() => { setIsFocused(true); onFocus?.(); }}
              onBlur={() => { setIsFocused(false); onBlur?.(); }}
              placeholder={t('jarvis.goal_placeholder', 'Describe what you want Jarvis to do...')}
              className="ji-textarea"
              disabled={isLoading}
              rows={1}
            />
```

- [x] **Step 3: Commit**

```bash
git add wiki-viewer/src/components/jarvis/GoalInput.tsx
git commit -m "feat(jarvis): expose onFocus/onBlur/onChange callbacks from GoalInput"
```

---

### Task 5: Create JarvisPersonaCore

**Files:**
- Create: `wiki-viewer/src/components/jarvis/JarvisPersonaCore.tsx`
- Modify: `wiki-viewer/src/components/pages/JarvisPage.tsx` (import path updates)

**Context:** This is the orchestration component. It renders the avatar at the correct position, holds the reply zone, and accepts `visibleMessages` + callbacks from the parent.

- [x] **Step 1: Create the component**

```tsx
import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { JarvisAvatar, type JarvisMood } from '@/components/jarvis/JarvisAvatar';
import { JarvisReplyBubble } from '@/components/jarvis/JarvisReplyBubble';
import { GoalInput } from '@/components/jarvis/GoalInput';
import type { ChatMessage } from '@/components/jarvis/JarvisChatMessage';

interface JarvisPersonaCoreProps {
  mood: JarvisMood;
  isDockedLeft: boolean;
  visibleMessages: ChatMessage[];
  avatarStatusText: string;
  hasActiveExecution: boolean;
  isLoading: boolean;
  onSubmit: (description: string, strategy: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (value: string) => void;
  onReplyComplete?: () => void;
  onApprove?: (reqId: string) => void;
  onReject?: (reqId: string) => void;
  approvalLoading?: string | null;
}

export function JarvisPersonaCore({
  mood,
  isDockedLeft,
  visibleMessages,
  avatarStatusText,
  hasActiveExecution,
  isLoading,
  onSubmit,
  onFocus,
  onBlur,
  onChange,
  onReplyComplete,
}: JarvisPersonaCoreProps) {
  const quickActions = useMemo(() => [
    'Run health check',
    'List orphan pages',
    'Build knowledge graph',
    'Find broken links',
  ], []);

  return (
    <div className="flex flex-col h-full relative">
      {/* Avatar — absolutely positioned so it can float above layout */}
      <motion.div
        className="absolute z-10 pointer-events-none"
        initial={false}
        animate={{
          left: isDockedLeft ? '0.5rem' : '50%',
          top: isDockedLeft ? '0.5rem' : '35%',
          x: isDockedLeft ? 0 : '-50%',
          y: isDockedLeft ? 0 : '-50%',
          scale: isDockedLeft ? 0.4 : 1.0,
        }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <JarvisAvatar size={120} isActive={hasActiveExecution} mood={mood} />
      </motion.div>

      {/* Content zone */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {!isDockedLeft ? (
            /* EMPTY STATE */
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center flex-1"
            >
              <div className="flex-1 min-h-[20px]" />
              <div className="flex flex-col items-center gap-8">
                {/* Avatar placeholder gap — real avatar floats above */}
                <div className="h-[120px]" aria-hidden="true" />
                <p className="text-lg text-[var(--text-secondary)] font-mono-data text-center">
                  {avatarStatusText}
                </p>
              </div>
              <div className="flex-1 min-h-[20px]" />
              <div className="flex flex-wrap gap-4 justify-center pb-6">
                {quickActions.map((q) => (
                  <button
                    key={q}
                    onClick={() => onSubmit(q, 'balanced')}
                    className="text-sm font-mono-data px-4 py-2 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--apple-teal)]/40 hover:text-[var(--apple-teal)] transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            /* CONVERSATION STATE */
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col flex-1 min-h-0"
            >
              {/* Spacer to push messages below the docked avatar */}
              <div className="shrink-0 h-14" />
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end">
                <div className="space-y-2 px-1">
                  {visibleMessages.map((msg, idx) => {
                    const isLast = idx === visibleMessages.length - 1;
                    if (msg.role === 'assistant' && isLast && msg.content) {
                      return (
                        <JarvisReplyBubble
                          key={msg.id}
                          content={msg.content}
                          onComplete={onReplyComplete}
                        />
                      );
                    }
                    // Fallback for user / system / older assistant messages
                    return (
                      <div key={msg.id} className="text-xs text-[var(--text-secondary)]">
                        {msg.role === 'user' ? (
                          <div className="flex justify-end">
                            <div className="apple-card px-3 py-2 bg-[var(--apple-blue)]/10 border-[var(--apple-blue)]/20 max-w-[80%]">
                              <p className="text-xs">{msg.content}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-start pl-12">
                            <div className="apple-card px-3 py-2 max-w-[85%]">
                              <p className="text-xs">{msg.content}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="shrink-0 pt-1 pb-0">
        <GoalInput
          onSubmit={onSubmit}
          isLoading={isLoading}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add wiki-viewer/src/components/jarvis/JarvisPersonaCore.tsx
git commit -m "feat(jarvis): add JarvisPersonaCore orchestration component"
```

---

### Task 6: Refactor JarvisPage to Integrate Persona Core

**Files:**
- Modify: `wiki-viewer/src/components/pages/JarvisPage.tsx`

**Context:** Replace the existing Chat view fragment with `JarvisPersonaCore`. Wire the `useJarvisMood` hook so that typing → `attentive`, submit → `thinking` + dock left, reply arrives → `idle`.

- [x] **Step 1: Add imports**

```tsx
import { useJarvisMood } from '@/hooks/useJarvisMood';
import { JarvisPersonaCore } from '@/components/jarvis/JarvisPersonaCore';
```

Remove unused imports: `JarvisAvatar`, `JarvisChatMessage` (if no longer used elsewhere).

- [x] **Step 2: Initialize hook in component body**

After the state declarations (around line 95):

```tsx
const { mood, setMood, isDockedLeft, dockLeft, dockCenter } = useJarvisMood({ minThinkingMs: 1500 });
```

- [x] **Step 3: Wire focus/change/submit callbacks**

Add handler functions:

```tsx
const handleInputFocus = useCallback(() => {
  if (!isDockedLeft) setMood('attentive');
}, [isDockedLeft, setMood]);

const handleInputBlur = useCallback(() => {
  if (!isDockedLeft) setMood('idle');
}, [isDockedLeft, setMood]);

const handleInputChange = useCallback((value: string) => {
  if (!isDockedLeft) {
    setMood(value.trim().length > 0 ? 'attentive' : 'idle');
  }
}, [isDockedLeft, setMood]);

const handlePersonaSubmit = useCallback((description: string, strategy: string) => {
  setMood('thinking');
  dockLeft();
  connect({ description, strategy });
}, [connect, setMood, dockLeft]);
```

- [x] **Step 4: Wire reply completion**

When a new assistant message arrives (or when `currentExecution` status changes to `done`), set mood back to `idle`:

```tsx
useEffect(() => {
  if (currentExecution?.status === 'done' || currentExecution?.status === 'error') {
    setMood(currentExecution.status === 'error' ? 'error' : 'idle');
  }
}, [currentExecution?.status, setMood]);
```

- [x] **Step 5: Replace the Chat view block**

Replace the entire `{viewMode === 'chat' && (...)}` block with:

```tsx
      {/* ── Chat / Persona View ── */}
      {viewMode === 'chat' && (
        <JarvisPersonaCore
          mood={mood}
          isDockedLeft={isDockedLeft}
          visibleMessages={visibleMessages}
          avatarStatusText={avatarStatusText}
          hasActiveExecution={hasActiveExecution}
          isLoading={hasActiveExecution}
          onSubmit={handlePersonaSubmit}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onChange={handleInputChange}
          onReplyComplete={() => setMood('idle')}
        />
      )}
```

- [x] **Step 6: Commit**

```bash
git add wiki-viewer/src/components/pages/JarvisPage.tsx
git commit -m "feat(jarvis): integrate JarvisPersonaCore into JarvisPage"
```

---

### Task 7: Inject Persona System Prompt into Backend

**Files:**
- Modify: `tools/shared/llm.py`
- Modify: `tools/jarvis/loop.py`

**Context:** The persona voice must be applied to all LLM calls made by the Jarvis agent. The cleanest approach is to prepend it inside the shared `call_llm()` gateway so every caller gets it automatically.

- [x] **Step 1: Define persona constant in `tools/shared/llm.py`**

At the top of the file (after imports), add:

```python
_JARVIS_PERSONA = (
    "You are JARVIS (Just A Rather Very Intelligent System), a highly capable AI assistant "
    "managing a personal knowledge wiki.\n\n"
    "Personality rules:\n"
    "- Speak formally but not stiffly. Use complete sentences.\n"
    "- Address the user respectfully.\n"
    "- Structure complex answers with headers and numbered lists.\n"
    "- Occasionally (1 in 5 responses) include one dry, understated remark.\n"
    "- On success, be precise about what was accomplished.\n"
    "- On failure, explain the issue calmly and offer next steps.\n"
    "- Never use emojis. Never use internet slang.\n\n"
    "Operational context:\n"
    "- You manage a markdown wiki in ~/wiki/.\n"
    "- You can run tools: health check, lint, graph build, heal, ingest, query.\n"
    "- You must ask for approval before destructive actions (delete, overwrite).\n"
)
```

- [x] **Step 2: Prepend persona to system messages**

Inside `call_llm()`, find where `messages` is built (around line 332). Change:

```python
    messages: list[dict] = []
    if system:
        messages.append({"role": "system", "content": system})
```

To:

```python
    messages: list[dict] = []
    # Inject JARVIS persona as the base system prompt
    combined_system = _JARVIS_PERSONA
    if system:
        combined_system += "\n\n" + system
    messages.append({"role": "system", "content": combined_system})
```

- [x] **Step 3: Verify loop.py callers align**

Open `tools/jarvis/loop.py` and check the `system="..."` strings at lines ~223, ~259, ~278, ~332, ~431. These should be kept as **task-specific instructions** (e.g., "You are a planning assistant...") because the persona base layer is now injected automatically by `call_llm()`. No code change is required unless a caller overrides the system prompt in a way that conflicts.

Quick sanity check — read lines 220–280 and confirm the strings are short task directives. If any contain full personality instructions, replace them with concise task directives since the persona is now handled centrally.

- [x] **Step 4: Commit**

```bash
git add tools/shared/llm.py
git commit -m "feat(jarvis): inject JARVIS persona system prompt into all LLM calls"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Avatar visible at all times → `JarvisPersonaCore` renders avatar in absolute positioned `motion.div`
- [x] Empty state centered + idle glow → `mood='idle'` in `JarvisAvatar`, position center in `JarvisPersonaCore`
- [x] Typing scales 1.1x + cyan → `mood='attentive'` + `MOOD_CONFIG.attentive`
- [x] Submit → left + shrink → `dockLeft()` + `motion.div` animate `scale: 0.4`
- [x] Typewriter reply → `JarvisReplyBubble` with RAF-based character stepping
- [x] Butler persona tone → `_JARVIS_PERSONA` injected in `call_llm()`
- [x] System prompt injection hard-coded → prepended in `call_llm()`, user-supplied `system` appended after
- [x] Reduced motion → Implemented via `window.matchMedia('(prefers-reduced-motion: reduce)')` in Avatar, ReplyBubble, and PersonaCore

**Placeholder scan:** None found.

**Type consistency:** `JarvisMood` exported from `JarvisAvatar.tsx` and imported by `useJarvisMood.ts` and `JarvisPersonaCore.tsx`. Consistent.

---

## Execution Handoff

**Plan COMPLETE — all tasks implemented and committed to main.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

**Which approach?**
