-- Preassigned church memberships and admin-scoped user search.
-- - church_invitations: pre-created rows keyed by email; consumed when the
--   user signs up (or already exists) and auto-added to the church.
-- - search_users_for_church: security-definer RPC so admins/directors can
--   pick existing users without exposing the whole users table via RLS.

create table if not exists church_invitations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  email text not null,
  role church_role not null default 'musico',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (church_id, email)
);
create index if not exists church_invitations_email_idx on church_invitations (lower(email));

alter table church_invitations enable row level security;

drop policy if exists church_invitations_read on church_invitations;
create policy church_invitations_read on church_invitations for select to authenticated
  using (has_church_role(church_id, array['admin', 'director']::church_role[]));

drop policy if exists church_invitations_write on church_invitations;
create policy church_invitations_write on church_invitations for all to authenticated
  using (has_church_role(church_id, array['admin']::church_role[]))
  with check (has_church_role(church_id, array['admin']::church_role[]));

-- Consume matching invitations when a user signs up, or on demand.
create or replace function consume_church_invitations(p_user_id uuid, p_email text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  with moved as (
    delete from church_invitations
    where lower(email) = lower(p_email)
    returning church_id, role
  )
  insert into church_members (church_id, user_id, role)
  select church_id, p_user_id, role from moved
  on conflict (church_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function consume_church_invitations(uuid, text) from public;
grant execute on function consume_church_invitations(uuid, text) to authenticated;

-- Extend the auth user trigger to also consume invitations for that email.
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  perform consume_church_invitations(new.id, new.email);
  return new;
end;
$$;

-- Admin/director search over users NOT yet in a given church.
create or replace function search_users_for_church(p_church_id uuid, p_query text)
returns table (id uuid, email text, display_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not has_church_role(p_church_id, array['admin', 'director']::church_role[]) then
    return;
  end if;
  return query
    select u.id, u.email, u.display_name
    from users u
    where (
      p_query is null
      or p_query = ''
      or u.email ilike '%' || p_query || '%'
      or coalesce(u.display_name, '') ilike '%' || p_query || '%'
    )
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
