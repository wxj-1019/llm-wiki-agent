import { motion } from 'framer-motion';

interface ConfidenceBarProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

function getConfidenceLevel(value: number): { label: string; color: string; glow: string; icon: string; borderStyle: string } {
  if (value >= 0.9) {
    return { label: '高置信', color: 'var(--apple-green)', glow: 'rgba(48, 209, 88, 0.35)', icon: '●', borderStyle: 'solid' };
  }
  if (value >= 0.7) {
    return { label: '中置信', color: 'var(--apple-orange)', glow: 'rgba(255, 159, 10, 0.35)', icon: '◐', borderStyle: 'dashed' };
  }
  return { label: '低置信', color: 'var(--apple-red)', glow: 'rgba(255, 69, 58, 0.35)', icon: '○', borderStyle: 'dotted' };
}

const SIZE_MAP = {
  sm: { height: 4, fontSize: '0.625rem' },
  md: { height: 6, fontSize: '0.6875rem' },
  lg: { height: 8, fontSize: '0.75rem' },
};

export function ConfidenceBar({ value, size = 'md', showLabel = true, showIcon = true, className = '' }: ConfidenceBarProps) {
  const pct = Math.max(0, Math.min(1, value));
  const level = getConfidenceLevel(value);
  const dims = SIZE_MAP[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && (
        <span
          className="font-mono-data shrink-0"
          style={{ color: level.color, fontSize: dims.fontSize, textShadow: `0 0 6px ${level.glow}` }}
        >
          {level.icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div
          className="rounded-full overflow-hidden"
          style={{
            height: dims.height,
            backgroundColor: 'var(--bg-tertiary)',
            border: `1px ${level.borderStyle} color-mix(in srgb, ${level.color} 25%, transparent)`,
          }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              backgroundColor: level.color,
              boxShadow: `0 0 8px ${level.glow}`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${pct * 100}%` }}
            transition={{ duration: 0.6, ease: [0.34, 1.4, 0.64, 1] }}
          />
        </div>
      </div>
      {showLabel && (
        <span
          className="font-mono-data shrink-0 tabular-nums"
          style={{ color: level.color, fontSize: dims.fontSize, textShadow: `0 0 4px ${level.glow}`, minWidth: '2.5rem', textAlign: 'right' }}
        >
          {Math.round(pct * 100)}%
        </span>
      )}
    </div>
  );
}
