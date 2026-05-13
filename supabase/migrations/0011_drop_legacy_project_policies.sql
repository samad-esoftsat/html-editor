-- Drop legacy owner-scoped project RLS policies now that org-scoped
-- policies cover access. Live policy names diverged from 0006_rls.sql
-- (the remote DB landed with shorter names), so we target the actual
-- names present in the remote DB.
drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

-- Tighten the live insert policy to also pin user_id to the caller,
-- matching the spec in 0006_rls.sql.
drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects
  for insert to authenticated
  with check (public.is_org_member(org_id, auth.uid(), 'editor') and user_id = auth.uid());
