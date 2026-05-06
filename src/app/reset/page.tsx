'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { getAuthCallbackUrl } from '@/lib/utils/siteUrl';

export default function ResetPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthCallbackUrl('/'),
    });
    setBusy(false);
    setMsg(error ? error.message : 'Check your email for the reset link.');
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-80 space-y-4 rounded-xl border border-border-strong bg-panel-2 p-8"
      >
        <div className="text-center text-sm text-muted">Reset password</div>
        <Input
          type="email"
          required
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {msg && <div className="text-xs text-muted">{msg}</div>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Sending...' : 'Send reset link'}
        </Button>
        <div className="text-center text-xs text-muted-2">
          <Link href="/login" className="text-brand">Back to sign in</Link>
        </div>
      </form>
    </main>
  );
}
