# Jarvis Dashboard UI/UX Redesign Spec

> **Anchor:** Retro-Futuristic + Industrial hybrid. Deep void black with neon dual-tone accents (magenta for creation/evolution, cyan for computation/analysis), CRT scanline texture, committed glow, and a real-time terminal log stream.
>
> **Why this pairing:** Jarvis is not a dashboard — it is a living, self-optimizing intelligence. The Retro-Futuristic anchor gives it the "advanced AI from the future" feeling through neon glow and CRT texture. The Industrial log stream grounds it in observable reality — every thought, every tool call, every decision is visible and traceable. The tension between ethereal glow and raw terminal output is what makes this feel like a real machine, not a mockup.
>
> **Differentiator:** A persistent "neural pulse" bar at the top of the page. Every time Jarvis executes a tool call, a light ripple travels across the edge of the viewport. The pulse color encodes the tool's risk level (cyan=L0-L1, magenta=L2, amber=L3, red=L4). When idle, the bar breathes softly — the AI is alive, waiting.

---

## 1. Design System

### 1.1 Color Palette

```
Surface:
  --jarvis-void:        #0A0014    (primary background — deep navy-black)
  --jarvis-panel:       #0D0D1A    (card/panel background — slightly lifted)
  --jarvis-panel-hover: #121226    (panel hover state)
  --jarvis-grid:        rgba(0, 240, 255, 0.03)  (subtle grid lines)

Neon Accents (dual-tone):
  --jarvis-magenta:     #FF006E    (creative/evolution — insights, goals, learning)
  --jarvis-magenta-glow:#FF006E33  (glow shadow at 20% opacity)
  --jarvis-cyan:        #00F0FF    (computational — tools, cycles, status)
  --jarvis-cyan-glow:   #00F0FF33  (glow shadow at 20% opacity)

Signal Colors:
  --jarvis-green:       #00FF41    (success/online — phosphor green)
  --jarvis-amber:       #FFB000    (warning/pending)
  --jarvis-red:         #FF3B30    (error/danger)

Typography:
  --jarvis-text-primary:   #E8E0FF    (soft white with purple tint)
  --jarvis-text-secondary: #A090C0    (dimmed for labels)
  --jarvis-text-tertiary:  #605080    (very dimmed for metadata)
  --jarvis-text-dim:       #3A3050    (grid lines, inactive borders)

Borders:
  --jarvis-border:      rgba(0, 240, 255, 0.12)   (cyan-tinted borders)
  --jarvis-border-dim:  rgba(0, 240, 255, 0.06)   (subtle dividers)
```

### 1.2 Typography

- **Display / Headers:** `Orbitron, 'Space Grotesk', sans-serif` — geometric, wide, sci-fi. Used for page title, section headers, large numbers.
- **Body / Labels:** `'Inter', 'SF Pro Text', system-ui, sans-serif` — clean, readable at small sizes.
- **Monospace / Terminal:** `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace` — for logs, timestamps, code blocks, tool names.
- **Numeric:** `font-variant-numeric: tabular-nums` everywhere numbers appear.

### 1.3 Texture Effects

**CRT Scanline Overlay:**
```css
.jarvis-crt::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.15) 2px,
    rgba(0, 0, 0, 0.15) 4px
  );
}
```

**Glow Treatment:**
```css
.jarvis-glow-magenta { text-shadow: 0 0 12px var(--jarvis-magenta-glow), 0 0 24px var(--jarvis-magenta-glow); }
.jarvis-glow-cyan    { text-shadow: 0 0 12px var(--jarvis-cyan-glow),    0 0 24px var(--jarvis-cyan-glow); }
```

**Panel Border:**
```css
.jarvis-panel {
  background: var(--jarvis-panel);
  border: 1px solid var(--jarvis-border);
  border-radius: 4px;  /* sharp, not rounded */
  position: relative;
}
.jarvis-panel::before {
  /* subtle top-edge glow */
  content: '';
  position: absolute;
  top: 0; left: 8px; right: 8px; height: 1px;
  background: linear-gradient(90deg, transparent, var(--jarvis-cyan), transparent);
  opacity: 0.3;
}
```

---

## 2. Layout Structure

### 2.1 Viewport Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  [Neural Pulse Bar] — full-width, 2px height, top edge      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │
│  │  JARVIS           [Chat] [Dashboard] [Terminal]     │  │  ← Header
│  └─────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────┐ │
│  │                             │  │                     │ │
│  │    Main Content Area        │  │   Terminal Log      │ │
│  │    (Tab-dependent)          │  │   Stream (fixed     │ │
│  │                             │  │   right panel,      │ │
│  │                             │  │   320px, collapsible)│ │
│  │                             │  │                     │ │
│  └─────────────────────────────┘  └─────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Tab System (Redesigned)

Three tabs, styled as segmented control with neon active indicator:

```
┌──────────┬────────────┬───────────┐
│  ◆ CHAT  │ ◇ DASHBOARD│ ◇ TERMINAL│
└──────────┴────────────┴───────────┘
         ↑ active tab has cyan bottom-border glow
```

