import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ token: string }>;
}

interface AcceptRow {
  org_id: string;
  slug: string;
  role: 'owner' | 'editor' | 'viewer';
}

function mapAcceptError(message: string, code: string | undefined) {
  if (code === '28000') return { status: 401, error: 'unauthorized' };
  if (code === 'P0002') return { status: 404, error: 'invite_not_found' };
  if (code === 'P0001') {
    if (message.includes('invite_already_accepted')) return { status: 409, error: 'invite_already_accepted' };
    if (message.includes('invite_expired')) return { status: 410, error: 'invite_expired' };
    if (message.includes('invite_email_mismatch')) return { status: 403, error: 'invite_email_mismatch' };
    return { status: 400, error: message };
  }
  return { status: 500, error: message };
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .rpc('accept_invite', { p_token: token })
    .returns<AcceptRow[]>();

  if (error) {
    const mapped = mapAcceptError(error.message, error.code);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return NextResponse.json({ error: 'invite_not_found' }, { status: 404 });

  return NextResponse.json(row);
}
