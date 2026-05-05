import { Link, useRouteError } from 'react-router-dom';
import { Home, AlertTriangle, RefreshCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export function ErrorBoundary() {
  const { t } = useTranslation();
  const error = useRouteError() as Error & { statusText?: string; message?: string };

  const message = error?.statusText || error?.message || t('error.unknown');
  const isRouteError = 'statusText' in (error || {});

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full text-center"
        role="alert"
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-500" />
        </div>

        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
          {isRouteError ? t('error.pageNotFound') : t('error.somethingWrong')}
        </h1>

        <p className="text-sm text-[var(--text-secondary)] mb-6">
          {isRouteError ? t('error.pageNotFoundDesc') : t('error.tryAgain')}
        </p>

        {!isRouteError && (
          <div className="mb-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] p-3 text-left overflow-auto">
            <code className="text-xs font-mono text-red-500 whitespace-pre-wrap break-all">
              {message}
            </code>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="apple-button-ghost inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <RefreshCcw size={14} />
            {t('error.refresh')}
          </button>
          <Link
            to="/"
            className="apple-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
          >
            <Home size={14} />
            {t('action.backToHome')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
