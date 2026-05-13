-- Security-definer RPC for creating a workspace.
-- Required because the RLS policy on organization_members allows mutation
-- only by existing owners; a fresh workspace has no owner row yet, so the
-- caller cannot bootstrap themselves via direct INSERT. This RPC validates
-- the caller, inserts the organization and the owner membership atomically.

create or replace function public.create_workspace(p_slug citext, p_name text)
returns table (id uuid, slug citext, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_slug citext;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  v_slug := lower(trim(p_slug::text))::citext;
  if v_slug is null or length(v_slug::text) < 3 or length(v_slug::text) > 40 then
    raise exception 'invalid_slug' using errcode = 'P0001';
  end if;
  if v_slug::text !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' then
    raise exception 'invalid_slug' using errcode = 'P0001';
  end if;

  v_name := trim(p_name);
  if v_name is null or length(v_name) = 0 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  v_name := substring(v_name from 1 for 200);

  if exists (select 1 from public.organizations where organizations.slug = v_slug) then
    raise exception 'slug_taken' using errcode = '23505';
  end if;

  insert into public.organizations (slug, name, created_by)
  values (v_slug, v_name, v_user_id)
  returning organizations.id into v_org_id;

  insert into public.organization_members (org_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  return query
  select v_org_id, v_slug, v_name;
end;
$$;

revoke all on function public.create_workspace(citext, text) from public;
grant execute on function public.create_workspace(citext, text) to authenticated;
