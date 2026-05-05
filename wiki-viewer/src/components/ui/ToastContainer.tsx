import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, X, Loader2 } from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  progress: Loader2,
};

const colorMap = {
  success: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  error: 'text-red-500 bg-red-500/10 border-red-500/20',
  info: 'text-apple-blue bg-apple-blue/10 border-apple-blue/20',
  progress: 'text-apple-purple bg-apple-purple/10 border-apple-purple/20',
};

export function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismissToast = useNotificationStore((s) => s.dismissToast);

  return (
    <div className="fixed top-16 right-4 z-[60] space-y-2 w-80 pointer-events-none" aria-live="polite" aria-atomic="true" role="status">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 30, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`pointer-events-auto flex flex-col gap-2 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${colorMap[toast.type]}`}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={`shrink-0 ${toast.type === 'progress' ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span className="text-sm font-medium flex-1">{toast.message}</span>
                {toast.type !== 'progress' && (
                  <button
                    onClick={() => dismissToast(toast.id)}
                    className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    aria-label="Dismiss toast"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              {toast.type === 'progress' && typeof toast.progress === 'number' && (
                <div className="w-full h-1 bg-black/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-apple-purple rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${toast.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
