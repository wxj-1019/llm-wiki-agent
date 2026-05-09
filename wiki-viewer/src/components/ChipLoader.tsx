import { Loader2 } from 'lucide-react';

interface ChipLoaderProps {
  text?: string;
}

export function ChipLoader({ text }: ChipLoaderProps) {
  return (
    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
      <Loader2 size={16} className="animate-spin" />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
}
