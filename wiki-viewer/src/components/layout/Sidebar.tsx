import { Link, useLocation } from 'react-router-dom';
import { GitBranch, Home, Compass, Upload, Settings, Activity, MessageCircle, Server, Wrench, LayoutDashboard, Network, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface NavItem {
  icon: React.ElementType;
  translationKey: string;
  path: string;
  matchPath: string;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    labelKey: 'nav.group.knowledge',
    items: [
      { icon: Home, translationKey: 'nav.home', path: '/', matchPath: '/' },
      { icon: Compass, translationKey: 'nav.browse', path: '/browse', matchPath: '/browse' },
      { icon: GitBranch, translationKey: 'nav.graph', path: '/graph', matchPath: '/graph' },
      { icon: LayoutDashboard, translationKey: 'nav.dashboard', path: '/dashboard', matchPath: '/dashboard' },
      { icon: Network, translationKey: 'nav.mindmap', path: '/mindmap/overview', matchPath: '/mindmap' },
      { icon: Clock, translationKey: 'nav.timeline', path: '/timeline', matchPath: '/timeline' },
    ],
  },
  {
    labelKey: 'nav.group.tools',
    items: [
      { icon: Upload, translationKey: 'nav.upload', path: '/upload', matchPath: '/upload' },
      { icon: MessageCircle, translationKey: 'nav.chat', path: '/chat', matchPath: '/chat' },
      { icon: Server, translationKey: 'nav.mcp', path: '/mcp', matchPath: '/mcp' },
      { icon: Wrench, translationKey: 'nav.skills', path: '/skills', matchPath: '/skills' },
    ],
  },
  {
    labelKey: 'nav.group.system',
    items: [
      { icon: Activity, translationKey: 'nav.status', path: '/status', matchPath: '/status' },
      { icon: Settings, translationKey: 'nav.settings', path: '/settings', matchPath: '/settings' },
    ],
  },
];

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.matchPath === '/') return pathname === '/';
  return pathname === item.matchPath || pathname.startsWith(item.matchPath + '/');
}

export function Sidebar() {
  const { t } = useTranslation();
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useWikiStore((s) => s.toggleSidebar);
  const location = useLocation();
  // disablePointerEvents removed — redundant with AnimatePresence exit animation

  const handleNavClick = () => {
    if (window.matchMedia('(max-width: 768px)').matches && !sidebarCollapsed) {
      toggleSidebar();
    }
  };

  const renderItems = (items: NavItem[]) => (
    <div className="space-y-0">
      {items.map((item) => {
        const navActive = isItemActive(item, location.pathname);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
              navActive
                ? sidebarCollapsed
                  ? 'bg-apple-blue/15 text-apple-blue font-medium'
                  : 'bg-apple-blue/10 text-apple-blue font-medium border-l-2 border-apple-blue'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] hover:translate-x-0.5'
            }`}
            title={t(item.translationKey as string)}
            aria-current={navActive ? 'page' : undefined}
            aria-label={t(item.translationKey as string)}
          >
            <item.icon size={16} />
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="text-sm whitespace-nowrap"
              >
                {t(item.translationKey as string)}
              </motion.span>
            )}
          </Link>
        );
      })}
    </div>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <nav className="p-2 flex-1">
        {navGroups.slice(0, 2).map((group, groupIdx) => (
          <div
            key={group.labelKey}
            className={groupIdx > 0 ? 'mt-4 pt-3 border-t border-[var(--border-default)]' : ''}
          >
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
              >
                {t(group.labelKey)}
              </motion.div>
            )}
            {sidebarCollapsed && groupIdx > 0 && (
              <div className="w-5 h-px bg-[var(--border-default)] mx-auto my-2" />
            )}
            {renderItems(group.items)}
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-[var(--border-default)]">
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
          >
            {t(navGroups[2].labelKey)}
          </motion.div>
        )}
        {sidebarCollapsed && (
          <div className="w-5 h-px bg-[var(--border-default)] mx-auto my-2" />
        )}
        {renderItems(navGroups[2].items)}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className="hidden md:block fixed left-0 top-14 bottom-0 z-40 bg-[var(--bg-primary)] border-r border-[var(--border-default)] transition-all duration-300 overflow-y-auto"
        style={{ width: sidebarCollapsed ? '56px' : '240px' }}
      >
        {sidebarContent}
      </aside>

      <AnimatePresence>
        {!sidebarCollapsed && (
          <>
            <motion.div
              className="md:hidden fixed inset-0 bg-black/60 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleSidebar}
              role="button"
              tabIndex={0}
              aria-label={t('action.closeSidebar', 'Close sidebar')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') toggleSidebar(); }}
            />
            <motion.aside
              className="md:hidden fixed left-0 top-14 bottom-0 z-40 bg-[var(--bg-primary)] border-r border-[var(--border-default)] overflow-y-auto"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{ width: '240px' }}
              data-sidebar-mobile="true"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
