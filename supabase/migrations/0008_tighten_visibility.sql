-- Close two over-permissive policies from 0001.
--
-- 1. `users_self_read` was `using (true)`: every authenticated user could list
--    the email and display name of every user of the platform, across churches.
--    That defeats the purpose of `search_users_for_church` (0006), which exists
--    precisely so admins can pick users *without* exposing the table.
-- 2. `audio_write` only checked `created_by = auth.uid()`, so any authenticated
--    user could attach links to any song — including songs of churches they are
--    not a member of.

-- =====================================================================
-- WHO CAN SEE A USER ROW
-- =====================================================================
-- Security definer so the lookups below don't re-enter the policies they
-- support. Visible when: it's you, you share a church, or they're on the
-- share list of a set you own or lead.
create or replace function can_see_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_id = auth.uid()
    or exists (
      select 1
      from church_members mine
      join church_members theirs on theirs.church_id = mine.church_id
      where mine.user_id = auth.uid()
        and theirs.user_id = p_user_id
    )
    or exists (
      select 1
      from set_shares ss
      join sets s on s.id = ss.set_id
      where ss.user_id = p_user_id
        and (
          s.created_by = auth.uid()
          or has_church_role(s.church_id, array['admin', 'director']::church_role[])
        )
    );
$$;

revoke all on function can_see_user(uuid) from public;
grant execute on function can_see_user(uuid) to authenticated;

drop policy if exists users_self_read on users;
drop policy if exists users_read on users;
create policy users_read on users for select to authenticated
  using (can_see_user(id));

-- =====================================================================
-- SHARING A SET BY EMAIL
-- =====================================================================
-- `shareSet` used to query `users` by email directly, which let anyone probe
-- whether an address was registered. Resolve the address server-side instead,
-- and only among people the caller is already allowed to see.
create or replace function find_shareable_user(p_set_id uuid, p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  -- Only someone who can actually write the set may resolve addresses with it.
  if not (set_owner_or_church_lead(p_set_id) or can_write_set_shared(p_set_id)) then
    return null;
  end if;

  select u.id into v_user
  from users u
  where lower(u.email) = lower(btrim(p_email))
    and can_see_user(u.id)
  limit 1;

  return v_user;
end;
$$;

revoke all on function find_shareable_user(uuid, text) from public;
grant execute on function find_shareable_user(uuid, text) to authenticated;

-- =====================================================================
-- AUDIO ATTACHMENTS FOLLOW THE SONG THEY HANG OFF
-- =====================================================================
drop policy if exists audio_write on audio_attachments;
create policy audio_write on audio_attachments for all to authenticated
  using (
    (song_id is not null and exists (
      select 1 from songs s
      where s.id = song_id
        and (
          (s.church_id is null and is_curator())
          or (s.church_id is not null
              and has_church_role(s.church_id, array['admin', 'director']::church_role[]))
        )
    ))
    or (variation_id is not null and exists (
      select 1 from song_variations v
      where v.id = variation_id
        and (
          (v.scope = 'user' and v.scope_user_id = auth.uid())
          or (v.scope = 'band' and is_band_member(v.scope_band_id))
          or (v.scope = 'church'
              and has_church_role(v.scope_church_id, array['admin', 'director']::church_role[]))
        )
    ))
  )
  with check (
    (song_id is not null and exists (
      select 1 from songs s
      where s.id = song_id
        and (
          (s.church_id is null and is_curator())
          or (s.church_id is not null
              and has_church_role(s.church_id, array['admin', 'director']::church_role[]))
        )
    ))
    or (variation_id is not null and exists (
      select 1 from song_variations v
      where v.id = variation_id
        and (
          (v.scope = 'user' and v.scope_user_id = auth.uid())
          or (v.scope = 'band' and is_band_member(v.scope_band_id))
          or (v.scope = 'church'
              and has_church_role(v.scope_church_id, array['admin', 'director']::church_role[]))
        )
    ))
  );

notify pgrst, 'reload schema';

-- =====================================================================
-- INVITING BY EMAIL
-- =====================================================================
-- `inviteChurchMember` used to read `users` by email to decide between "add
-- straight away" and "leave an invitation". With the table closed it would
-- always take the invitation branch — and an invitation is only consumed by the
-- signup trigger, so an already-registered person would never be added.
-- Resolve and act in one definer call instead.
create or replace function invite_church_member(
  p_church_id uuid,
  p_email text,
  p_role church_role
)
returns table (added boolean, invited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
begin
  if not has_church_role(p_church_id, array['admin']::church_role[]) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  select u.id into v_user from users u where lower(u.email) = v_email limit 1;

  if v_user is not null then
    insert into church_members (church_id, user_id, role)
    values (p_church_id, v_user, p_role)
    on conflict (user_id, church_id) do nothing;
    if not found then
      raise exception 'already_member' using errcode = '23505';
    end if;
    -- Drop any stale invitation for the same address.
    delete from church_invitations
      where church_id = p_church_id and lower(email) = v_email;
    return query select true, false;
    return;
  end if;

  insert into church_invitations (church_id, email, role, created_by)
  values (p_church_id, v_email, p_role, auth.uid())
  on conflict (church_id, email) do update set role = excluded.role;

  return query select false, true;
end;
$$;

revoke all on function invite_church_member(uuid, text, church_role) from public;
grant execute on function invite_church_member(uuid, text, church_role) to authenticated;

-- Admin-facing user search: make it a lookup, not a dump. Previously an empty
-- query returned 20 arbitrary users of the whole platform.
create or replace function search_users_for_church(p_church_id uuid, p_query text)
returns table (id uuid, email text, display_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
begin
  if not has_church_role(p_church_id, array['admin', 'director']::church_role[]) then
    return;
  end if;
  if length(v_query) < 3 then
    return;
  end if;
  return query
    select u.id, u.email, u.display_name
    from users u
    where (u.email ilike '%' || v_query || '%'
        or coalesce(u.display_name, '') ilike '%' || v_query || '%')
      and not exists (
        select 1 from church_members m
        where m.church_id = p_church_id and m.user_id = u.id
      )
    order by u.email
    limit 20;
end;
$$;

revoke all on function search_users_for_church(uuid, text) from public;
grant execute on function search_users_for_church(uuid, text) to authenticated;

notify pgrst, 'reload schema';
