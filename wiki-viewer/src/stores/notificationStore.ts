import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  toasts: Notification[];
  addNotification: (message: string, type?: NotificationType) => void;
  removeNotification: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  dismissToast: (id: string) => void;
  unreadCount: () => number;
}

let toastIdCounter = 0;
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();
let lastToastTime = 0;
const TOAST_THROTTLE_MS = 300;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  toasts: [],

  addNotification: (message, type = 'info') => {
    const now = Date.now();
    if (now - lastToastTime < TOAST_THROTTLE_MS) {
      // Skip toast UI for rapid-fire notifications, but still log
      set((state) => ({
        notifications: [{
          id: `${now}-${++toastIdCounter}`,
          message,
          type,
          timestamp: now,
          read: false,
        }, ...state.notifications].slice(0, 50),
      }));
      return;
    }
    lastToastTime = now;

    const id = `${now}-${++toastIdCounter}`;
    const notification: Notification = {
      id,
      message,
      type,
      timestamp: now,
      read: false,
    };

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      toasts: [notification, ...state.toasts].slice(0, 5),
    }));

    // Auto-dismiss toast after 4 seconds
    const timer = setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
      toastTimers.delete(id);
    }, 4000);
    toastTimers.set(id, timer);
  },

  removeNotification: (id) => {
    const timer = toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.delete(id);
    }
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearNotifications: () => {
    toastTimers.forEach(clearTimeout);
    toastTimers.clear();
    set({ notifications: [], toasts: [] });
  },

  dismissToast: (id) => {
    const timer = toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.delete(id);
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
