import type { Transition, Variants } from 'motion/react';

export const duration = {
  fast: 0.15,
  base: 0.2,
  slow: 0.3,
} as const;

export const easing = {
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
  in: [0.4, 0, 1, 1] as [number, number, number, number],
};

export const spring = {
  soft: { type: 'spring', stiffness: 300, damping: 28, mass: 0.6 } satisfies Transition,
  snappy: { type: 'spring', stiffness: 500, damping: 32, mass: 0.5 } satisfies Transition,
  press: { type: 'spring', stiffness: 700, damping: 30, mass: 0.4 } satisfies Transition,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: easing.out } },
  exit: { opacity: 0, y: 4, transition: { duration: duration.fast, ease: easing.in } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.base, ease: easing.out } },
  exit: { opacity: 0, transition: { duration: duration.fast, ease: easing.in } },
};

export const scaleFade: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: duration.base, ease: easing.out } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: duration.fast, ease: easing.in } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  show: { opacity: 1, x: 0, transition: spring.soft },
  exit: { opacity: 0, x: 24, transition: { duration: duration.fast, ease: easing.in } },
};

export const staggerContainer = (stagger = 0.04, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});
