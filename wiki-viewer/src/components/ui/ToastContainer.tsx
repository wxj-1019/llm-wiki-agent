import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const colorMap = {
  success: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/30',
  error: 'text-red-500 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/30',
  info: 'text-apple-blue bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/30',
};

export function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismissToast = useNotificationStore((s) => s.dismissToast);

  return (
    <div className="fixed top-16 right-4 z-[60] space-y-2 w-80 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.95 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${colorMap[toast.type]}`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="text-sm font-medium flex-1">{toast.message}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
