import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronRight, GitBranch, Target } from 'lucide-react';

export interface ReasoningStep {
  text: string;
  evidence?: string;
}

export interface AlternativeAction {
  label: string;
  description?: string;
}

interface ReasoningChainProps {
  steps: ReasoningStep[];
  alternatives?: AlternativeAction[];
  confidence?: number;
  decision?: string;
  defaultExpanded?: boolean;
}

export function ReasoningChain({ steps, alternatives, confidence, decision, defaultExpanded = false }: ReasoningChainProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!steps || steps.length === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-secondary)]"
      >
        <Brain size={13} className="text-apple-purple shrink-0" />
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--apple-purple)' }}>
          Reasoning
        </span>
        {confidence != null && (
          <span
            className="text-[10px] font-mono-data px-1.5 py-0.5 rounded-full ml-auto mr-1"
            style={{
              backgroundColor: confidence >= 0.9 ? 'rgba(48,209,88,0.1)' : confidence >= 0.7 ? 'rgba(255,159,10,0.1)' : 'rgba(255,69,58,0.1)',
              color: confidence >= 0.9 ? 'var(--apple-green)' : confidence >= 0.7 ? 'var(--apple-orange)' : 'var(--apple-red)',
            }}
          >
            {Math.round(confidence * 100)}%
          </span>
        )}
        {expanded ? <ChevronDown size={12} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={12} className="text-[var(--text-tertiary)]" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {decision && (
                <div className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: 'rgba(191,90,242,0.05)' }}>
                  <Target size={12} className="text-apple-purple mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Decision</span>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-primary)' }}>{decision}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {steps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                    className="flex items-start gap-2"
                  >
                    <div className="flex flex-col items-center shrink-0 mt-1">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono-data"
                        style={{
                          backgroundColor: 'rgba(191,90,242,0.1)',
                          color: 'var(--apple-purple)',
                          border: '1px solid rgba(191,90,242,0.2)',
                        }}
                      >
                        {i + 1}
                      </div>
                      {i < steps.length - 1 && (
                        <div className="w-px h-3 mt-0.5" style={{ backgroundColor: 'rgba(191,90,242,0.15)' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{step.text}</p>
                      {step.evidence && (
                        <p className="text-[10px] mt-0.5 italic" style={{ color: 'var(--text-tertiary)' }}>
                          Evidence: {step.evidence}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {alternatives && alternatives.length > 0 && (
                <div className="pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <GitBranch size={10} className="text-[var(--text-tertiary)]" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                      Alternatives
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {alternatives.map((alt, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full cursor-default"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-tertiary)',
                          border: '1px solid var(--border-default)',
                        }}
                        title={alt.description}
                      >
                        {alt.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
