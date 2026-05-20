'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { getAuthCallbackUrl } from '@/lib/utils/siteUrl';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthCallbackUrl() },
    });
    setBusy(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    setMsg({ kind: 'ok', text: 'Check your email to confirm your account.' });
  }

  async function googleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthCallbackUrl() },
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="signup-email" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
          Email
        </label>
        <Input
          id="signup-email"
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
        />
      </div>
      <div>
        <label htmlFor="signup-password" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
          Password
        </label>
        <Input
          id="signup-password"
          type="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
        />
      </div>
      {msg && (
        <div className={msg.kind === 'ok' ? 'text-xs text-success' : 'text-xs text-danger'}>
          {msg.text}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Creating…' : 'Create account'}
      </Button>
      <div className="relative my-2 flex items-center text-[11px] uppercase tracking-[0.22em] text-ink-3">
        <span className="flex-1 border-t border-rule" />
        <span className="px-3">or</span>
        <span className="flex-1 border-t border-rule" />
      </div>
      <Button type="button" variant="ghost" className="w-full" onClick={googleSignIn}>
        <span className="font-semibold">G</span>
        Sign up with Google
      </Button>
      <p className="pt-2 text-sm text-ink-2">
        Already have an account?{' '}
        <Link href="/login" className="text-ink underline decoration-brand decoration-[1.5px] underline-offset-4">
          Sign in.
        </Link>
      </p>
    </form>
  );
}
