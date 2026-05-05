import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let chordTimeout: ReturnType<typeof setTimeout> | null = null;
    let pendingChord: string | null = null;

    const isTyping = (e: KeyboardEvent): boolean => {
      const target = e.target as HTMLElement;
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
    };

    const clearChord = () => {
      pendingChord = null;
      if (chordTimeout) {
        clearTimeout(chordTimeout);
        chordTimeout = null;
      }
    };

    const handler = (e: KeyboardEvent) => {
      if (isTyping(e)) return;

      if (pendingChord) {
        const chord = `${pendingChord} ${e.key}`;
        clearChord();

        switch (chord) {
          case 'g h':
            e.preventDefault();
            navigate('/');
            return;
          case 'g b':
            e.preventDefault();
            navigate('/browse');
            return;
          case 'g g':
            e.preventDefault();
            navigate('/graph');
            return;
          case 'g d':
            e.preventDefault();
            navigate('/dashboard');
            return;
          case 'g c':
            e.preventDefault();
            navigate('/chat');
            return;
          case 'g u':
            e.preventDefault();
            navigate('/upload');
            return;
          case 'g s':
            e.preventDefault();
            navigate('/settings');
            return;
          default:
            return;
        }
      }

      if (e.key === 'g') {
        pendingChord = 'g';
        chordTimeout = setTimeout(clearChord, 1000);
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('wiki:focus-search'));
          break;
        case '?':
          e.preventDefault();
          // eslint-disable-next-line no-console
          console.log(
            'Keyboard shortcuts: / = search, g h = home, g b = browse, g g = graph, g d = dashboard, g c = chat, g u = upload, g s = settings'
          );
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearChord();
    };
  }, [navigate]);
}
