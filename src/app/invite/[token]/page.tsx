import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { InviteAcceptPanel } from './InviteAcceptPanel';

interface Props {
  params: Promise<{ token: string }>;
}

export const metadata = { title: 'Accept invite - GlobalTT Editor' };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <main className="relative min-h-dvh bg-bg">
      <div className="absolute left-8 top-8 flex items-center gap-2 text-ink sm:left-12 sm:top-12">
        <BrandMark size={24} />
        <span className="text-sm font-medium">GlobalTT Editor</span>
      </div>
      <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center px-6 text-center">
        <Eyebrow>INVITATION</Eyebrow>
        <h1 className="mt-4 font-serif text-[40px] font-light leading-[1.05] tracking-[-0.03em] text-ink sm:text-[48px]">
          You&apos;ve been invited<br />
          to <em className="font-serif font-light italic">GlobalTT Editor</em>
        </h1>
        <p className="mt-6 max-w-[420px] text-[17px] leading-[1.6] text-ink-2">
          Sign in to confirm and join the workspace as{' '}
          <span className="font-medium text-ink">{user.email ?? 'this account'}</span>.
        </p>
        <InviteAcceptPanel token={token} email={user.email ?? ''} />
        <p className="mt-10 text-sm text-ink-3">
          This invitation expires in 7 days. Powered by{' '}
          <Link href="/" className="text-ink underline decoration-brand decoration-[1.5px] underline-offset-4">
            GlobalTT Editor
          </Link>
        </p>
      </div>
    </main>
  );
}
