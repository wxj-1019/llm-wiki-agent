import { useState, useCallback, useRef } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
  paused: boolean;
  progress: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Map<string, number>>(new Map());

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type, paused: false, progress: 100 }]);

    const timer = window.setInterval(() => {
      setToasts((prev) => {
        const toast = prev.find((t) => t.id === id);
        if (!toast) {
          window.clearInterval(timer);
          return prev;
        }
        if (toast.paused) return prev;
        const next = toast.progress - (100 / 30);
        if (next <= 0) {
          window.clearInterval(timer);
          toastTimers.current.delete(id);
          return prev.filter((t) => t.id !== id);
        }
        return prev.map((t) => t.id === id ? { ...t, progress: next } : t);
      });
    }, 100);

    toastTimers.current.set(id, timer);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer) {
      window.clearInterval(timer);
      toastTimers.current.delete(id);
    }
  }, []);

  return { toasts, setToasts, addToast, removeToast };
}
