import { useEffect } from 'react';
import i18n from '@/i18n';

export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    const update = () => {
      const base = i18n.t('meta.title');
      document.title = pageTitle ? `${pageTitle} | ${base}` : base;
    };
    update();
    i18n.on('languageChanged', update);
    return () => {
      i18n.off('languageChanged', update);
    };
  }, [pageTitle]);
}
