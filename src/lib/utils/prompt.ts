type Listener = (state: PromptState | null) => void;

export interface PromptState {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel: string;
  resolve: (value: string | null) => void;
}

const listeners = new Set<Listener>();
let current: PromptState | null = null;

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(current);
  return () => { listeners.delete(l); };
}

export function promptDialog(opts: {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    current = {
      title: opts.title,
      message: opts.message,
      label: opts.label,
      placeholder: opts.placeholder,
      defaultValue: opts.defaultValue,
      confirmLabel: opts.confirmLabel ?? 'OK',
      resolve: (value) => {
        current = null;
        listeners.forEach((l) => l(null));
        resolve(value === null ? null : value.trim());
      },
    };
    listeners.forEach((l) => l(current));
  });
}
