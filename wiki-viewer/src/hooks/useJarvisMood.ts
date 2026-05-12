import { useState, useCallback, useRef, useEffect } from 'react';
import type { JarvisMood } from '@/components/jarvis/JarvisAvatar';

interface UseJarvisMoodOptions {
  minThinkingMs?: number; // default 1500
}

export function useJarvisMood(options: UseJarvisMoodOptions = {}) {
  const { minThinkingMs = 1500 } = options;

  const [mood, setMoodState] = useState<JarvisMood>('idle');
  const moodRef = useRef<JarvisMood>('idle');
  const [isDockedLeft, setIsDockedLeft] = useState(false);

  const thinkingStartRef = useRef<number>(0);
  const pendingMoodRef = useRef<JarvisMood | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep moodRef synchronized with state to avoid stale closures
  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  const setMood = useCallback(
    (nextMood: JarvisMood) => {
      const currentMood = moodRef.current;

      // Enforce minimum thinking duration before allowing a transition away from 'thinking'
      if (currentMood === 'thinking' && nextMood !== 'thinking') {
        const elapsed = Date.now() - thinkingStartRef.current;
        const remaining = minThinkingMs - elapsed;

        if (remaining > 0) {
          // Cancel any previously pending timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          pendingMoodRef.current = nextMood;
          timeoutRef.current = setTimeout(() => {
            pendingMoodRef.current = null;
            timeoutRef.current = null;
            setMoodState(nextMood);
          }, remaining);

          return;
        }
      }

      // Record timestamp when entering 'thinking'
      if (nextMood === 'thinking') {
        thinkingStartRef.current = Date.now();
      }

      // Cancel any pending delayed transition
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        pendingMoodRef.current = null;
      }

      setMoodState(nextMood);
    },
    [minThinkingMs]
  );

  const dockLeft = useCallback(() => {
    setIsDockedLeft(true);
  }, []);

  const dockCenter = useCallback(() => {
    setIsDockedLeft(false);
  }, []);

  // Clean up pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    mood,
    setMood,
    isDockedLeft,
    dockLeft,
    dockCenter,
  };
}
