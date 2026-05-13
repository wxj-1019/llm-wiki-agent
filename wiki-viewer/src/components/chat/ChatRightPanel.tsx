import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChatDocPreview } from './ChatDocPreview';
import { ChatSearchPanel } from './ChatSearchPanel';
import type { WikiChatSource } from '@/services/chatService';

interface ChatRightPanelProps {
  tab: 'doc' | 'search';
  onTabChange: (tab: 'doc' | 'search') => void;
  sources: WikiChatSource[];
  activeDocPath: string | null;
  onSelectPath: (path: string) => void;
  onQuoteToChat: (text: string) => void;
  onClose: () => void;
}

export function ChatRightPanel({
  tab, onTabChange, sources, activeDocPath, onSelectPath, onQuoteToChat, onClose,
}: ChatRightPanelProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      className="w-[360px] min-w-[360px] border-l border-[var(--border-default)] flex flex-col overflow-hidden bg-[var(--bg-primary)]"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 360, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Tab bar */}
      <div className="flex items-center border-b border-[var(--border-default)]">
        <button
          onClick={() => onTabChange('doc')}
          className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${
            tab === 'doc'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          📄 {t('chat.right.doc', 'Docs')}
        </button>
        <button
          onClick={() => onTabChange('search')}
          className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${
            tab === 'search'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          🔎 {t('chat.right.search', 'Search')}
        </button>
        <button
          onClick={onClose}
          className="px-2 py-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'doc' ? (
          <ChatDocPreview
            sources={sources}
            activePath={activeDocPath}
            onSelectPath={onSelectPath}
            onQuote={onQuoteToChat}
          />
        ) : (
          <ChatSearchPanel onQuote={onQuoteToChat} />
        )}
      </div>
    </motion.div>
  );
}
