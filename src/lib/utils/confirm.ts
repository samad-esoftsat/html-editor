type Listener = (state: ConfirmState | null) => void;
export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

const listeners = new Set<Listener>();
let current: ConfirmState | null = null;

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(current);
  return () => { listeners.delete(l); };
}

export function confirmDialog(opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    current = {
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'Confirm',
      danger: opts.danger,
      resolve: (ok) => { current = null; listeners.forEach((l) => l(null)); resolve(ok); },
    };
    listeners.forEach((l) => l(current));
  });
}
