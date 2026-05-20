'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { getAuthCallbackUrl } from '@/lib/utils/siteUrl';

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

  async function googleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthCallbackUrl(next) },
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="login-email" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
          Email
        </label>
        <Input
          id="login-email"
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
            Password
          </label>
          <Link href="/reset" className="text-[11px] text-brand-ink underline-offset-4 hover:underline">
            Forgot?
          </Link>
        </div>
        <Input
          id="login-password"
          type="password"
          required
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
        />
      </div>
      {error && <div className="text-xs text-danger">{error}</div>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Signing in…' : 'Continue'}
      </Button>
      <div className="relative my-2 flex items-center text-[11px] uppercase tracking-[0.22em] text-ink-3">
        <span className="flex-1 border-t border-rule" />
        <span className="px-3">or</span>
        <span className="flex-1 border-t border-rule" />
      </div>
      <Button type="button" variant="ghost" className="w-full" onClick={googleSignIn}>
        <span className="font-semibold">G</span>
        Continue with Google
      </Button>
      <p className="pt-2 text-sm text-ink-2">
        New to GlobalTT?{' '}
        <Link href="/signup" className="text-ink underline decoration-brand decoration-[1.5px] underline-offset-4">
          Create an account.
        </Link>
      </p>
    </form>
  );
}
