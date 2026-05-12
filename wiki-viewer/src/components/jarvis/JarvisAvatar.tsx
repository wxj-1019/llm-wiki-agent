import { useEffect, useRef } from 'react';

interface JarvisAvatarProps {
  size?: number;
  isActive?: boolean;
}

/* Gooey blob avatar — blur+contrast organic fusion effect
   Original CSS from uiverse.io / andrew-manzyk / young-walrus-64
   Animation driven by requestAnimationFrame to bypass any CSS overrides */

const BLOB_CONFIG = [
  /* Large triangle — top */
  { clipPath: 'polygon(25% 25%, 75% 25%, 50% 75%)', origin: '50% 50%', speed: 1, reverse: true, delay: 0 },
  /* Large triangle — bottom */
  { clipPath: 'polygon(50% 25%, 75% 75%, 25% 75%)', origin: '50% 60%', speed: 1, reverse: false, delay: -1 / 3 },
  /* Small triangle — upper-left */
  { clipPath: 'polygon(35% 35%, 65% 35%, 50% 65%)', origin: '40% 40%', speed: 1, reverse: true, delay: 0 },
  /* Small triangle — upper-left offset */
  { clipPath: 'polygon(35% 35%, 65% 35%, 50% 65%)', origin: '40% 40%', speed: 1, reverse: true, delay: -0.5 },
  /* Small triangle — upper-right */
  { clipPath: 'polygon(35% 35%, 65% 35%, 50% 65%)', origin: '60% 40%', speed: 1, reverse: false, delay: 0 },
  /* Small triangle — upper-right offset */
  { clipPath: 'polygon(35% 35%, 65% 35%, 50% 65%)', origin: '60% 40%', speed: 1, reverse: false, delay: -2 / 3 },
  /* Extra small triangle — center */
  { clipPath: 'polygon(40% 40%, 60% 40%, 50% 60%)', origin: '50% 50%', speed: 0.8, reverse: false, delay: -0.25 },
];

const JA_TIME = 2; // seconds per rotation cycle

export function JarvisAvatar({ size = 120, isActive = false }: JarvisAvatarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();

    const animate = (now: number) => {
      const t = (now - startRef.current) / 1000; // seconds

      // Blob rotations
      BLOB_CONFIG.forEach((cfg, i) => {
        const el = blobRefs.current[i];
        if (!el) return;
        const elapsed = t + cfg.delay * JA_TIME;
        const angle = ((elapsed / (JA_TIME * cfg.speed)) * 360) * (cfg.reverse ? -1 : 1);
        el.style.transform = `rotate(${angle}deg)`;
      });

      // Root hue-rotate (ja-colorize)
      if (rootRef.current) {
        const hueCycle = (t / (JA_TIME * 3)) % 1;
        const hueDeg = Math.sin(hueCycle * Math.PI * 2) * (-20);
        rootRef.current.style.filter = `hue-rotate(${hueDeg}deg)`;
      }

      // Overlay glow pulse (ja-pulse-glow)
      if (overlayRef.current && isActive) {
        const glowCycle = (t / 1.2) % 1;
        const intensity = 0.5 + Math.sin(glowCycle * Math.PI * 2) * 0.5; // 0..1
        const spread1 = 15 + intensity * 20;
        const spread2 = 10 + intensity * 10;
        const blur1 = 2 + intensity * 6;
        const blur2 = 2 + intensity * 6;
        overlayRef.current.style.boxShadow =
          `inset 0 ${spread1}px ${blur1}px 0 rgba(255,191,72,0.5), ` +
          `inset 0 -${spread2}px ${blur2}px 0 rgba(191,74,29,0.5)`;
      } else if (overlayRef.current) {
        overlayRef.current.style.boxShadow =
          'inset 0 5px 5px 0 rgba(255,191,72,0.5), ' +
          'inset 0 -5px 5px 0 rgba(191,74,29,0.5)';
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive]);

  const scale = size / 100;

  return (
    <div
      ref={rootRef}
      className="jarvis-avatar"
      data-active={isActive}
      style={{ '--ja-scale': scale } as React.CSSProperties}
    >
      {/* Core blob effect container — blur+contrast applied at container level */}
      <div className="ja-blob-layer">
        <div className="ja-blob-container">
          {BLOB_CONFIG.map((cfg, i) => (
            <div
              key={i}
              ref={(el) => { blobRefs.current[i] = el; }}
              className="ja-blob"
              style={{
                '--i': i,
                clipPath: cfg.clipPath,
                transformOrigin: cfg.origin,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
      {/* Glass overlay: borders + inset shadow on top of blob */}
      <div
        ref={overlayRef}
        className="ja-overlay"
        style={{
          opacity: isActive ? 1 : 0.65,
          transition: 'opacity 0.5s ease',
        }}
      />
    </div>
  );
}
