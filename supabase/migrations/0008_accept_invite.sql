-- Security-definer RPC for accepting a workspace invite.
-- The caller must be authenticated and the invite must match their email,
-- be unaccepted, and unexpired. Adds the caller to organization_members
-- (idempotent on (org_id, user_id) — existing membership is preserved if
-- it grants an equal-or-higher role).

create or replace function public.accept_invite(p_token text)
returns table (org_id uuid, slug citext, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email citext;
  v_invite public.organization_invites%rowtype;
  v_existing_role text;
  v_slug citext;
begin
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select email::citext into v_user_email
  from auth.users
  where id = v_user_id;

  if v_user_email is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select * into v_invite
  from public.organization_invites
  where token = p_token
  for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'invite_already_accepted' using errcode = 'P0001';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  if v_invite.email <> v_user_email then
    raise exception 'invite_email_mismatch' using errcode = 'P0001';
  end if;

  select role into v_existing_role
  from public.organization_members
  where organization_members.org_id = v_invite.org_id
    and organization_members.user_id = v_user_id;

  if v_existing_role is null then
    insert into public.organization_members (org_id, user_id, role)
    values (v_invite.org_id, v_user_id, v_invite.role);
  elsif (v_existing_role = 'viewer' and v_invite.role in ('editor','owner'))
     or (v_existing_role = 'editor' and v_invite.role = 'owner') then
    update public.organization_members
    set role = v_invite.role
    where organization_members.org_id = v_invite.org_id
      and organization_members.user_id = v_user_id;
  end if;

  update public.organization_invites
  set accepted_at = now()
  where id = v_invite.id;

  select organizations.slug into v_slug
  from public.organizations
  where organizations.id = v_invite.org_id;

  return query
  select v_invite.org_id, v_slug, coalesce(v_existing_role, v_invite.role);
end;
$$;

revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;
