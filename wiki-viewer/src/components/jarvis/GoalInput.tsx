import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2 } from 'lucide-react';

interface GoalInputProps {
  onSubmit: (description: string, strategy: string) => void;
  isLoading: boolean;
}

export function GoalInput({ onSubmit, isLoading }: GoalInputProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || isLoading) return;
    onSubmit(description.trim(), 'balanced');
    setDescription('');
    setHasTyped(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    if (e.target.value.length > 0 && !hasTyped) setHasTyped(true);
    if (e.target.value.length === 0) setHasTyped(false);
  };

  /* Auto-resize textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [description]);

  return (
    <div className="ji-wrapper ji-entrance">
      <form onSubmit={handleSubmit}>
        <div className={`ji-container ${isFocused ? 'ji-focused' : ''} ${hasTyped && !isFocused ? 'ji-typed' : ''}`}>
          {/* Soft ambient glow layer */}
          <div className="ji-ambient" />
          {/* Subtle top sheen line */}
          <div className="ji-sheen" />
          {/* Bottom accent bar */}
          <div className="ji-accent-bar" />
          {/* Typing indicator shimmer */}
          <div className={`ji-typing-shimmer ${hasTyped ? 'ji-typing-active' : ''}`} />

          {/* Content */}
          <div className="ji-content">
            <textarea
              ref={textareaRef}
              value={description}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={t('jarvis.goal_placeholder', 'Describe what you want Jarvis to do...')}
              className="ji-textarea"
              disabled={isLoading}
              rows={1}
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
