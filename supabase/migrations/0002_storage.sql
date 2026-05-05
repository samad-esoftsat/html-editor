insert into storage.buckets (id, name, public)
values ('project-assets', 'project-assets', true)
on conflict (id) do nothing;

-- Anyone can read (bucket is public). Writes/deletes restricted to owner.
create policy "project_assets_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "project_assets_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "project_assets_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
