---
title: "Loader2"
type: entity
tags: [frontend, ui-component, loading, react, llm-wiki-viewer]
sources: [chatsearchpanel-search-panel-component.md, notification-dropdown-component.md]
---

# Loader2

`Loader2` is a React UI component used in the [[LLMWikiViewer]] frontend to indicate an active loading or processing state. It appears in two known contexts: within the [[ChatSearchPanel]], where it is displayed while search results are being fetched from either the internal Wiki or Web search modes, and within the [[NotificationDropdown]], where it is shown during the execution of ongoing operations (such as file uploads or background tasks that report progress). The component is visually distinct from a simple spinner, likely inheriting from a shared icon library (possibly Lucide React, given the naming convention of "Loader2"), and is typically rendered with animation to convey that a process is not yet complete. Its presence signals to the user that the interface is awaiting data or a response before proceeding with further interaction.