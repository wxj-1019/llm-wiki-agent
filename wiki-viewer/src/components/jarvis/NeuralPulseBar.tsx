import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface ToolItem {
  name: string;
  risk_level: string;
}

const RISK_ORDER: Record<string, number> = {
  L0: 0, L1: 1, L2: 2, L3: 3, L4: 4,
};

const RISK_COLOR: Record<string, string> = {
  L0: '#30d158',
  L1: '#64d2ff',
  L2: '#ff9f0a',
  L3: '#ff453a',
  L4: '#ff1a44',
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function NeuralPulseBar({ tools, isRunning }: { tools: ToolItem[]; isRunning: boolean }) {
  const segments = useMemo(() => {
    const rng = seededRandom(42);
    const count = Math.max(tools.length, 24);
    const segs: { color: string; delay: number; duration: number; width: number }[] = [];

    for (let i = 0; i < count; i++) {
      const tool = tools[i];
      const color = tool ? RISK_COLOR[tool.risk_level] || '#64d2ff' : '#64d2ff';
      const riskVal = tool ? (RISK_ORDER[tool.risk_level] ?? 1) : 1;
      segs.push({
        color,
        delay: rng() * -3,
        duration: 1.2 + rng() * 1.6 + riskVal * 0.3,
        width: 2 + Math.floor(rng() * 4),
      });
    }
    return segs;
  }, [tools]);

  return (
    <div className="relative h-1 w-full overflow-hidden mb-2">
      <div className="absolute inset-0 flex gap-[2px]" style={{ opacity: isRunning ? 0.7 : 0.5 }}>
        {segments.map((seg, i) => (
          <motion.div
            key={i}
            className="h-full rounded-full"
            style={{
              width: `${seg.width}px`,
              backgroundColor: seg.color,
            }}
            animate={{
              opacity: [0.4, 1, 0.4],
              scaleX: [1, 1.08, 1],
            }}
            transition={{
              duration: seg.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: seg.delay,
            }}
          />
        ))}
      </div>
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(100,210,255,0.25), transparent)',
        }}
      />
    </div>
  );
}
