---
title: "SearchPage"
type: entity
tags: [frontend, react, component]
sources: [searchpage-wiki-search-ai-chat-component]
last_updated: 2026-05-14
---

# SearchPage

The `SearchPage` component is the unified search and AI interaction hub of the [[LLMWikiViewer]] frontend. It features three main tabs (Search, Chat, Generate) plus a Web Search tab, all with URL state synchronization via [[ReactRouter]]. The Search tab supports hierarchical backend→local fallback search with optional semantic embedding, the Chat tab provides wiki-grounded streaming chat via [[chatWithWikiStream]] with automatic context attachment from search results, and the Generate tab enables knowledge package creation.