import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;

    const handleScroll = () => {
      setIsVisible(main.scrollTop > 400);
    };

    main.addEventListener('scroll', handleScroll, { passive: true });
    return () => main.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    const main = document.getElementById('main-content');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg hover:shadow-xl hover:border-[var(--border-strong)] transition-shadow"
          aria-label="Scroll to top"
        >
          <ArrowUp size={18} className="text-[var(--text-secondary)]" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
