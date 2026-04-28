import { Link, useLocation } from 'react-router-dom';
import { FileText, Users, Lightbulb, Layers, GitBranch, ScrollText, Home, Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  icon: React.ComponentType<{ size?: number }>;
  translationKey: string;
  path: string;
  matchPath: string;
  matchSearch?: string;
  matchPrefixes?: string[];
}

const navItems: NavItem[] = [
  { icon: Home, translationKey: 'nav.home', path: '/', matchPath: '/' },
  { icon: Compass, translationKey: 'nav.browse', path: '/browse', matchPath: '/browse', matchSearch: undefined },
  { icon: FileText, translationKey: 'nav.sources', path: '/browse?t=source', matchPath: '/browse', matchSearch: 'source', matchPrefixes: ['/s/'] },
  { icon: Users, translationKey: 'nav.entities', path: '/browse?t=entity', matchPath: '/browse', matchSearch: 'entity', matchPrefixes: ['/e/'] },
  { icon: Lightbulb, translationKey: 'nav.concepts', path: '/browse?t=concept', matchPath: '/browse', matchSearch: 'concept', matchPrefixes: ['/c/'] },
  { icon: Layers, translationKey: 'nav.syntheses', path: '/browse?t=synthesis', matchPath: '/browse', matchSearch: 'synthesis', matchPrefixes: ['/y/'] },
  { icon: GitBranch, translationKey: 'nav.graph', path: '/graph', matchPath: '/graph' },
  { icon: ScrollText, translationKey: 'nav.log', path: '/log', matchPath: '/log' },
];

function isItemActive(item: NavItem, pathname: string, search: string): boolean {
  if (item.matchPath === '/' && pathname === '/') return true;
  if (item.matchPath === '/' && pathname !== '/') return false;

  if (item.matchPrefixes?.some((p) => pathname.startsWith(p))) return true;

  if (pathname === item.matchPath) {
    if (item.matchSearch === undefined) return true;
    const params = new URLSearchParams(search);
    const t = params.get('t');
    return t === item.matchSearch;
  }

  return false;
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

  const sidebarContent = (
    <nav className="p-2 space-y-1">
      {navItems.map((item) => {
        const navActive = isItemActive(item, location.pathname, location.search);
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
            title={t(item.translationKey)}
          >
            <item.icon size={18} />
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="text-sm whitespace-nowrap"
              >
                {t(item.translationKey)}
              </motion.span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <aside
        className="hidden md:block fixed left-0 top-14 bottom-0 z-40 bg-[var(--bg-primary)] border-r border-[var(--border-default)] transition-all duration-300 overflow-y-auto"
        style={{ width: sidebarCollapsed ? '56px' : '240px' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar — overlay with animation */}
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
