'use client';
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './Button';
import { fade, scaleFade } from '@/lib/motion';
import { subscribe, type PromptState } from '@/lib/utils/prompt';

export function PromptDialog() {
  const [state, setState] = useState<PromptState | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => subscribe((s) => {
    setState(s);
    setValue(s?.defaultValue ?? '');
  }), []);

  useEffect(() => {
    if (!state) return;
    // Focus and select after the modal mounts.
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [state]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      state!.resolve(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      state!.resolve(null);
    }
  };

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-6"
          variants={fade}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <motion.div
            className="w-[420px] max-w-full rounded-[14px] border border-rule bg-bg-elevated p-6 shadow-[0_30px_80px_-20px_rgba(20,20,20,0.25)]"
            variants={scaleFade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="mb-1 text-[20px] font-semibold tracking-[-0.01em] text-ink">{state.title}</div>
            {state.message && (
              <div className="text-sm text-ink-3 mb-4">{state.message}</div>
            )}
            {state.label ? (
              <div className="mb-6">
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                  {state.label}
                </label>
                <input
                  ref={inputRef}
                  className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
                  value={value}
                  placeholder={state.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={onKeyDown}
                />
              </div>
            ) : (
              <input
                ref={inputRef}
                className="mb-6 h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
                value={value}
                placeholder={state.placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
              />
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => state.resolve(null)}>Cancel</Button>
              <Button onClick={() => state.resolve(value)}>
                {state.confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
