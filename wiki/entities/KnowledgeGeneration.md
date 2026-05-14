---
title: "KnowledgeGeneration"
type: entity
tags: [agent-kit, mcp, skill, generation]
sources: [usechat-agent-kit-chat-state-management-hook]
last_updated: 2026-05-14
---

Knowledge Generation is a feature of the [[AgentKit]] chat interface that creates MCP servers and Skills from wiki knowledge. Activated by `startKnowledgeGen(target)` in the [[useChat]] hook.

- Target `'mcp'`: Generates a complete MCP Server Python implementation (`.py` file)
- Target `'skill'`: Generates a complete Skill definition (`SKILL.md`) file

The generation uses `generateFromKnowledge` from [[agentKitLLMService]], which searches the wiki knowledge base for relevant information and produces code + explanation + source references.

After generation, if the resulting code is >50 characters, the editor opens automatically via `setEditorOpen(true)` with `previewContent` and `previewPath` set. The user can then save via `handleSavePreview` or edit before saving.