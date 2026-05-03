import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, X, CheckCheck, ScrollText, Trash2, CheckCircle, XCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '@/stores/notificationStore';
import { formatDistanceToNow } from '@/lib/dateUtils';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const colorMap = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-apple-blue',
};

export function NotificationDropdown() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clearNotifications = useNotificationStore((s) => s.clearNotifications);
  const removeNotification = useNotificationStore((s) => s.removeNotification);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-colors border border-transparent hover:border-[var(--border-default)]"
        title={t('notifications.title', '通知')}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] z-50 shadow-xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
                <h3 className="text-sm font-semibold">
                  {t('notifications.title', '通知')}
                </h3>
                <div className="flex items-center gap-1">
                  {notifications.length > 0 && (
                    <>
                      <button
                        onClick={markAllRead}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                        title={t('notifications.markAllRead', '全部已读')}
                      >
                        <CheckCheck size={14} />
                      </button>
                      <button
                        onClick={clearNotifications}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                        title={t('notifications.clearAll', '清空')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Notification list */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                    {t('notifications.empty', '暂无通知')}
                  </div>
                ) : (
                  notifications.map((n) => {
                    const Icon = iconMap[n.type];
                    return (
                      <div
                        key={n.id}
                        onMouseEnter={() => !n.read && markRead(n.id)}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border-default)] last:border-b-0 ${
                          !n.read ? 'bg-[var(--bg-secondary)]/40' : ''
                        }`}
                      >
                        <Icon size={16} className={`shrink-0 mt-0.5 ${colorMap[n.type]}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed">{n.message}</p>
                          <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                            {formatDistanceToNow(n.timestamp)}
                          </p>
                        </div>
                        <button
                          onClick={() => removeNotification(n.id)}
                          className="p-1 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer — Log link */}
              <div className="px-3 py-2 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]/50">
                <Link
                  to="/log"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <ScrollText size={14} />
                  {t('notifications.viewLog', '查看操作日志')}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
