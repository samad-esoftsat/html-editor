'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-80 space-y-4 rounded-xl border border-border-strong bg-panel-2 p-8"
    >
      <div className="text-center">
        <div className="text-2xl font-extrabold text-brand">GT</div>
        <div className="text-sm text-muted">GlobalTT Email Editor</div>
      </div>
      <Input
        type="email"
        required
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        type="password"
        required
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <div className="text-xs text-danger">{error}</div>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Signing in...' : 'Sign In'}
      </Button>
      <div className="text-center text-xs text-muted-2">
        No account? <Link href="/signup" className="text-brand">Sign up</Link>
        {' / '}<Link href="/reset" className="text-brand">Forgot password</Link>
      </div>
    </form>
  );
}
