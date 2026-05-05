import { useEffect } from 'react';

/**
 * Lock body scroll while `locked` is true.
 * Restores original overflow on unlock or unmount.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [locked]);
}
