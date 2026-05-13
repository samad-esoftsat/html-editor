import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ slug: string }>;
}

interface BrandKitRow {
  id: string;
  org_id: string;
  name: string;
  is_default: boolean;
  colors: Record<string, unknown>;
  fonts: Record<string, unknown>;
  logo: Record<string, unknown>;
  footer: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const SELECT_COLS =
  'id, org_id, name, is_default, colors, fonts, logo, footer, created_by, created_at, updated_at';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const workspace = await findWorkspace(slug);
  if (!workspace) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data, error } = await supabase
    .from('brand_kits')
    .select(SELECT_COLS)
    .eq('org_id', workspace.org.id)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ brand_kits: (data ?? []) as BrandKitRow[] });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const workspace = await findWorkspace(slug);
  if (!workspace) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!resolveMinRole(workspace.role, 'editor')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    is_default?: unknown;
    colors?: unknown;
    fonts?: unknown;
    logo?: unknown;
    footer?: unknown;
  };

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length === 0 || name.length > 100) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }

  const insert: {
    org_id: string;
    name: string;
    created_by: string;
    is_default: boolean;
    colors?: Record<string, unknown>;
    fonts?: Record<string, unknown>;
    logo?: Record<string, unknown>;
    footer?: Record<string, unknown>;
  } = {
    org_id: workspace.org.id,
    name,
    created_by: user.id,
    is_default: body.is_default === true,
  };

  if (body.colors !== undefined) {
    if (!isPlainObject(body.colors)) return NextResponse.json({ error: 'invalid_colors' }, { status: 400 });
    insert.colors = body.colors;
  }
  if (body.fonts !== undefined) {
    if (!isPlainObject(body.fonts)) return NextResponse.json({ error: 'invalid_fonts' }, { status: 400 });
    insert.fonts = body.fonts;
  }
  if (body.logo !== undefined) {
    if (!isPlainObject(body.logo)) return NextResponse.json({ error: 'invalid_logo' }, { status: 400 });
    insert.logo = body.logo;
  }
  if (body.footer !== undefined) {
    if (!isPlainObject(body.footer)) return NextResponse.json({ error: 'invalid_footer' }, { status: 400 });
    insert.footer = body.footer;
  }

  if (insert.is_default) {
    const { error: clearError } = await supabase
      .from('brand_kits')
      .update({ is_default: false })
      .eq('org_id', workspace.org.id)
      .eq('is_default', true);
    if (clearError) {
      if (clearError.code === '42501') {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      return NextResponse.json({ error: clearError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from('brand_kits')
    .insert(insert)
    .select(SELECT_COLS)
    .single<BrandKitRow>();

  if (error) {
    if (error.code === '42501') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (error.code === '23505') {
      return NextResponse.json({ error: 'default_conflict' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ brand_kit: data }, { status: 201 });
}
