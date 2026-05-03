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

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  toasts: [],

  addNotification: (message, type = 'info') => {
    const id = `${Date.now()}-${++toastIdCounter}`;
    const notification: Notification = {
      id,
      message,
      type,
      timestamp: Date.now(),
      read: false,
    };

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      toasts: [notification, ...state.toasts].slice(0, 5),
    }));

    // Auto-dismiss toast after 4 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

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

  clearNotifications: () => set({ notifications: [] }),

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
