---
title: "Debounce Pattern"
type: concept
tags: [frontend, pattern, react, debounce]
sources: [usedebounce-debounce-hook-for-react]
last_updated: 2026-05-14
---

# Debounce Pattern

A debounce pattern delays execution of a function or state update until a specified period of inactivity has elapsed. It is commonly used to limit the rate of expensive operations such as search queries, API calls, or state persistence.

## Implementation

In the [[LLMWikiViewer]] frontend, the debounce pattern is implemented via the [[UseDebounce]] hook, which uses [[useState]] and [[useEffect]]. It takes a value and an optional delay (default 300ms) and returns a debounced copy that updates only after the input stops changing for the specified duration.

## Usage in Wiki Viewer

- [[DebouncedSearch]] — debounced input for search popover in [[Header]]
- [[DebouncedPersistence]] — debounced localStorage saves in [[useChat]]
- [[ChatSearchPanel]] — debounced wiki/web search input

## Related Concepts
- [[Throttling]] — different rate-limiting strategy that guarantees execution at most once per interval
- [[RequestDeduplication]] — complementary pattern for avoiding duplicate API calls