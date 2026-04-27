import { Link, useLocation } from 'react-router-dom';
import { FileText, Users, Lightbulb, Layers, GitBranch, ScrollText, Home, Compass } from 'lucide-react';
import { useWikiStore } from '@/stores/wikiStore';
import { motion } from 'framer-motion';

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Compass, label: 'Browse', path: '/browse' },
  { icon: FileText, label: 'Sources', path: '/browse?t=source' },
  { icon: Users, label: 'Entities', path: '/browse?t=entity' },
  { icon: Lightbulb, label: 'Concepts', path: '/browse?t=concept' },
  { icon: Layers, label: 'Syntheses', path: '/browse?t=synthesis' },
  { icon: GitBranch, label: 'Graph', path: '/graph' },
  { icon: ScrollText, label: 'Log', path: '/log' },
];

export function Sidebar() {
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);
  const location = useLocation();

  return (
    <aside
      className="fixed left-0 top-14 bottom-0 z-40 bg-[var(--bg-primary)] border-r border-[var(--border-default)] transition-all duration-300 overflow-y-auto"
      style={{ width: sidebarCollapsed ? '56px' : '240px' }}
    >
      <nav className="p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path.split('?')[0]));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-apple-blue/10 text-apple-blue font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title={item.label}
            >
              <item.icon size={18} />
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm"
                >
                  {item.label}
                </motion.span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
