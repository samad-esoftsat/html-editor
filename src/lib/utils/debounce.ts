export interface Debounced<F extends (...args: unknown[]) => unknown> {
  (...args: Parameters<F>): void;
  flush(): void;
  cancel(): void;
  pending(): boolean;
}

export function debounce<F extends (...args: unknown[]) => unknown>(fn: F, ms: number): Debounced<F> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<F> | null = null;

  const wrapped = ((...args: Parameters<F>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
      lastArgs = null;
    }, ms);
  }) as Debounced<F>;

  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  wrapped.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  };

  wrapped.pending = () => timer !== null;

  return wrapped;
}
