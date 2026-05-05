import { Link, useNavigate } from 'react-router-dom';
import { Home, SearchX, Search, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState } from 'react';

export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t('notFound.title'));
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="empty-state-warm w-full max-w-md"
      >
        <div className="flex justify-center mb-4">
          <SearchX size={56} className="text-apple-blue" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">{t('notFound.title')}</h2>
        <p className="text-[var(--text-secondary)] mb-6">{t('notFound.description')}</p>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            className="apple-input pl-9 w-full"
          />
        </form>

        <div className="flex items-center justify-center gap-3">
          <Link to="/" className="apple-button-warm">
            <Home size={16} />
            {t('notFound.backToHome')}
          </Link>
          <Link to="/browse" className="apple-button-ghost">
            <Sparkles size={16} />
            {t('nav.browse')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
