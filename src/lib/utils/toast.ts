type Kind = 'info' | 'success' | 'error';
export interface Toast { id: number; kind: Kind; message: string; ttl: number; }

type Listener = (toasts: Toast[]) => void;
const listeners = new Set<Listener>();
let toasts: Toast[] = [];
let nextId = 1;

function emit() { listeners.forEach((l) => l(toasts)); }

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(toasts);
  return () => { listeners.delete(l); };
}

export function pushToast(message: string, kind: Kind = 'info', ttl = 4000) {
  const t: Toast = { id: nextId++, kind, message, ttl };
  toasts = [...toasts, t];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emit();
  }, ttl);
}

export const toast = {
  info: (m: string) => pushToast(m, 'info'),
  success: (m: string) => pushToast(m, 'success'),
  error: (m: string) => pushToast(m, 'error', 6000),
};
