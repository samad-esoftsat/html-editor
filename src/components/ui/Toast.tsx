'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { slideInRight } from '@/lib/motion';
import { subscribe, type Toast as T } from '@/lib/utils/toast';

const KIND_STYLE: Record<T['kind'], string> = {
  info: 'border-border-strong text-fg',
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger',
};

const ICON: Record<T['kind'], React.ComponentType<{ size?: number }>> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

export function ToastViewport() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => subscribe(setItems), []);
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              variants={slideInRight}
              initial="hidden"
              animate="show"
              exit="exit"
              className={`flex items-start gap-2 rounded-lg bg-panel-2 border ${KIND_STYLE[t.kind]} px-4 py-3 text-sm shadow-lg`}
            >
              <Icon size={16} />
              <span>{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
