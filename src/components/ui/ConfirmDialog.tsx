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
            <div className="text-sm text-muted mb-6">{state.message}</div>
            <div className="flex gap-2 justify-end">
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
