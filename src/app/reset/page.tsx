'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { createClient } from '@/lib/supabase/client';
import { getAuthCallbackUrl } from '@/lib/utils/siteUrl';

export default function ResetPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthCallbackUrl('/'),
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setSent(true);
    setMsg('Check your email for the reset link.');
  }

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-bg lg:grid-cols-[60fr_40fr]">
      <section className="relative flex flex-col px-8 py-10 sm:px-12 sm:py-12">
        <div className="flex items-center gap-2 text-ink">
          <BrandMark size={24} />
          <span className="text-sm font-medium">GlobalTT Editor</span>
        </div>
        <div className="my-auto w-full max-w-[460px]">
          <Eyebrow>RESET PASSWORD</Eyebrow>
          <h1 className="mt-3 font-serif text-[56px] font-light leading-[0.96] tracking-[-0.04em] text-ink sm:text-[72px]">
            <em className="font-serif font-light italic">Forgot</em> your password?
          </h1>
          <p className="mt-5 text-[17px] leading-[1.6] text-ink-2">
            Enter your email and we&apos;ll send you a reset link.
          </p>
          <div className="mt-8">
            {sent ? (
              <div className="rounded-[14px] border border-rule bg-bg-elevated p-6">
                <div className="text-base font-semibold text-ink">Check your inbox.</div>
                <p className="mt-2 text-sm text-ink-2">
                  We sent a reset link to <span className="font-medium text-ink">{email}</span>.
                  Open it from this device to set a new password.
                </p>
                <p className="mt-4 text-sm text-ink-3">
                  Didn&apos;t get it?{' '}
                  <button
                    type="button"
                    onClick={() => { setSent(false); setMsg(null); }}
                    className="text-ink underline decoration-brand decoration-[1.5px] underline-offset-4"
                  >
                    Try a different email
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label htmlFor="reset-email" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                    Email
                  </label>
                  <Input
                    id="reset-email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
                  />
                </div>
                {msg && <div className="text-xs text-danger">{msg}</div>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Sending…' : 'Send reset link'}
                </Button>
                <p className="pt-2 text-sm text-ink-2">
                  Remembered it?{' '}
                  <Link href="/login" className="text-ink underline decoration-brand decoration-[1.5px] underline-offset-4">
                    Back to sign in.
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden lg:block"
        style={{ background: 'var(--gradient-hero)' }}
      >
        <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay [background-image:radial-gradient(rgba(0,0,0,0.6)_1px,transparent_1px)] [background-size:3px_3px]" />
        <div className="relative flex h-full flex-col items-center justify-center px-12">
          <div className="w-[320px] rotate-[-3deg] rounded-xl bg-white p-5 shadow-[0_30px_80px_-20px_rgba(180,66,28,0.35)] xl:w-[360px]">
            <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">ACME CO.</div>
            <div className="mb-3 h-24 rounded bg-bg-cream" />
            <div className="font-serif text-[20px] leading-tight text-ink">
              The <em className="italic">Summer</em> Edit
            </div>
            <p className="mt-2 text-[12px] leading-[1.5] text-ink-2">
              Explore our latest curated collection of intentional essentials.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between border-t border-rule pt-2 text-[11px] text-ink-3">
                <span className="uppercase tracking-wider">Feature 01</span>
                <span className="uppercase tracking-wider">Sustainable fabrics</span>
              </div>
              <div className="flex items-center justify-between border-t border-rule pt-2 text-[11px] text-ink-3">
                <span className="uppercase tracking-wider">Feature 02</span>
                <span className="uppercase tracking-wider">Handcrafted quality</span>
              </div>
            </div>
            <button className="mt-5 w-full rounded-md bg-brand py-2 text-[11px] font-semibold uppercase tracking-wider text-white">
              Shop the sale
            </button>
          </div>
          <div className="mt-10 text-center text-white">
            <span className="inline-block text-[11px] font-medium uppercase leading-none tracking-[0.22em] text-white/80">
              WHAT YOU&apos;LL BUILD
            </span>
            <p className="mt-3 font-serif text-2xl font-light">
              Emails that <em className="italic">ship</em>.
            </p>
            <p className="mt-2 text-sm text-white/80">
              Real-time editing. Brand kits. One-click translation.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
