---
title: "Sidebar"
type: code_module
tags: [frontend, typescript, component, sidebar, navigation]
source_file: Sidebar.tsx
---

## Module
`Sidebar.tsx` — Main navigation sidebar component for [[LLMWikiViewer]]

## Dependencies
- `react` — `useState`, `useCallback`
- `react-router-dom` — `Link`, `useLocation`
- `lucide-react` — icons (Home, Compass, Search, GitBranch, Upload, Globe, ListTodo, Webhook, Server, Wrench, Clock, Network, Bot, ShieldCheck, FileText, HeartPulse, Activity, Settings, ChevronDown)
- `react-i18next` — `useTranslation`()
- `@/stores/wikiStore` — `useWikiStore`
- `framer-motion` — `motion`, `AnimatePresence`

## Constants
### `navGroups: NavGroup[]`
Array of navigation groups, each with:
- `labelKey`: i18n translation key for group label
- `items`: array of `NavItem` objects (icon, translationKey, path, matchPath)
- `defaultCollapsed`?: optional boolean, true for Advanced group

## Functions
### `isItemActive(item: NavItem, pathname: string): boolean`
Determines if a nav item corresponds to the current route. Home (`/`) uses exact match; others use `pathname === item.matchPath || pathname.startsWith(item.matchPath + '/')`.

### `handleNavClick(): void`
On mobile viewports (< 768px), toggles sidebar closed after navigation.

## Component: `Sidebar()`
### State
- `collapsedGroups: Set<string>` — tracks which groups are collapsed. Initialized from `defaultCollapsed` properties.

### Behavior
1. Reads `sidebarCollapsed` and `toggleSidebar` from `useWikiStore` (Zustand).
2. Reads current location from `useLocation()`.
3. Renders groups in order: Core → Workspace → Advanced (collapsed by default) → System.
4. Collapsed mode: 56px width, icons only with group separators.
5. Expanded mode: 240px width with group labels, items, and hover effects.
6. Mobile: Full-width overlay with backdrop, spring slide-in animation.

### Key Features
- Active page highlighting with blue accent
- Collapsible groups with `AnimatePresence` enter/exit animations
- `aria-current="page"` and `aria-label` for accessibility
- Hover effects: `hover:translate-x-0.5 active:scale-[0.97]`
- Spring animation for mobile slide-in (damping 30, stiffness 300)

### Connections
- [[Header]] — positioned below (`top-14 = 56px`)
- [[router-configuration]] — all paths map to router routes
- [[ChatPage]], [[SearchPage]], [[GraphPage]], [[UploadPage]] — target pages

_i18n keys used:_ `nav.group.core`, `nav.group.workspace`, `nav.group.advanced`, `nav.group.system`, `nav.home`, `nav.browse`, `nav.search`, `nav.graph`, `nav.upload`, `nav.crawler`, `nav.jobs`, `nav.webhooks`, `nav.mcp`, `nav.skills`, `nav.tools`, `nav.timeline`, `nav.mindmap`, `nav.jarvis`, `nav.approvals`, `nav.agentLog`, `nav.pipeline`, `nav.status`, `nav.settings`
