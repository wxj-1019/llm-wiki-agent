---
title: "useJarvisMood"
type: code_module
tags: [typescript, react, hook, jarvis, mood]
sources: [usejarvis-mood-jarvis-mood-state-hook]
last_updated: 2026-05-14
---

# `useJarvisMood(options?)`

Custom React hook for managing [[JARVIS|J.A.R.V.I.S.]] avatar mood with thinking duration guard and docking control.

## Signature
```typescript
function useJarvisMood(options?: UseJarvisMoodOptions): {
  mood: JarvisMood;
  setMood: (nextMood: JarvisMood) => void;
  isDockedLeft: boolean;
  dockLeft: () => void;
  dockCenter: () => void;
}
```

## Parameters
| Param | Type | Default | Description |
|---|---|---|---|
| `options.minThinkingMs` | `number` | `1500` | Minimum time in ms before allowed to leave `'thinking'` mood |

## Returns
| Field | Type | Description |
|---|---|---|
| `mood` | `JarvisMood` | Current mood state (`'idle'`, `'thinking'`, etc.) |
| `setMood` | `(nextMood: JarvisMood) => void` | Transition to a new mood; enforces min thinking duration |
| `isDockedLeft` | `boolean` | Whether the avatar is docked to the left side |
| `dockLeft` | `() => void` | Dock avatar to left |
| `dockCenter` | `() => void` | Dock avatar to center |

## Implementation Details
- Uses `moodRef` (synchronized via `useEffect`) to avoid stale closures in the `setMood` callback.
- Records `thinkingStartRef` timestamp on entering `'thinking'`.
- On exit from `'thinking'`, calculates elapsed; if `< minThinkingMs`, schedules a deferred `setMoodState` via `setTimeout` with remaining delay.
- Pending transitions are stored in `pendingMoodRef`; new pending transitions cancel old ones.
- Unmount cleanup clears any pending timeout.

## Dependencies
- `@/components/jarvis/JarvisAvatar` (type import: `JarvisMood`)

## Connections
- [[JarvisAvatar]] — consumer of the `JarvisMood` type
- [[JARVIS]] — conceptual AI assistant
- [[MinimumThinkingDuration]] — UX pattern implemented by this hook
- [[useEffect]], [[useRef]], [[useState]], [[useCallback]] — React hooks used