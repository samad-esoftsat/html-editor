'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './Button';
import { fade, scaleFade } from '@/lib/motion';
import { subscribe, type ConfirmState } from '@/lib/utils/confirm';

export function ConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null);
  useEffect(() => subscribe(setState), []);
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
            <div className="text-sm text-ink-3 mb-6">{state.message}</div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => state.resolve(false)}>Cancel</Button>
              <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => state.resolve(true)}>
                {state.confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