- **Chat:** Full conversational interface with goal input, execution panel, markdown rendering
- **Dashboard:** System status, metrics, goals, learning — the original dashboard content reorganized
- **Terminal:** Full-screen terminal log stream (also visible as side panel in other tabs)

### 2.3 Terminal Log Stream (Side Panel)

Fixed right panel, 320px wide, collapsible via toggle button.

```
┌─ Terminal Stream ───────────────────┐
│ 12:34:05.240  [SYS]  cycle_start    │
│ 12:34:05.245  [PLN]  plan_ready    │
│ 12:34:05.310  [EXE]  ▶ web_search  │
│ 12:34:07.891  [EXE]  ✓ web_search  │
│ 12:34:07.895  [RFL]  reflection     │
│ 12:34:08.102  [APV]  ⚠ approval_req│ ← pending approval
│ 12:34:38.102  [APV]  ✗ timeout      │ ← rejected after 30s
│ ...                                 │
│                                     │
│ [Auto-scroll ▼]  [Clear]  [Filter] │
└─────────────────────────────────────┘
```

**Log Line Format:**
```
[TIMESTAMP]  [TAG]  [STATUS_ICON]  message
```

Tags: `SYS` (system, cyan), `PLN` (planner, magenta), `EXE` (execution, cyan), `RFL` (reflection, magenta), `APV` (approval, amber), `LRN` (learning, green), `ERR` (error, red)

Status icons: `▶` running, `✓` success, `✗` failed, `⚠` warning/approval, `⋯` waiting

**Typing effect:** New log lines appear character-by-character (15ms per char) for the first 60 chars, then instant — simulates a real terminal.

---

## 3. Dashboard Tab Components

### 3.1 Agent Status Card (Hero)

Large, prominent card occupying full top width.

```
┌─ AGENT STATUS ────────────────────────────────────────────┐
│                                                           │
│    ◉ RUNNING                      [Stop] [Pause]         │
│                                                           │
│    ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐       │
│    │ 1,247  │  │  94.2% │  │  1.2s  │  │   3    │       │
│    │ CYCLES │  │SUCCESS │  │  AVG   │  │PENDING │       │
│    └────────┘  └────────┘  └────────┘  └────────┘       │
│                                                           │
│    Last cycle: 12:34:05  |  Safety: ✓  |  Budget: 12%   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- State indicator: large glowing dot (●) with pulse animation when running
- Big numbers in Orbitron, tabular-nums
- Subtle grid background pattern inside the card

### 3.2 Neural Activity Graph

Replace static stat cards with a live-updating sparkline graph showing cycle activity over time.

```
┌─ NEURAL ACTIVITY ─────────────────────────────────────────┐
│                                                           │
│          ╱╲        ╱╲╱╲         ╱╲╱╲╱╲                   │
│    ╱╲   ╱  ╲  ╱╲  ╱      ╱╲  ╱╱        ╲                │
│   ╱  ╲_╱    ╲╱  ╲╱      ╱  ╲╱                              │
│  ──────────────────────────────────────────────────────   │
│  10:00      11:00      12:00      13:00      14:00       │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- Line color: gradient from cyan to magenta based on activity intensity
- Area fill: low-opacity gradient under the line
- Updates every 10s when new data arrives

### 3.3 Execution Timeline

Visual horizontal timeline of the most recent execution session.

```
┌─ LAST EXECUTION ──────────────────────────────────────────┐
│                                                           │
│  ●───●───●───⚠───●───●───●───✓                          │
│  │   │   │   │   │   │   │                              │
│  S   P   E   A   E   E   D                              │
│  e   l   x   p   x   x   o                              │
│  a   a   e   r   e   e   n                              │
│  r   n   c   o   c   c   e                              │
│  c   │   u   v   u   u                                  │
│  h   │   t   a   t   t                                  │
│      │   e   l   e   e                                  │
│      │   │   │   │   │                                  │
│      │   │   │   │   └─ content (done)                  │
│      │   │   │   └─ summarize (done)                    │
│      │   │   └─ approval (timeout)                      │
│      │   └─ web_search (done)                           │
│      └─ plan (done)                                     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- Steps connected by horizontal line
- Each step: dot with color = risk level, icon = status
- Hover: tooltip with step details

### 3.4 Tool Registry Grid

Compact grid of tool badges with risk color coding.

```
┌─ TOOL REGISTRY (51 tools) ────────────────────────────────┐
│                                                           │
│  [●] web_search    [●] file_read     [●] git_commit      │
│  [●] health_check  [●] db_query      [●] terminal_exec   │
│  [●] wiki_search   [●] ingest        [●] build_graph     │
│  ...                                                      │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- Each badge: mono font, colored left border = risk level
- Hover: tooltip with description, call count, avg duration
- Click: expand to show full tool details

### 3.5 Pending Approvals Panel

Prominent panel when approvals exist — this is critical for user interaction.

