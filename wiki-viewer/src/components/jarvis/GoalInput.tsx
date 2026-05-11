import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2 } from 'lucide-react';

interface GoalInputProps {
  onSubmit: (description: string, strategy: string) => void;
  isLoading: boolean;
}

export function GoalInput({ onSubmit, isLoading }: GoalInputProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || isLoading) return;
    onSubmit(description.trim(), 'balanced');
    setDescription('');
  };

  return (
    <div className="ji-wrapper">
      <form onSubmit={handleSubmit}>
        {/* Main input container with all visual effects */}
        <div className="ji-container">
          {/* Background gradient fade layer */}
          <div className="ji-bg-fade" />
          {/* Ripple circle */}
          <div className="ji-ripple" />
          {/* Floating dots */}
          <div className="ji-dots">
            <span /><span /><span /><span />
          </div>
          {/* Bottom underline */}
          <div className="ji-underline" />

          {/* Content */}
          <div className="ji-content">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('jarvis.goal_placeholder', 'Describe what you want Jarvis to do...')}
              className="ji-textarea"
              disabled={isLoading}
              rows={3}
            />
            <button
              type="submit"
              disabled={isLoading || !description.trim()}
              className="ji-submit"
              aria-label={t('jarvis.submit', 'Submit')}
            >
              {isLoading ? (
                <Loader2 size={18} className="ji-icon animate-spin" />
              ) : (
                <Send size={18} className="ji-icon" />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
