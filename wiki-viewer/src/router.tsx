import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { HomePage } from '@/components/pages/HomePage';
import { BrowsePage } from '@/components/pages/BrowsePage';
import { PageDetailPage } from '@/components/pages/PageDetailPage';
import { SearchPage } from '@/components/pages/SearchPage';
import { LogPage } from '@/components/pages/LogPage';
import { StatusPage } from '@/components/pages/StatusPage';
import { NotFoundPage } from '@/components/pages/NotFoundPage';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { lazy } from 'react';

// Lazy-load heavy / less frequently visited pages
const GraphPage = lazy(() => import('@/components/pages/GraphPage').then((m) => ({ default: m.GraphPage })));
const ChatPage = lazy(() => import('@/components/pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const SettingsPage = lazy(() => import('@/components/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const UploadPage = lazy(() => import('@/components/pages/UploadPage').then((m) => ({ default: m.UploadPage })));
const DashboardPage = lazy(() => import('@/components/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const MindmapPage = lazy(() => import('@/components/pages/MindmapPage').then((m) => ({ default: m.MindmapPage })));
const TimelinePage = lazy(() => import('@/components/pages/TimelinePage').then((m) => ({ default: m.TimelinePage })));
const MCPPage = lazy(() => import('@/components/pages/MCPPage').then((m) => ({ default: m.MCPPage })));
const SkillsPage = lazy(() => import('@/components/pages/SkillsPage').then((m) => ({ default: m.SkillsPage })));
const CrawlerPage = lazy(() => import('@/components/pages/CrawlerPage').then((m) => ({ default: m.CrawlerPage })));

import { LazyPage } from '@/components/layout/LazyPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      { path: '/', element: <HomePage />, errorElement: <ErrorBoundary /> },
      { path: '/browse', element: <BrowsePage />, errorElement: <ErrorBoundary /> },
      { path: '/s/:slug', element: <PageDetailPage type='source' />, errorElement: <ErrorBoundary /> },
      { path: '/e/:name', element: <PageDetailPage type='entity' />, errorElement: <ErrorBoundary /> },
      { path: '/c/:name', element: <PageDetailPage type='concept' />, errorElement: <ErrorBoundary /> },
      { path: '/y/:slug', element: <PageDetailPage type='synthesis' />, errorElement: <ErrorBoundary /> },
      { path: '/graph', element: <LazyPage><GraphPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/search', element: <SearchPage />, errorElement: <ErrorBoundary /> },
      { path: '/log', element: <LogPage />, errorElement: <ErrorBoundary /> },
      { path: '/upload', element: <LazyPage><UploadPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/settings', element: <LazyPage><SettingsPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/chat', element: <LazyPage><ChatPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/status', element: <StatusPage />, errorElement: <ErrorBoundary /> },
      { path: '/mcp', element: <LazyPage><MCPPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/skills', element: <LazyPage><SkillsPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/dashboard', element: <LazyPage><DashboardPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/mindmap/:slug', element: <LazyPage><MindmapPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/timeline', element: <LazyPage><TimelinePage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '/crawler', element: <LazyPage><CrawlerPage /></LazyPage>, errorElement: <ErrorBoundary /> },
      { path: '*', element: <NotFoundPage />, errorElement: <ErrorBoundary /> },
    ],
  },
]);
