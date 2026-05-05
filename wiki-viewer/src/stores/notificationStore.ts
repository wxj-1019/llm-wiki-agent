import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info' | 'progress';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
  progress?: number; // 0-100 for progress notifications
}

interface NotificationState {
  notifications: Notification[];
  toasts: Notification[];
  addNotification: (message: string, type?: NotificationType, progress?: number) => void;
  updateProgress: (id: string, progress: number) => void;
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

  addNotification: (message, type = 'info', progress) => {
    const now = Date.now();
    if (now - lastToastTime < TOAST_THROTTLE_MS && type !== 'progress') {
      // Skip toast UI for rapid-fire notifications, but still log
      set((state) => ({
        notifications: [{
          id: `${now}-${++toastIdCounter}`,
          message,
          type,
          timestamp: now,
          read: false,
          progress,
        }, ...state.notifications].slice(0, 50),
      }));
      return `${now}-${toastIdCounter}`;
    }
    lastToastTime = now;

    const id = `${now}-${++toastIdCounter}`;
    const notification: Notification = {
      id,
      message,
      type,
      timestamp: now,
      read: false,
      progress,
    };

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      toasts: type === 'progress' 
        ? [notification, ...state.toasts.filter((t) => t.type !== 'progress')].slice(0, 5)
        : [notification, ...state.toasts].slice(0, 5),
    }));

    // Auto-dismiss toast after 4 seconds (except progress)
    if (type !== 'progress') {
      const timer = setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
        toastTimers.delete(id);
      }, 4000);
      toastTimers.set(id, timer);
    }
    return id;
  },

  updateProgress: (id, progress) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, progress } : n
      ),
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, progress } : t
      ),
    }));
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
