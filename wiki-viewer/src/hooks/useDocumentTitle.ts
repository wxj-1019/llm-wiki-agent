import { useEffect } from 'react';
import i18n from '@/i18n';

export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    const base = i18n.t('meta.title');
    document.title = pageTitle ? `${pageTitle} | ${base}` : base;
  }, [pageTitle]);
}
