---
title: "searchWeb"
type: entity
tags: [search, api, frontend, typescript, web-search]
sources: [SearchPage.md, chat-service-sse-client.md, searchpage-wiki-search-ai-chat-component.md]
---

# searchWeb

`searchWeb` is a client-side function exported from the `chatService.ts` module that performs an external web search via a Server-Sent Events (SSE) streaming endpoint. It is one of several search interfaces in the LLM Wiki Viewer, alongside the local `searchWiki` function, and is distinct in that it queries the internet at large rather than the local wiki knowledge graph. The function is consumed by the SearchPage component within its "Web Search" tab, where it retrieves and presents external URL results in a streaming fashion. `searchWeb` follows the same unified SSE event parsing protocol (`readSseStream`) and automatic 60-second timeout handling as the other chat and search functions in the service layer, ensuring consistency across all SSE-based interactions in the frontend.