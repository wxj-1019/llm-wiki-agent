---
title: "Sidebar"
type: entity
tags: [frontend, component, navigation]
sources: [sidebar-component-navigation-sidebar]
last_updated: 2026-05-14
---

The `Sidebar` component (`Sidebar.tsx`) is the main navigation sidebar for the [[LLMWikiViewer]] frontend. It provides grouped navigation (Core, Workspace, Advanced, System) with collapsible sections, active page highlighting via [[ReactRouter]] `useLocation`, and mobile-responsive overlay with slide-in animation via [[FramerMotion]].

It reads collapsed state from the [[WikiStore]] (Zustand) and uses [[i18next]] for all label translations.