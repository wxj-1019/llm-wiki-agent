---
title: "Sidebar Component — Navigation Sidebar for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, navigation, sidebar]
date: 2026-05-14
source_file: Sidebar.tsx
---

## Summary
The `Sidebar` component (`Sidebar.tsx`) is the main navigation sidebar for the [[LLMWikiViewer]] frontend. It provides a grouped navigation structure (Core, Workspace, Advanced, System) with collapsible sections, active page highlighting, mobile responsiveness with slide-in animation, and integration with the Zustand sidebar state. Uses [[FramerMotion]] for animations, [[Lucide|Lucide React]] icons, and [[ReactRouter]] `Link` components.

## Key Claims
- **Four navigation groups**: `core` (Home, Browse, Search, Graph), `workspace` (Upload, Crawler, Jobs, Webhooks), `advanced` (MCP, Skills, Tools, Timeline, Mindmap — collapsed by default), `system` (Jarvis, Approvals, Agent Log, Pipeline, Status, Settings). Groups separated by borders and uppercase labels.
- **Collapsible groups**: Each group can be toggled via a button click on its label. Uses `useState<Set<string>>` for tracking collapsed groups. `ChevronDown` icon rotates when collapsed. AnimatePresence handles enter/exit transitions.
- **Active page detection**: `isItemActive()` function checks `location.pathname` against each item's `matchPath`. Active items get `bg-apple-blue/10 text-apple-blue font-medium` styling. Home (`/`) has exact match; others use `startsWith` prefix matching.
- **Mobile responsiveness**: On screens < 768px (`md:` breakpoint), the sidebar renders as an overlay — a black backdrop (`bg-black/60`) with click-to-close and keyboard (Enter/Escape) dismissal, plus a slide-in `motion.aside` with spring animation (damping 30, stiffness 300). Navigation clicks auto-close sidebar on mobile.
- **Collapsed state**: When `sidebarCollapsed` is true, only icons are shown at 56px width, with separator lines between groups. Text labels have motion entry animations (fade + slide).
- **Accessibility**: `aria-current="page"` on active links, `aria-label` on links and backdrop button.
- **Zustand integration**: Reads `sidebarCollapsed` and `toggleSidebar` from `useWikiStore`. No local state duplication.

## Key Claims
- The sidebar is anchored below the [[HeaderComponent—WikiViewerNavigationBar|Header]] component (`top-14 = 56px for header height`).
- Uses [[i18next]] translations for group labels (`nav.group.core`, `nav.group.workspace`, `nav.group.advanced`, `nav.group.system`) and item labels (`nav.home`, `nav.browse`, etc.).
- Item hover effects: `hover:translate-x-0.5 active:scale-[0.97]` for subtle interactivity.
- Advanced group collapses by default (`defaultCollapsed: true`), reducing visual clutter.

## Connections
- [[Header]] — sidebar is positioned below the header (`top-14`). Both use `sidebarCollapsed` from [[WikiStore]]
- [[ChatPage]] — sidebar provides navigation to chat and other pages
- [[SearchPage]] — accessible via Core group Search item
- [[GraphPage]] — accessible via Core group Graph item
- [[UploadPage]] — accessible via Workspace group Upload item
- [[router-configuration]] — all sidebar paths map to routes defined in `router.tsx`
- [[LLMWikiViewer]] — the overarching frontend application
- [[FramerMotion]] — used for animations (group expand/collapse, mobile slide-in, text entry)
- [[i18next]] — all labels use translation keys
- [[ReactRouter]] — `Link` and `useLocation` for navigation
- [[Sidebar]] — component name (self-reference for graph)

## Contradictions
- None identified.
