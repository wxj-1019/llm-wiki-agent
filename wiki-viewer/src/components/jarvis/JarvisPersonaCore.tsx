import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { JarvisAvatar, type JarvisMood } from '@/components/jarvis/JarvisAvatar';
import { JarvisReplyBubble } from '@/components/jarvis/JarvisReplyBubble';
import { GoalInput } from '@/components/jarvis/GoalInput';
import type { ChatMessage } from '@/components/jarvis/JarvisChatMessage';

interface JarvisPersonaCoreProps {
  mood: JarvisMood;
  isDockedLeft: boolean;
  visibleMessages: ChatMessage[];
  avatarStatusText: string;
  hasActiveExecution: boolean;
  isLoading: boolean;
  onSubmit: (description: string, strategy: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (value: string) => void;
  onReplyComplete?: () => void;
}

const QUICK_ACTIONS = [
  'Run health check',
  'List orphan pages',
  'Build knowledge graph',
  'Find broken links',
];

export function JarvisPersonaCore({
  mood,
  isDockedLeft,
  visibleMessages,
  avatarStatusText,
  hasActiveExecution,
  isLoading,
  onSubmit,
  onFocus,
  onBlur,
  onChange,
  onReplyComplete,
}: JarvisPersonaCoreProps) {
  const lastAssistantIndex = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i].role === 'assistant') {
        return i;
      }
    }
    return -1;
  }, [visibleMessages]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Avatar — absolutely positioned, floats above all content */}
      <motion.div
        className="absolute z-10 pointer-events-none"
        initial={false}
        animate={{
          left: isDockedLeft ? '0.5rem' : '50%',
          top: isDockedLeft ? '0.5rem' : '35%',
          x: isDockedLeft ? 0 : '-50%',
          y: isDockedLeft ? 0 : '-50%',
          scale: isDockedLeft ? 0.4 : 1.0,
        }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <JarvisAvatar size={120} isActive={hasActiveExecution} mood={mood} />
      </motion.div>

      {/* Content Zone — switches between empty and conversation states */}
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {!isDockedLeft ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full"
            >
              <div className="flex-1 min-h-[20px]" />
              <div className="flex flex-col items-center gap-3">
                <div className="h-[120px]" />
                <p className="text-sm text-[var(--text-secondary)] text-center">
                  {avatarStatusText}
                </p>
              </div>
              <div className="flex-1 min-h-[20px]" />
              <div className="flex flex-wrap justify-center gap-2 px-4 pb-4">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action}
                    onClick={() => onSubmit(action, 'balanced')}
                    className="text-sm font-mono-data px-4 py-2 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--apple-teal)]/40 hover:text-[var(--apple-teal)] transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full"
            >
              <div className="shrink-0 h-14" />
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end">
                <div className="space-y-2 px-1 overflow-y-auto">
                  {visibleMessages.map((msg, idx) => {
                    const isLastAssistant =
                      msg.role === 'assistant' && idx === lastAssistantIndex;

                    if (isLastAssistant && msg.content) {
                      return (
                        <div key={msg.id} className="flex justify-start pl-12">
                          <JarvisReplyBubble
                            content={msg.content}
                            onComplete={onReplyComplete}
                          />
                        </div>
                      );
                    }

                    if (msg.role === 'user') {
                      return (
                        <div key={msg.id} className="flex justify-end">
                          <div className="apple-card px-3 py-2 bg-[var(--apple-blue)]/10 border-[var(--apple-blue)]/20 max-w-[80%]">
                            <p className="text-xs text-[var(--text-primary)]">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (msg.role === 'assistant') {
                      return (
                        <div key={msg.id} className="flex justify-start pl-12">
                          <div className="apple-card px-3 py-2 max-w-[85%]">
                            <p className="text-xs text-[var(--text-primary)]">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (msg.role === 'error') {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="apple-card px-3 py-2 bg-apple-red/5 border-apple-red/20 text-apple-red text-xs">
                            {msg.content}
                          </div>
                        </div>
                      );
                    }

                    // system
                    return (
                      <div key={msg.id} className="flex justify-start pl-12">
                        <div className="apple-card px-3 py-2 bg-[var(--bg-tertiary)]/40 max-w-[85%]">
                          <p className="text-xs text-[var(--text-primary)]">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Zone — always visible at the bottom */}
      <div className="shrink-0 pt-1 pb-0">
        <GoalInput
          onSubmit={onSubmit}
          isLoading={isLoading}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
