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
    <form
      onSubmit={onSubmit}
      className="w-80 space-y-4 rounded-xl border border-border-strong bg-panel-2 p-8"
    >
      <div className="text-center">
        <div className="text-2xl font-extrabold text-brand">GT</div>
        <div className="text-sm text-muted">Create account</div>
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
        minLength={8}
        placeholder="Password (8+ chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {msg && (
        <div className={msg.kind === 'ok' ? 'text-xs text-success' : 'text-xs text-danger'}>
          {msg.text}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Creating...' : 'Sign Up'}
      </Button>
      <Button type="button" variant="secondary" className="w-full" onClick={googleSignIn}>
        G &nbsp; Sign up with Google
      </Button>
      <div className="text-center text-xs text-muted-2">
        Already have an account? <Link href="/login" className="text-brand">Sign in</Link>
      </div>
    </form>
  );
}
