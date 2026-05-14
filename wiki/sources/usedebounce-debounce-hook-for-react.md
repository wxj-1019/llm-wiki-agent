---
title: "useDebounce — Debounce Hook for React"
type: source
tags: [frontend, typescript, react, hook, debounce]
date: 2026-05-14
source_file: useDebounce.ts
---

## Summary
The `useDebounce` hook (`useDebounce.ts`) provides a generic debounce utility for [[React]] functional components in the [[LLMWikiViewer]] frontend. It delays updating a value until a specified delay has elapsed since the last change, using [[useState]] and [[useEffect]].

## Key Claims
- **Generic type support**: Uses TypeScript generics (`T`) to accept any value type, making it reusable across different data types (strings, numbers, objects, etc.).
- **Configurable delay**: Accepts an optional `delayMs` parameter (default `300` ms) for controlling debounce timing.
- **Cleanup on unmount**: The `useEffect` returns a `clearTimeout` cleanup function, preventing memory leaks and stale state updates when the component unmounts.
- **Dependency tracking**: The effect depends on `[value, delayMs]`, so the debounce timer resets correctly when either the input value or the delay changes.

## Key Quotes
> "Returns a debounced value that updates only after `delayMs` milliseconds of inactivity" — core contract

## Connections
- [[DebouncedSearch]] — debounce pattern used in search components like [[Header]] and [[ChatSearchPanel]]
- [[DebouncedPersistence]] — similar pattern used for debounced localStorage saves in [[useChat]]
- [[useState]] — React hook for state management
- [[useEffect]] — React hook for side effects

## Contradictions
- None identified.