```
┌─ PENDING APPROVALS ───────────────────────────────────────┐
│                                                           │
│  ⚠  git_push (origin/main)                               │
│     Risk: L3  |  Pattern: deploy                          │
│     [Approve]  [Reject]  [Auto: OFF]                      │
│                                                           │
│  ⚠  terminal_exec: rm -rf /tmp/old_logs                  │
│     Risk: L3  |  Pattern: cleanup                         │
│     [Approve]  [Reject]  [Auto: ON]  ← auto-approved     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- Amber left border
- Risk level badge
- Auto-approve indicator
- 30s countdown timer for timeout visualization

---

## 4. Chat Tab Components

### 4.1 Goal Input

```
┌─────────────────────────────────────────────────────────────┐
│  > What would you like Jarvis to do?                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Search for recent papers on agentic AI and ingest  │   │
│  │ them into the wiki.                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Execute ▶]          Strategy: [balanced ▼]                │
└─────────────────────────────────────────────────────────────┘
```

- Input field: monospace font, cyan caret, dark background
- Execute button: magenta glow on hover
- Strategy selector: segmented control (conservative / balanced / aggressive)

### 4.2 Execution Panel (Live)

Shows the current goal execution with SSE streaming updates.

```
┌─ EXECUTION: agentic-ai-papers ────────────────────────────┐
│                                                           │
│  ● Planning...      ✓                                    │
│  ● web_search       ✓  (found 3 papers)                  │
│  ● web_fetch        ✓  (fetched arxiv:2401.xxx)          │
│  ● ingest           ✓  (added to wiki)                   │
│  ● Reflection...    ✓                                    │
│  ● Summary          ✓                                    │
│                                                           │
│  ──────────────────────────────────────────────────────   │
│  Task completed with 5/5 successful steps.                │
│  [View Result]  [Save as Skill]  [Rerun]                  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 5. Terminal Tab

Full-screen terminal experience.

```
┌─ JARVIS TERMINAL v2.0 ────────────────────────────────────┐
│                                                           │
│  $ jarvis status                                          │
│  > status: RUNNING                                        │
│  > cycles: 1,247                                          │
│  > success_rate: 94.2%                                    │
│  > pending_approvals: 0                                   │
│                                                           │
│  $ jarvis logs --tail=20                                  │
│  12:34:05.240 [SYS] cycle_start id=cycle_a3f2            │
│  12:34:05.245 [PLN] plan_ready steps=5                   │
│  ...                                                      │
│                                                           │
│  $ _                                                       │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- Blinking cursor (`_` or `█`)
- Command history (up/down arrow)
- Commands: `status`, `logs`, `tools`, `goals`, `approve <id>`, `reject <id>`
- Color-coded output

---

## 6. Animation & Motion

| Effect | Trigger | Implementation |
|---|---|---|
| Neural Pulse | Every tool execution | framer-motion `animate` — light ripple travels across pulse bar, color = risk level |
| Panel Glow Hover | Mouse hover on panel | CSS `transition: box-shadow 0.3s ease` — cyan border glow intensifies |
| Number Count Up | Dashboard load | framer-motion `useSpring` — big numbers animate from 0 to value |
| Terminal Type | New log line | JS `setInterval` 15ms/char for first 60 chars |
| Status Pulse | Agent is RUNNING | CSS `animation: pulse 2s infinite` on status dot |
| Tab Switch | User clicks tab | framer-motion `AnimatePresence` — cross-fade with 0.2s duration |
| Card Enter | Dashboard mounts | framer-motion `staggerChildren: 0.05` — cards fade in sequentially |

---

## 7. Responsive Behavior

- **Desktop (≥1280px):** Full layout with terminal side panel
- **Tablet (768–1279px):** Terminal panel becomes bottom drawer (collapsible)
- **Mobile (<768px):** Single column, terminal tab only, hamburger menu for tabs

---

## 8. Accessibility

- All neon colors maintain ≥4.5:1 contrast against `#0A0014`
- CRT scanline overlay can be disabled via `prefers-reduced-motion` or user toggle
- Terminal log stream respects `prefers-reduced-motion` (no typing effect)
- Focus states: cyan outline glow (`outline: 2px solid var(--jarvis-cyan)`)
- All interactive elements have `aria-label`

---

## 9. Implementation Scope

### Phase 1: Design System Foundation
- Add Retro-Futuristic CSS variables to `index.css`
- Create `JarvisThemeProvider` (or CSS class toggle)
- Build `TerminalPanel` component with log stream
- Build `NeuralPulseBar` component

### Phase 2: Dashboard Redesign
- Redesign `JarvisPage.tsx` Dashboard tab with new layout
- Build `AgentStatusHero`, `NeuralActivityGraph`, `ExecutionTimeline`
- Redesign `StatCard` → `NeuralStat`
- Redesign `GoalList`, `ToolGrid`, `ApprovalPanel`

### Phase 3: Chat & Terminal
- Redesign Chat tab with new input style
- Build full-screen Terminal tab
- Integrate `ExecutionPanel` with new visual style

### Phase 4: Polish
- Add CRT scanline overlay
- Add glow effects
- Add all animations
- Responsive adjustments
