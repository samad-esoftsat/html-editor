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
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-6"
          variants={fade}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <motion.div
            className="bg-panel border border-border-strong rounded-xl p-6 w-[420px]"
            variants={scaleFade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="font-semibold text-fg mb-2">{state.title}</div>
            {state.message && (
              <div className="text-sm text-muted mb-4">{state.message}</div>
            )}
            {state.label ? (
              <label className="mb-6 block text-xs font-medium text-muted-2">
                <span className="mb-1 block">{state.label}</span>
                <input
                  ref={inputRef}
                  className="w-full rounded border border-border-strong bg-panel-2 px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-brand"
                  value={value}
                  placeholder={state.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={onKeyDown}
                />
              </label>
            ) : (
              <input
                ref={inputRef}
                className="mb-6 w-full rounded border border-border-strong bg-panel-2 px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-brand"
                value={value}
                placeholder={state.placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
              />
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => state.resolve(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => state.resolve(value)}>
                {state.confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
