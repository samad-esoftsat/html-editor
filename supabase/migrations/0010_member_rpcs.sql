-- Security-definer RPCs for managing organization members.
-- list_org_members: exposes member emails (auth.users is not directly readable).
-- update_member_role / remove_member: enforce the "last owner" invariant atomically
-- under a row lock so a workspace cannot end up ownerless via a race.

create or replace function public.list_org_members(p_org uuid)
returns table (
  user_id uuid,
  email citext,
  role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  if not public.is_org_member(p_org, v_user_id, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select m.user_id,
         au.email::citext as email,
         m.role,
         m.created_at
  from public.organization_members m
  join auth.users au on au.id = m.user_id
  where m.org_id = p_org
  order by
    case m.role when 'owner' then 0 when 'editor' then 1 else 2 end,
    au.email::text;
end;
$$;

revoke all on function public.list_org_members(uuid) from public;
grant execute on function public.list_org_members(uuid) to authenticated;

create or replace function public.update_member_role(
  p_org uuid,
  p_user uuid,
  p_role text
)
returns table (user_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_current_role text;
  v_owner_count int;
begin
  if v_caller is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  if not public.is_org_member(p_org, v_caller, 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_role not in ('owner', 'editor', 'viewer') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;

  -- Lock the org's member rows so the owner count we read is stable.
  perform 1
  from public.organization_members
  where org_id = p_org
  for update;

  select role into v_current_role
  from public.organization_members
  where org_id = p_org and organization_members.user_id = p_user;

  if v_current_role is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  if v_current_role = p_role then
    return query select p_user, p_role;
    return;
  end if;

  if v_current_role = 'owner' and p_role <> 'owner' then
    select count(*) into v_owner_count
    from public.organization_members
    where org_id = p_org and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'last_owner' using errcode = 'P0001';
    end if;
  end if;

  update public.organization_members
  set role = p_role
  where org_id = p_org and organization_members.user_id = p_user;

  return query select p_user, p_role;
end;
$$;

revoke all on function public.update_member_role(uuid, uuid, text) from public;
grant execute on function public.update_member_role(uuid, uuid, text) to authenticated;

create or replace function public.remove_member(
  p_org uuid,
  p_user uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_target_role text;
  v_owner_count int;
  v_is_self boolean;
begin
  if v_caller is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  v_is_self := (p_user = v_caller);

  -- Owners can remove anyone; non-owners can only remove themselves.
  if not v_is_self and not public.is_org_member(p_org, v_caller, 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform 1
  from public.organization_members
  where org_id = p_org
  for update;

  select role into v_target_role
  from public.organization_members
  where org_id = p_org and organization_members.user_id = p_user;

  if v_target_role is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  if v_target_role = 'owner' then
    select count(*) into v_owner_count
    from public.organization_members
    where org_id = p_org and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'last_owner' using errcode = 'P0001';
    end if;
  end if;

  delete from public.organization_members
  where org_id = p_org and organization_members.user_id = p_user;
end;
$$;

revoke all on function public.remove_member(uuid, uuid) from public;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
