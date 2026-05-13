import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ slug: string; id: string }>;
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

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
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

  const update: {
    name?: string;
    is_default?: boolean;
    colors?: Record<string, unknown>;
    fonts?: Record<string, unknown>;
    logo?: Record<string, unknown>;
    footer?: Record<string, unknown>;
  } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
    }
    const next = body.name.trim();
    if (next.length === 0 || next.length > 100) {
      return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
    }
    update.name = next;
  }

  if (body.is_default !== undefined) {
    if (typeof body.is_default !== 'boolean') {
      return NextResponse.json({ error: 'invalid_is_default' }, { status: 400 });
    }
    update.is_default = body.is_default;
  }

  for (const key of ['colors', 'fonts', 'logo', 'footer'] as const) {
    if (body[key] !== undefined) {
      if (!isPlainObject(body[key])) {
        return NextResponse.json({ error: `invalid_${key}` }, { status: 400 });
      }
      update[key] = body[key] as Record<string, unknown>;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  if (update.is_default === true) {
    const { error: clearError } = await supabase
      .from('brand_kits')
      .update({ is_default: false })
      .eq('org_id', workspace.org.id)
      .eq('is_default', true)
      .neq('id', id);
    if (clearError) {
      if (clearError.code === '42501') {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      return NextResponse.json({ error: clearError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from('brand_kits')
    .update(update)
    .eq('id', id)
    .eq('org_id', workspace.org.id)
    .select(SELECT_COLS)
    .maybeSingle<BrandKitRow>();

  if (error) {
    if (error.code === '42501') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (error.code === '23505') {
      return NextResponse.json({ error: 'default_conflict' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ brand_kit: data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
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

  const { data, error } = await supabase
    .from('brand_kits')
    .delete()
    .eq('id', id)
    .eq('org_id', workspace.org.id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '42501') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
