import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

function useListboxKeyboard({
  open,
  options,
  selectedIndex,
  onSelect,
  onClose,
}: {
  open: boolean;
  options: AppleSelectOption[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onSelect((selectedIndex + 1) % options.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          onSelect((selectedIndex - 1 + options.length) % options.length);
          break;
        case 'Home':
          e.preventDefault();
          onSelect(0);
          break;
        case 'End':
          e.preventDefault();
          onSelect(options.length - 1);
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, options.length, selectedIndex, onSelect, onClose]);
}

export interface AppleSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface AppleSelectProps {
  options: AppleSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  disabled?: boolean;
}

export function AppleSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  id,
  disabled = false,
}: AppleSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedOption = options.find((o) => o.value === value);
  const selectedIndex = options.findIndex((o) => o.value === value);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  const handleHighlight = useCallback(
    (index: number) => {
      setHighlightedIndex(index);
      optionRefs.current[index]?.focus();
    },
    []
  );

  useListboxKeyboard({
    open,
    options,
    selectedIndex: highlightedIndex,
    onSelect: handleHighlight,
    onClose: () => {
      setOpen(false);
      triggerRef.current?.focus();
    },
  });

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sync highlighted index with selected index when opening
  useEffect(() => {
    if (open) {
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [open, selectedIndex]);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm text-[var(--text-secondary)] mb-2"
        >
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={open && options[highlightedIndex] ? `${id}-option-${options[highlightedIndex].value}` : undefined}
        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-[var(--border-strong)]'
        } ${
          open
            ? 'bg-[var(--bg-primary)] border-apple-blue shadow-[0_0_0_4px_color-mix(in_srgb,var(--apple-blue)_18%,transparent)]'
            : 'bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-primary)]'
        }`}
        style={{
          borderColor: open ? 'var(--apple-blue)' : undefined,
        }}
      >
        <span className="flex items-center gap-2.5 truncate">
          {selectedOption?.icon && (
            <span className="shrink-0 text-[var(--text-secondary)]">
              {selectedOption.icon}
            </span>
          )}
          <span className={selectedOption ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}>
            {selectedOption?.label || placeholder}
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-[var(--text-tertiary)]"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop overlay for mobile feel */}
            <div
              className="fixed inset-0 z-40 sm:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-2xl overflow-hidden"
              role="listbox"
            >
              <div className="py-1.5 max-h-72 overflow-y-auto">
                {options.map((option, idx) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      id={`${id}-option-${option.value}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      ref={(el) => { optionRefs.current[idx] = el; }}
                      onClick={() => handleSelect(option.value)}
                      tabIndex={-1}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/30 focus-visible:inset ${
                        isSelected
                          ? 'bg-apple-blue text-white'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        {option.icon && (
                          <span className={`shrink-0 ${isSelected ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}>
                            {option.icon}
                          </span>
                        )}
                        <span className="truncate">{option.label}</span>
                      </span>
                      {isSelected && (
                        <Check size={14} className="shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
