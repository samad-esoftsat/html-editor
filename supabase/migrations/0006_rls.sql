-- NOTE: Already applied to the remote DB. Checked in for replayability.

drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create or replace function public.is_org_member(
  p_org uuid,
  p_user uuid,
  p_min_role text default 'viewer'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.org_id = p_org
      and m.user_id = p_user
      and case p_min_role
        when 'viewer' then m.role in ('viewer', 'editor', 'owner')
        when 'editor' then m.role in ('editor', 'owner')
        when 'owner' then m.role = 'owner'
      end
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;
alter table public.brand_kits enable row level security;

create policy "orgs_select_member" on public.organizations
  for select to authenticated
  using (public.is_org_member(id, auth.uid(), 'viewer'));

create policy "orgs_update_owner" on public.organizations
  for update to authenticated
  using (public.is_org_member(id, auth.uid(), 'owner'))
  with check (public.is_org_member(id, auth.uid(), 'owner'));

create policy "orgs_delete_owner" on public.organizations
  for delete to authenticated
  using (public.is_org_member(id, auth.uid(), 'owner'));

create policy "orgs_insert_self" on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "members_select_self_or_org" on public.organization_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(org_id, auth.uid(), 'viewer'));

create policy "members_mutate_owner" on public.organization_members
  for all to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'owner'))
  with check (public.is_org_member(org_id, auth.uid(), 'owner'));

create policy "invites_select_member" on public.organization_invites
  for select to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'viewer'));

create policy "invites_mutate_owner" on public.organization_invites
  for all to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'owner'))
  with check (public.is_org_member(org_id, auth.uid(), 'owner'));

create policy "brand_kits_select_member" on public.brand_kits
  for select to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'viewer'));

create policy "brand_kits_mutate_editor" on public.brand_kits
  for all to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'editor'))
  with check (public.is_org_member(org_id, auth.uid(), 'editor'));

create policy "projects_select_member" on public.projects
  for select to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'viewer'));

create policy "projects_insert_editor" on public.projects
  for insert to authenticated
  with check (public.is_org_member(org_id, auth.uid(), 'editor') and user_id = auth.uid());

create policy "projects_update_editor" on public.projects
  for update to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'editor'))
  with check (public.is_org_member(org_id, auth.uid(), 'editor'));

create policy "projects_delete_editor" on public.projects
  for delete to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'editor'));
