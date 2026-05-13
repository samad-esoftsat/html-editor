import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Role = 'owner' | 'editor' | 'viewer';

export interface WorkspaceContext {
  org: { id: string; slug: string; name: string };
  role: Role;
  userId: string;
}

const ORDER: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

interface MembershipRow {
  role: Role;
  organizations: {
    id: string;
    slug: string;
    name: string;
  } | null;
}

export function resolveMinRole(role: Role, min: Role): boolean {
  return ORDER[role] >= ORDER[min];
}

export async function findWorkspace(slug: string): Promise<WorkspaceContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('role, organizations!inner(id, slug, name)')
    .eq('user_id', user.id)
    .eq('organizations.slug', slug)
    .maybeSingle<MembershipRow>();

  if (error || !data?.organizations) {
    return null;
  }

  return {
    org: data.organizations,
    role: data.role,
    userId: user.id,
  };
}

export async function requireWorkspace(slug: string): Promise<WorkspaceContext> {
  const ctx = await findWorkspace(slug);
  if (!ctx) {
    notFound();
  }
  return ctx;
}

export async function requireWorkspaceRole(slug: string, min: Role): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace(slug);
  if (!resolveMinRole(ctx.role, min)) {
    notFound();
  }
  return ctx;
}

export interface WorkspaceListItem {
  id: string;
  slug: string;
  name: string;
  role: Role;
}

export async function listUserWorkspaces(): Promise<WorkspaceListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('organization_members')
    .select('role, organizations!inner(id, slug, name)')
    .eq('user_id', user.id)
    .order('slug', { foreignTable: 'organizations', ascending: true })
    .returns<MembershipRow[]>();

  if (error) return [];
  return (data ?? [])
    .filter((row) => row.organizations !== null)
    .map((row) => ({
      id: row.organizations!.id,
      slug: row.organizations!.slug,
      name: row.organizations!.name,
      role: row.role,
    }));
}
