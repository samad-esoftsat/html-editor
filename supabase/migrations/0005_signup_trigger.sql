create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  candidate text;
  suffix int := 1;
  new_org uuid;
begin
  base_slug := lower(regexp_replace(split_part(coalesce(new.email, 'user'), '@', 1), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'workspace';
  end if;

  candidate := base_slug;
  while exists (select 1 from public.organizations where slug = candidate) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  insert into public.organizations (slug, name, created_by)
  values (candidate, initcap(replace(base_slug, '-', ' ')) || ' Workspace', new.id)
  returning id into new_org;

  insert into public.organization_members (org_id, user_id, role)
  values (new_org, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
