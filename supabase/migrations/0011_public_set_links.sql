-- Public, expiring links to a set's live view.
--
-- Family gatherings: the leader projects from the master console and wants the
-- rest of the room to follow the lyrics on their phones. Nobody there has (or
-- wants) an account, so the link itself is the credential: an unguessable
-- token, read-only, valid for a few days.

create table if not exists set_public_links (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references sets(id) on delete cascade,
  token text not null unique,
  label text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz
);

create index if not exists set_public_links_set_idx on set_public_links (set_id);

alter table set_public_links enable row level security;

-- Only people who could lead the set see or manage its links. Anonymous
-- visitors never touch the table directly — they go through the definer
-- functions below, which take the token as the only input.
create policy set_public_links_read on set_public_links for select to authenticated
  using (set_owner_or_church_lead(set_id) or can_write_set_shared(set_id));
create policy set_public_links_write on set_public_links for all to authenticated
  using (set_owner_or_church_lead(set_id) or can_write_set_shared(set_id))
  with check (set_owner_or_church_lead(set_id) or can_write_set_shared(set_id));

-- =====================================================================
-- CREATING AND REVOKING
-- =====================================================================
create or replace function create_public_set_link(p_set_id uuid, p_days integer default 7)
returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_days integer := greatest(1, least(90, coalesce(p_days, 7)));
  v_token text;
begin
  if not (set_owner_or_church_lead(p_set_id) or can_write_set_shared(p_set_id)) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- 32 hex chars (122 bits of entropy): short enough to paste in a chat, far
  -- too large to guess. gen_random_uuid() is built in, so this needs no
  -- extension on the function's search_path.
  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into set_public_links (set_id, token, created_by, expires_at)
  values (p_set_id, v_token, auth.uid(), now() + make_interval(days => v_days));

  return query select v_token, (now() + make_interval(days => v_days))::timestamptz;
end;
$$;

create or replace function revoke_public_set_link(p_link_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_set uuid;
begin
  select set_id into v_set from set_public_links where id = p_link_id;
  if v_set is null then
    return;
  end if;
  if not (set_owner_or_church_lead(v_set) or can_write_set_shared(v_set)) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update set_public_links set revoked_at = now() where id = p_link_id and revoked_at is null;
end;
$$;

-- =====================================================================
-- RESOLVING A TOKEN (ANONYMOUS)
-- =====================================================================
-- Returns everything the read-only viewer needs, in one call, and nothing
-- else: no church, no member list, no other set. Null when the token is
-- unknown, revoked or past its expiry.
create or replace function public_set_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
  v_set_id uuid;
  v_set_name text;
  v_result jsonb;
begin
  select l.id, s.id, s.name
    into v_link_id, v_set_id, v_set_name
  from set_public_links l
  join sets s on s.id = l.set_id
  where l.token = btrim(coalesce(p_token, ''))
    and l.revoked_at is null
    and l.expires_at > now()
  limit 1;

  if v_set_id is null then
    return null;
  end if;

  update set_public_links set last_viewed_at = now() where id = v_link_id;

  select jsonb_build_object(
    'setId', v_set_id,
    'setName', v_set_name,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'itemId', i.id,
          'songId', sg.id,
          'variationId', i.variation_id,
          'title', sg.title,
          'artist', sg.artist,
          'originalKey', sg.original_key,
          'songTempo', sg.default_tempo,
          'songTimeSignature', sg.time_signature,
          'isCanonical', sg.church_id is null,
          'transpose', i.transpose_semitones,
          'body', coalesce(sv.body_onsong, cv.body_onsong, '')
        )
        order by i.position
      )
      from set_items i
      join songs sg on sg.id = i.song_id
      left join song_variations sv on sv.id = i.variation_id
      left join song_versions cv on cv.id = sg.current_version_id
      where i.set_id = v_set_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function create_public_set_link(uuid, integer) from public;
revoke all on function revoke_public_set_link(uuid) from public;
revoke all on function public_set_by_token(text) from public;
-- Supabase grants execute to anon/authenticated by default privilege, which
-- the revoke from `public` above does not touch. Only the token resolver is
-- meant to be reachable without a session.
revoke all on function create_public_set_link(uuid, integer) from anon;
revoke all on function revoke_public_set_link(uuid) from anon;
grant execute on function create_public_set_link(uuid, integer) to authenticated;
grant execute on function revoke_public_set_link(uuid) to authenticated;
grant execute on function public_set_by_token(text) to anon, authenticated;

notify pgrst, 'reload schema';
