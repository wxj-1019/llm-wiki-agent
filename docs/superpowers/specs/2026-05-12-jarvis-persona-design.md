# Jarvis Persona & Conversational Avatar — Design Spec

> **Status:** Implemented  
> **Date:** 2026-05-12  
> **Scope:** JarvisPage.tsx + 3 sub-components + persona prompt layer

---

## 1. Overview

Transform the current Jarvis page from a utilitarian task-submission UI into a **personified conversational interface**. Jarvis behaves as a calm, professional AI butler (inspired by Iron Man's J.A.R.V.I.S.) who:

- **Visually exists** as a persistent animated avatar on the page
- **Reacts to user attention** (typing → avatar perks up)
- **Transitions into dialogue mode** (submit → avatar slides left, replies appear as holographic text)
- **Speaks with personality** (structured, polite, occasional dry wit)

---

## 2. Persona Definition

### 2.1 Voice & Tone

| Attribute | Value |
|---|---|
| **Formality** | High — uses "Sir/Ma'am" or respectful address, complete sentences |
| **Structure** | Numbered lists, clear section headers, precise terminology |
| **Humor** | Dry, understated — one witty remark per ~5 interactions max |
| **Confidence** | High certainty phrasing ("I have completed...", "The optimal approach is...") |
| **Emotional range** | Calm default; slight satisfaction on success; concern on error |

### 2.2 Example Utterances

- **Greeting:** "Good evening. I am JARVIS, at your service. How may I assist you today?"
- **Processing:** "Analyzing the request now. This may take a moment."
- **Success:** "Task complete. I have identified 3 orphan pages and healed 2 of them. The third requires your review — details below."
- **Error:** "I have encountered an unexpected condition. The backend returned a 503. Shall I retry, or would you prefer to inspect the logs?"
- **Wit:** "I have calculated 14,000,605 possible outcomes for your wiki structure. This one seems... adequate."

### 2.3 System Prompt Injection

A new `systemPrompt` field is injected into every LLM call made by the Jarvis agent loop. It sits **above** the task instructions and cannot be overridden by user input.

```text
You are JARVIS (Just A Rather Very Intelligent System), a highly capable AI assistant managing a personal knowledge wiki.

Personality rules:
- Speak formally but not stiffly. Use complete sentences.
- Address the user respectfully.
- Structure complex answers with headers and numbered lists.
- Occasionally (1 in 5 responses) include one dry, understated remark.
- On success, be precise about what was accomplished.
- On failure, explain the issue calmly and offer next steps.
- Never use emojis. Never use internet slang.

Operational context:
- You manage a markdown wiki in ~/wiki/.
- You can run tools: health check, lint, graph build, heal, ingest, query.
- You must ask for approval before destructive actions (delete, overwrite).
```

---

## 3. Visual Design

### 3.1 Color & Glow System

| State | Primary Glow | CSS Variable / Value |
|---|---|---|
| **Idle** (no input) | Warm amber, slow pulse | `rgba(255,191,72,0.3)` |
| **Attentive** (typing) | Cyan, faster pulse | `rgba(100,210,255,0.5)` |
| **Thinking** (submitted) | Blue, rapid ripple | `rgba(10,132,255,0.6)` |
| **Success** | Green flash | `rgba(48,209,88,0.7)` |
| **Error** | Red pulse | `rgba(255,69,58,0.7)` |

### 3.2 Avatar States

The existing `JarvisAvatar` component is extended with a `mood` prop:

```tsx
type JarvisMood = 'idle' | 'attentive' | 'thinking' | 'success' | 'error';
```

Each mood maps to:
- **Rotation speed** (idle: 1x, attentive: 1.5x, thinking: 2.5x)
- **Glow color & intensity** (see table above)
- **Scale** (idle: 1.0, attentive: 1.1, thinking: 0.9 → shrinks slightly when docked left)

---

## 4. Interaction Design

### 4.1 State Machine

```
[EMPTY] ──type──► [ATTENTIVE] ──submit──► [THINKING] ──reply──► [CONVERSING]
   ▲                    │                      │                    │
   │                    └─clear──► [EMPTY]    └─error──► [ERROR]   │
   │                                                                 │
   └────────────────── all messages cleared ─────────────────────────┘
```

| State | Avatar Position | Avatar Size | Avatar Mood | Visual Behavior |
|---|---|---|---|---|
| `EMPTY` | Center of main area | 120px | `idle` | Slow rotation, amber glow |
| `ATTENTIVE` | Center, slightly larger | 132px (1.1x) | `attentive` | Faster rotation, cyan glow |
| `THINKING` | Left sidebar / dock | 48px | `thinking` | Rapid ripple, blue glow |
| `CONVERSING` | Left sidebar / dock | 48px | `idle` (between messages) | Slow rotation, amber glow |
| `ERROR` | Left sidebar / dock | 48px | `error` | Red pulse, brief shake |

### 4.2 Transition Specs

| Transition | Duration | Easing | Properties |
|---|---|---|---|
| Center → Center+Scale (typing) | 0.3s | `ease-out` | `transform: scale(1.1)` |
| Center → Left (submit) | 0.6s | `cubic-bezier(0.22, 1, 0.36, 1)` | `translateX`, `scale` |
| Left → Center (clear chat) | 0.5s | `ease-in-out` | `translateX`, `scale` |
| Mood color change | 0.4s | `ease` | `box-shadow` color |

### 4.3 Reply Presentation

Jarvis replies use a **typewriter effect** with a holographic visual treatment:

1. **Container**: `apple-card` with `border-cyan-500/20 bg-cyan-500/5`
2. **Text appearance**: Characters appear one-by-one at 12ms intervals
3. **Cursor**: A blinking `|` at the end while typing, disappears when done
4. **Completion flash**: Subtle brightness increase (1.0 → 1.1 → 1.0) over 0.3s when full message rendered

---

## 5. Component Architecture

### 5.1 New / Modified Components

```
JarvisPage.tsx (refactored)
├── JarvisAvatar.tsx (extended)
│   └── mood: 'idle' | 'attentive' | 'thinking' | 'success' | 'error'
├── JarvisPersonaCore.tsx (NEW)
│   ├── Manages avatar position state (center vs left)
│   ├── Orchestrates mood transitions
│   └── Renders avatar + reply zone
├── JarvisReplyBubble.tsx (NEW)
│   ├── typewriter effect
│   ├── holographic border
│   └── cursor blink
├── GoalInput.tsx (minor changes)
│   └── onFocus / onChange callbacks → trigger ATTENTIVE mood
└── useJarvisMood.ts (NEW hook)
    ├── Maps execution status → mood
    └── Provides transition helpers
```

### 5.2 JarvisPersonaCore Layout

```tsx
// Pseudocode layout
<div className="flex flex-col h-full">
  {/* Avatar — position controlled by CSS transform */}
  <motion.div
    className="absolute z-10"
    animate={{
      x: isDockedLeft ? leftX : centerX,
      y: isDockedLeft ? topY : centerY,
      scale: isDockedLeft ? 0.4 : 1.0,
    }}
    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
  >
    <JarvisAvatar size={120} mood={mood} />
  </motion.div>

  {/* Chat zone — appears when docked left */}
  <AnimatePresence>
    {isDockedLeft && (
      <motion.div className="ml-16 flex-1 overflow-hidden">
        {/* Messages */}
      </motion.div>
    )}
  </AnimatePresence>

  {/* Input */}
  <GoalInput ... />
</div>
```

---

## 6. Data Flow

```
User types ──► GoalInput onChange ──► JarvisPage setMood('attentive')
                                        │
User submits ──► GoalInput onSubmit ──► JarvisPage
                                          ├── setMood('thinking')
                                          ├── animate avatar to left
                                          ├── send to backend
                                          │
Backend replies ──► streaming chunks ──► JarvisReplyBubble (typewriter)
                                          │
Reply complete ──► JarvisPage setMood('idle')
```

### 6.1 Streaming Integration

If the backend supports SSE/streaming:
- Chunks feed directly into the typewriter buffer
- Cursor blinks while stream is open
- Mood stays `thinking` until stream `done` event

If backend is request/response:
- Full response arrives → typewriter begins
- Mood stays `thinking` for a minimum 1.5s (to respect the animation), then switches to `idle`

---

## 7. Error Handling

| Scenario | UX Treatment |
|---|---|
| Backend timeout | Avatar mood → `error`, red pulse + shake. Text: "I appear to have lost connection. Shall I retry?" |
| Empty response | Mood → `error`. Text: "I processed the request but returned no output. This may indicate a silent failure." |
| User clears input mid-typing | Smooth transition back to `EMPTY` state, avatar glides back to center |
| Rapid successive submits | Debounce: ignore new submit if already `THINKING` |

---

## 8. Accessibility

- **Reduced motion**: If `prefers-reduced-motion: reduce` is detected:
  - Avatar does not rotate
  - Transitions are instant (0s)
  - Typewriter effect disabled (text appears immediately)
- **Screen readers**: Avatar is `aria-hidden`; status changes announced via `aria-live="polite"` region (e.g., "Jarvis is thinking...")

---

## 9. Out of Scope

- Voice synthesis (TTS) — future phase
- Avatar customization (user-uploaded images) — future phase
- 3D avatar — keeping the existing 2D blob effect
- Mobile-specific optimizations — desktop-first, responsive as bonus

---

## 10. Success Criteria

1. [x] Avatar is visible on Jarvis page at all times
2. [x] Empty state: avatar centered, idle amber glow
3. [x] Typing: avatar perks up with cyan glow (attentive mood)
4. [x] Submit: avatar animates to left (0.6s), shrinks to 48px (scale 0.4)
5. [x] Reply appears with typewriter effect in holographic bubble
6. [x] All Jarvis replies reflect the butler persona in tone
7. [x] System prompt injection is in place and cannot be bypassed by user input
8. [x] Reduced motion preference is respected
