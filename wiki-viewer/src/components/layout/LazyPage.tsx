import { Suspense, type ReactNode } from 'react';
import { motion } from 'framer-motion';

function PageLoader({ label }: { label: string }) {
  return (
    <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        {/* 进度条式加载 */}
        <div className="relative w-48 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-4 mx-auto">
          <motion.div
            className="absolute inset-y-0 left-0 bg-apple-blue rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: ['0%', '70%', '90%'] }}
            transition={{
              duration: 2,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatType: 'loop',
            }}
          />
        </div>
        <p className="text-sm text-[var(--text-secondary)]">Loading {label}...</p>
      </motion.div>
    </div>
  );
}

export function LazyPage({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoader label="page" />}>
      {children}
    </Suspense>
  );
}
