-- NOTE: This migration was applied directly to the remote DB before being checked in.
-- It is written here for replayability / fresh local environments.

create extension if not exists citext;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug citext unique not null,
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.tg_set_updated_at();

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists organization_members_user_id_idx
  on public.organization_members(user_id);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email citext not null,
  role text not null check (role in ('owner','editor','viewer')),
  token text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists organization_invites_org_id_idx
  on public.organization_invites(org_id);

create index if not exists organization_invites_email_idx
  on public.organization_invites(email);

create table if not exists public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  colors jsonb not null default '{}'::jsonb,
  fonts jsonb not null default '{}'::jsonb,
  logo jsonb not null default '{}'::jsonb,
  footer jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger brand_kits_set_updated_at
before update on public.brand_kits
for each row execute function public.tg_set_updated_at();

create unique index if not exists brand_kits_one_default_per_org
  on public.brand_kits(org_id) where is_default;

alter table public.projects
  add column if not exists org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists brand_kit_id uuid references public.brand_kits(id) on delete set null;

create index if not exists projects_org_id_updated_at_idx
  on public.projects(org_id, updated_at desc);

do $$
declare
  u record;
  new_org uuid;
  base_slug text;
  candidate text;
  suffix int;
begin
  for u in
    select distinct p.user_id, coalesce(au.email, 'user') as email
    from public.projects p
    join auth.users au on au.id = p.user_id
    where p.org_id is null
  loop
    base_slug := lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9]+', '-', 'g'));
    if base_slug = '' then
      base_slug := 'workspace';
    end if;

    candidate := base_slug;
    suffix := 1;

    while exists (select 1 from public.organizations where slug = candidate) loop
      suffix := suffix + 1;
      candidate := base_slug || '-' || suffix;
    end loop;

    insert into public.organizations (slug, name, created_by)
    values (candidate, initcap(replace(base_slug, '-', ' ')) || ' Workspace', u.user_id)
    returning id into new_org;

    insert into public.organization_members (org_id, user_id, role)
    values (new_org, u.user_id, 'owner');

    update public.projects
    set org_id = new_org
    where user_id = u.user_id and org_id is null;
  end loop;
end;
$$;

alter table public.projects alter column org_id set not null;
