import { Play, Pause, Square, Volume2, ChevronDown, X } from 'lucide-react';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useTranslation } from 'react-i18next';

interface Props {
  text: string;
  onClose: () => void;
}

export function AudioOverview({ text, onClose }: Props) {
  const { t } = useTranslation();
  const { playing, paused, rate, voice, voices, play, pause, stop, setRate, setVoice } =
    useSpeechSynthesis(text);

  const speedOptions = [0.5, 1, 1.5, 2];

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-2xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Volume2 size={16} className="text-apple-blue" />
          <span className="text-sm font-medium">{t('audio.title')}</span>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label={t('common.close')}
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={playing ? pause : play}
          className="apple-button flex items-center gap-1.5 px-3 py-1.5 text-xs"
          aria-label={playing ? t('audio.pause') : t('audio.play')}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? t('audio.pause') : t('audio.play')}
        </button>
        <button
          onClick={stop}
          className="apple-button-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"
          aria-label={t('audio.stop')}
        >
          <Square size={14} />
          {t('audio.stop')}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-secondary)]">
            {t('audio.speed')}:
          </span>
          <div className="flex items-center bg-[var(--bg-secondary)] rounded-lg overflow-hidden">
            {speedOptions.map((s) => (
              <button
                key={s}
                onClick={() => setRate(s)}
                className={`px-2 py-1 text-xs transition-colors ${
                  rate === s
                    ? 'bg-apple-blue text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="relative">
          <select
            value={voice?.name || ''}
            onChange={(e) => {
              const selectedVoice = voices.find((v) => v.name === e.target.value);
              if (selectedVoice) {
                setVoice(selectedVoice);
              }
            }}
            className="w-full appearance-none bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
            aria-label={t('audio.voice')}
          >
            <option value="" disabled>
              {t('audio.voice')}
            </option>
            {voices.map((v, i) => (
              <option key={`${v.name}-${i}`} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
