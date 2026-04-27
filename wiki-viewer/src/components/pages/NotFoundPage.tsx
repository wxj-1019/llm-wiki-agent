import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { motion } from 'framer-motion';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="empty-state-warm"
      >
        <div className="text-6xl mb-4">🤔</div>
        <h2 className="font-rounded text-2xl font-semibold mb-2">Page not found</h2>
        <p className="text-[var(--text-secondary)] mb-6">This page doesn't exist in the wiki.</p>
        <Link to="/" className="apple-button-warm">
          <Home size={16} />
          Back to Home
        </Link>
      </motion.div>
    </div>
  );
}
