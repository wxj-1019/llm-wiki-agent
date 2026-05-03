import { Link } from 'react-router-dom';
import { Home, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('notFound.title'));
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="empty-state-warm"
      >
        <div className="flex justify-center mb-4">
          <SearchX size={56} className="text-apple-blue" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">{t('notFound.title')}</h2>
        <p className="text-[var(--text-secondary)] mb-6">{t('notFound.description')}</p>
        <Link to="/" className="apple-button-warm">
          <Home size={16} />
          {t('notFound.backToHome')}
        </Link>
      </motion.div>
    </div>
  );
}
