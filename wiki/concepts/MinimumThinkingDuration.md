---
title: "MinimumThinkingDuration"
type: concept
tags: [pattern, ux, animation, jarvis]
sources: [usejarvis-mood-jarvis-mood-state-hook]
last_updated: 2026-05-14
---

**Minimum Thinking Duration** is a UX pattern that enforces a configurable minimum elapsed time before allowing a visual state transition away from a `'thinking'` state. Implemented in [[useJarvisMood]], it uses `thinkingStartRef` to record the timestamp when `'thinking'` is entered, calculates elapsed time on exit attempt, and schedules a deferred state update via `setTimeout` if the minimum has not yet been met. This prevents jarringly brief "thinking" animations during fast AI responses, maintaining a natural conversational rhythm.

## Connections
- [[useJarvisMood]] — primary consumer of this pattern
- [[DebouncePattern]] — related deferred execution pattern
- [[JARVIS]] — AI assistant whose thinking duration this pattern affects