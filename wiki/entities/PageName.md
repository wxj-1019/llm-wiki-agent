---
title: "LLMWiki"
type: entity
tags: [wiki, knowledge-base, code, documentation]
sources: [HealthChecker.md, chatpage-chat-interface-component.md]
---

# LLMWiki

LLMWiki refers to a structured, locally-editable knowledge base that serves as the central repository for documentation, code modules, and system metadata within the Personal LLM Wiki framework. It is designed to be a deterministic, LLM-free foundation for organizing content, with pages stored as Markdown files containing metadata such as title, type, tags, and source references. The wiki is actively maintained by structural health checks (via the `health.py` module) that verify file consistency, index synchronization, and link integrity, and it is surfaced to users through the LLM Wiki Viewer frontend, where components like ChatPage leverage its pages for context-aware chat, @mention autocompletion, and knowledge generation tasks. LLMWiki acts as both a human-readable documentation system and a machine-parseable data source for AI-assisted workflows.