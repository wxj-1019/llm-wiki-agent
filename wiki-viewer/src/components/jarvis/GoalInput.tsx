import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, Wrench, Shield, Zap } from 'lucide-react';

interface GoalInputProps {
  onSubmit: (description: string, strategy: string) => void;
  isLoading: boolean;
}

const STRATEGIES = [
  { value: 'conservative', label: 'Conservative', icon: Shield, desc: 'Only auto L0/L1, ask approval on L2+' },
  { value: 'balanced', label: 'Balanced', icon: Wrench, desc: 'Auto L0-L2, ask on L3+' },
  { value: 'aggressive', label: 'Aggressive', icon: Zap, desc: 'Auto L0-L2, rate-limit L3' },
];

const QUICK_GOALS = [
  'Run health check on wiki',
  'List orphan pages',
  'Build knowledge graph',
  'Find broken links',
];

export function GoalInput({ onSubmit, isLoading }: GoalInputProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState('');
  const [strategy, setStrategy] = useState('balanced');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || isLoading) return;
    onSubmit(description.trim(), strategy);
    setDescription('');
  };

  return (
    <div className="apple-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Send size={18} className="text-apple-blue" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('jarvis.goal_input', 'Agent Goal')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('jarvis.goal_placeholder', 'Describe what you want Jarvis to do...')}
            className="apple-input flex-1 min-h-[80px] resize-y"
            disabled={isLoading}
          />
          <div className="flex flex-col gap-2 min-w-[140px]">
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="apple-input text-sm"
              disabled={isLoading}
            >
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isLoading || !description.trim()}
              className="apple-button flex items-center justify-center gap-2 px-4 py-2 text-sm bg-apple-blue text-white hover:bg-apple-blue/90 disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {t('jarvis.submit', 'Submit')}
            </button>
          </div>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-[var(--text-tertiary)]">Quick:</span>
        {QUICK_GOALS.map((g) => (
          <button
            key={g}
            onClick={() => setDescription(g)}
            disabled={isLoading}
            className="apple-button-ghost text-xs px-2 py-1"
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}
