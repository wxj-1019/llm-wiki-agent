import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 忽略输入框中的快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          // 聚焦搜索框（如果存在）
          const searchInput = document.querySelector('[data-search-input]') as HTMLElement;
          if (searchInput) searchInput.focus();
          break;
        case 'g':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            navigate('/graph');
          }
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            navigate('/chat');
          }
          break;
        case 'h':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            navigate('/');
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}
