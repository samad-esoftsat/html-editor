import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { assetUrlFromPath, startOfCurrentUtcMonth } from '@/lib/images/assets';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const workspace = await findWorkspace(slug);
  if (!workspace) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!resolveMinRole(workspace.role, 'viewer')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const search = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === 'true';

  let query = supabase
    .from('assets')
    .select('*')
    .eq('org_id', workspace.org.id)
    .order('created_at', { ascending: false });

  if (!includeArchived) query = query.is('archived_at', null);
  if (search) {
    const escaped = search.replace(/[%_]/g, (match) => `\\${match}`);
    query = query.or(
      `alt_text.ilike.%${escaped}%,prompt.ilike.%${escaped}%,original_filename.ilike.%${escaped}%`,
    );
  }

  const [{ data, error }, usageResult, orgResult] = await Promise.all([
    query,
    supabase
      .from('image_generation_usage')
      .select('count, period')
      .eq('org_id', workspace.org.id)
      .eq('period', startOfCurrentUtcMonth())
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('image_quota_monthly')
      .eq('id', workspace.org.id)
      .maybeSingle(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (usageResult.error) return NextResponse.json({ error: usageResult.error.message }, { status: 500 });
  if (orgResult.error) return NextResponse.json({ error: orgResult.error.message }, { status: 500 });

  const limit = orgResult.data?.image_quota_monthly ?? 100;
  const count = usageResult.data?.count ?? 0;
  const period = usageResult.data?.period ?? startOfCurrentUtcMonth();

  return NextResponse.json({
    assets: (data ?? []).map((asset) => ({
      ...asset,
      url: assetUrlFromPath(asset.storage_path),
    })),
    usage: {
      count,
      limit,
      remaining: Math.max(limit - count, 0),
      period,
    },
  });
}
