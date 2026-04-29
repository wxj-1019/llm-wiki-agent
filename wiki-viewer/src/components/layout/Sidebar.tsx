import { Link, useLocation } from 'react-router-dom';
import { GitBranch, ScrollText, Home, Compass, Upload, Settings, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  icon: React.ElementType;
  translationKey: string;
  path: string;
  matchPath: string;
}

const navItems: NavItem[] = [
  { icon: Home, translationKey: 'nav.home', path: '/', matchPath: '/' },
  { icon: Compass, translationKey: 'nav.browse', path: '/browse', matchPath: '/browse' },
  { icon: GitBranch, translationKey: 'nav.graph', path: '/graph', matchPath: '/graph' },
  { icon: ScrollText, translationKey: 'nav.log', path: '/log', matchPath: '/log' },
  { icon: Upload, translationKey: 'nav.upload', path: '/upload', matchPath: '/upload' },
  { icon: Bot, translationKey: 'nav.agentKit', path: '/agent-kit', matchPath: '/agent-kit' },
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

  // Close mobile sidebar on navigation (on mobile, sidebar is an overlay)
  const handleNavClick = () => {
    if (window.matchMedia('(max-width: 768px)').matches && !sidebarCollapsed) {
      toggleSidebar();
    }
  };

  const settingsActive = location.pathname === '/settings';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <nav className="p-2 space-y-1 flex-1">
        {navItems.map((item) => {
          const navActive = isItemActive(item, location.pathname);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                navActive
                  ? 'bg-apple-blue/10 text-apple-blue font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title={t(item.translationKey as string)}
            >
              <item.icon size={18} />
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
      </nav>

      {/* Settings at bottom */}
      <div className="p-2 border-t border-[var(--border-default)]">
        <Link
          to="/settings"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
            settingsActive
              ? 'bg-apple-blue/10 text-apple-blue font-medium'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title={t('nav.settings')}
        >
          <Settings size={18} />
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm whitespace-nowrap"
            >
              {t('nav.settings')}
            </motion.span>
          )}
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar �?always visible */}
      <aside
        className="hidden md:block fixed left-0 top-14 bottom-0 z-40 bg-[var(--bg-primary)] border-r border-[var(--border-default)] transition-all duration-300 overflow-y-auto"
        style={{ width: sidebarCollapsed ? '56px' : '240px' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar �?overlay with animation */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <>
            {/* Backdrop */}
            <motion.div
              className="md:hidden fixed inset-0 bg-black/40 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleSidebar}
            />
            {/* Drawer */}
            <motion.aside
              className="md:hidden fixed left-0 top-14 bottom-0 z-40 bg-[var(--bg-primary)] border-r border-[var(--border-default)] overflow-y-auto"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{ width: '240px' }}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
