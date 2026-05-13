create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  request_key text,
  storage_path text not null unique,
  mime_type text not null,
  width int,
  height int,
  source text not null check (source in ('upload', 'generate', 'edit')),
  prompt text,
  provider text,
  alt_text text,
  original_filename text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists assets_org_created_at_idx
  on public.assets (org_id, created_at desc);

create index if not exists assets_org_archived_created_at_idx
  on public.assets (org_id, archived_at, created_at desc);

create index if not exists assets_org_request_key_idx
  on public.assets (org_id, request_key);

create table if not exists public.image_generation_usage (
  org_id uuid not null references public.organizations(id) on delete cascade,
  period date not null,
  count int not null default 0,
  primary key (org_id, period)
);

create table if not exists public.image_generation_requests (
  org_id uuid not null references public.organizations(id) on delete cascade,
  request_key text not null,
  created_by uuid not null references auth.users(id),
  kind text not null check (kind in ('generate', 'edit', 'remove_bg')),
  status text not null check (status in ('processing', 'completed', 'failed')),
  asset_id uuid references public.assets(id) on delete set null,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, request_key)
);

create index if not exists image_generation_requests_org_created_at_idx
  on public.image_generation_requests (org_id, created_at desc);

alter table public.organizations
  add column if not exists image_quota_monthly int not null default 100;

create or replace function public.consume_image_quota(p_org_id uuid, p_limit int)
returns table(ok boolean, remaining int, quota_period date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_count int;
begin
  insert into public.image_generation_usage (org_id, period, count)
       values (p_org_id, v_period, 0)
  on conflict (org_id, period) do nothing;

  select usage_row.count into v_count
    from public.image_generation_usage as usage_row
   where usage_row.org_id = p_org_id and usage_row.period = v_period
   for update;

  if v_count >= p_limit then
    return query select false, 0, v_period;
    return;
  end if;

  update public.image_generation_usage as usage_row
     set count = usage_row.count + 1
   where usage_row.org_id = p_org_id and usage_row.period = v_period;

  return query select true, p_limit - (v_count + 1), v_period;
end;
$$;

create or replace function public.refund_image_quota(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
begin
  update public.image_generation_usage as usage_row
     set count = greatest(usage_row.count - 1, 0)
   where usage_row.org_id = p_org_id and usage_row.period = v_period;
end;
$$;

alter table public.assets enable row level security;

drop policy if exists "assets_select_member" on public.assets;
create policy "assets_select_member" on public.assets
  for select to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'viewer'));

drop policy if exists "assets_insert_editor" on public.assets;
create policy "assets_insert_editor" on public.assets
  for insert to authenticated
  with check (public.is_org_member(org_id, auth.uid(), 'editor'));

drop policy if exists "assets_update_editor" on public.assets;
create policy "assets_update_editor" on public.assets
  for update to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'editor'))
  with check (public.is_org_member(org_id, auth.uid(), 'editor'));
