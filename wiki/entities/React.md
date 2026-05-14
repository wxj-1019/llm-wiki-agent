---
title: "React"
type: entity
tags: [frontend, library, ui, javascript, typescript, hooks, components]
sources: [UseBodyScrollLock.md, UseIngestStream.md, UseKeyboardShortcuts.md, agent-chat-store-zustand-manager.md, lazypage-component.md, usedebounce-debounce-hook-for-react.md, usefocustrap-focus-trap-hook.md, useingeststream-ingest-job-sse-stream-consumer-hook.md]
---

# React

React is a JavaScript library for building user interfaces, and it serves as the foundational UI framework for the [[LLMWikiViewer]] frontend. In this codebase, React is used primarily through its functional component model and Hooks API, with all custom utilities implemented as reusable hooks — including `useBodyScrollLock`, `useDebounce`, `useFocusTrap`, `useIngestStreamManager`, and `useKeyboardShortcuts`. The project also leverages React's built-in `useState`, `useEffect`, and `Suspense` primitives for state management, side-effect handling, and lazy loading via the `LazyPage` component. Components interact with external state via Zustand stores like `useAgentChatStore` and `useIngestStore`, and navigation is managed through [[ReactRouter]]'s `useNavigate`. The codebase consistently employs TypeScript generics to create type-safe, reusable hooks and components, reflecting a patterns-driven architecture where React serves as the declarative layer coordinating UI behavior, accessibility (via focus management and scroll locking), asynchronous data ingestion (via SSE streams), and route-level code splitting with animated loading states.