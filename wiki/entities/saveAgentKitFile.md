---
title: "saveAgentKitFile"
type: entity
tags: [agent-kit, chat, persistence, file-management]
sources: [useChatHook.md, usechat-agent-kit-chat-state-management-hook.md]
---

# saveAgentKitFile

`saveAgentKitFile` is an operation or function associated with the chat state lifecycle managed by the `useChat` hook in the AgentKit chat interface within the LLMWikiViewer frontend. While not directly exposed as a parameter in the hook's signature, `saveAgentKitFile` pertains to the persistence layer of the system, specifically the mechanism by which generated knowledge artifacts (such as MCP skills, code files, or wiki content produced via Knowledge Generation) are written back to the file system or storage. It operates in conjunction with chat persistence features, which use debounced saves to `LocalStorage` for session continuity, but extends deeper into the AgentKit's file management capabilities. The entity is closely related to the `loadFiles` callback parameter of `useChat`, as saving and loading agent kit files form a complementary pair for maintaining the state of generated or edited content across sessions. This action is significant because it bridges the gap between conversational output and persistent, actionable file storage, enabling the wiki viewer to treat generated knowledge as permanent resources rather than ephemeral chat messages.