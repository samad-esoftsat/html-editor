-- Replace user-scoped storage policies with org-scoped policies.
-- New path layout: <org_id>/<project_id>/<uuid>.<ext>

drop policy if exists "project_assets_insert_own" on storage.objects;
drop policy if exists "project_assets_update_own" on storage.objects;
drop policy if exists "project_assets_delete_own" on storage.objects;

create policy "project_assets_select_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-assets'
    and public.is_org_member(
      ((storage.foldername(name))[1])::uuid,
      auth.uid(),
      'viewer'
    )
  );

create policy "project_assets_insert_editor" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-assets'
    and public.is_org_member(
      ((storage.foldername(name))[1])::uuid,
      auth.uid(),
      'editor'
    )
  );

create policy "project_assets_update_editor" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-assets'
    and public.is_org_member(
      ((storage.foldername(name))[1])::uuid,
      auth.uid(),
      'editor'
    )
  )
  with check (
    bucket_id = 'project-assets'
    and public.is_org_member(
      ((storage.foldername(name))[1])::uuid,
      auth.uid(),
      'editor'
    )
  );

create policy "project_assets_delete_editor" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-assets'
    and public.is_org_member(
      ((storage.foldername(name))[1])::uuid,
      auth.uid(),
      'editor'
    )
  );
