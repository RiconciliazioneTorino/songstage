-- SongStage initial schema
-- Multi-tenant: churches → bands → users; songs canonical or church-scoped;
-- variations as overlays at church/band/user scope; sets shareable.

create extension if not exists "pgcrypto";

-- =====================================================================
-- ENUMS
-- =====================================================================
create type church_role as enum ('admin', 'director', 'musico', 'lector');
create type variation_scope as enum ('church', 'band', 'user');
create type set_permission as enum ('read', 'read_write');
create type audio_kind as enum ('mp3_upload', 'youtube', 'spotify', 'amazon', 'soundcloud', 'other');
create type arrangement_type as enum ('intro', 'riff', 'bassline', 'solo', 'outro', 'turnaround');
create type instrument as enum ('guitar', 'piano', 'ukulele', 'bass', 'mandolin');

-- =====================================================================
-- IDENTITY
-- =====================================================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table churches (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create table church_members (
  user_id uuid not null references users(id) on delete cascade,
  church_id uuid not null references churches(id) on delete cascade,
  role church_role not null default 'musico',
  joined_at timestamptz not null default now(),
  primary key (user_id, church_id)
);
create index on church_members (church_id);

create table bands (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index on bands (church_id);

create table band_members (
  user_id uuid not null references users(id) on delete cascade,
  band_id uuid not null references bands(id) on delete cascade,
  primary key (user_id, band_id)
);
create index on band_members (band_id);

-- =====================================================================
-- SONGS
-- =====================================================================
create table songs (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id) on delete cascade,  -- NULL = canonical
  title text not null,
  artist text,
  original_key text,
  default_tempo integer,
  time_signature text,
  ccli text,
  language text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  current_version_id uuid
);
create index on songs (church_id);
create index on songs (title);

create table song_versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  version_number integer not null,
  body_onsong text not null,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (song_id, version_number)
);
create index on song_versions (song_id, version_number desc);

alter table songs add constraint songs_current_version_fk
  foreign key (current_version_id) references song_versions(id) on delete set null;

create table song_variations (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  scope variation_scope not null,
  scope_church_id uuid references churches(id) on delete cascade,
  scope_band_id uuid references bands(id) on delete cascade,
  scope_user_id uuid references users(id) on delete cascade,
  parent_variation_id uuid references song_variations(id) on delete set null,
  name text not null,
  body_onsong text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  -- exactly one scope_* matches the scope enum
  constraint variation_scope_consistency check (
    (scope = 'church' and scope_church_id is not null and scope_band_id is null and scope_user_id is null)
    or (scope = 'band' and scope_band_id is not null and scope_church_id is null and scope_user_id is null)
    or (scope = 'user' and scope_user_id is not null and scope_church_id is null and scope_band_id is null)
  )
);
create index on song_variations (song_id);
create index on song_variations (scope_church_id) where scope_church_id is not null;
create index on song_variations (scope_band_id) where scope_band_id is not null;
create index on song_variations (scope_user_id) where scope_user_id is not null;

-- =====================================================================
-- AUDIO + ARRANGEMENTS + CHORDS
-- =====================================================================
create table audio_attachments (
  id uuid primary key default gen_random_uuid(),
  song_id uuid references songs(id) on delete cascade,
  variation_id uuid references song_variations(id) on delete cascade,
  kind audio_kind not null,
  url text,
  storage_path text,
  metadata jsonb not null default '{}',
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  constraint audio_target_consistency check (
    (song_id is not null) <> (variation_id is not null)
  )
);
create index on audio_attachments (song_id) where song_id is not null;
create index on audio_attachments (variation_id) where variation_id is not null;

create table arrangements (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  scope variation_scope not null,
  scope_church_id uuid references churches(id) on delete cascade,
  scope_band_id uuid references bands(id) on delete cascade,
  scope_user_id uuid references users(id) on delete cascade,
  name text not null,
  type arrangement_type not null,
  notation_data jsonb not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  constraint arrangement_scope_consistency check (
    (scope = 'church' and scope_church_id is not null and scope_band_id is null and scope_user_id is null)
    or (scope = 'band' and scope_band_id is not null and scope_church_id is null and scope_user_id is null)
    or (scope = 'user' and scope_user_id is not null and scope_church_id is null and scope_band_id is null)
  )
);
create index on arrangements (song_id);

create table chord_definitions (
  id uuid primary key default gen_random_uuid(),
  instrument instrument not null,
  chord_name text not null,
  fingering_data jsonb not null,
  scope variation_scope,
  scope_church_id uuid references churches(id) on delete cascade,
  scope_band_id uuid references bands(id) on delete cascade,
  scope_user_id uuid references users(id) on delete cascade,
  is_default boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index on chord_definitions (instrument, chord_name);

-- =====================================================================
-- SETS
-- =====================================================================
create table sets (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  name text not null,
  event_date date,
  event_type text,
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
create index on sets (church_id, event_date desc);

create table set_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references sets(id) on delete cascade,
  song_id uuid not null references songs(id) on delete restrict,
  variation_id uuid references song_variations(id) on delete set null,
  position integer not null,
  transpose_semitones integer not null default 0,
  capo integer not null default 0,
  performance_notes text,
  unique (set_id, position)
);
create index on set_items (set_id, position);

create table set_shares (
  set_id uuid not null references sets(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  permission set_permission not null default 'read',
  shared_at timestamptz not null default now(),
  primary key (set_id, user_id)
);

-- =====================================================================
-- PROJECTION (live session)
-- =====================================================================
create table projection_sessions (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references sets(id) on delete cascade,
  master_user_id uuid not null references users(id) on delete cascade,
  current_set_item_id uuid references set_items(id) on delete set null,
  transpose_override integer,
  font_scale numeric(4,2) not null default 1.0,
  show_chords boolean not null default true,
  scroll_percent numeric(5,4) not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index on projection_sessions (set_id) where ended_at is null;

-- =====================================================================
-- HELPER FUNCTIONS
-- =====================================================================
create or replace function is_church_member(p_church_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from church_members
    where user_id = auth.uid() and church_id = p_church_id
  );
$$;

create or replace function has_church_role(p_church_id uuid, p_roles church_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from church_members
    where user_id = auth.uid() and church_id = p_church_id and role = any(p_roles)
  );
$$;

create or replace function is_band_member(p_band_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from band_members
    where user_id = auth.uid() and band_id = p_band_id
  );
$$;

-- =====================================================================
-- ROW-LEVEL SECURITY
-- =====================================================================
alter table users enable row level security;
alter table churches enable row level security;
alter table church_members enable row level security;
alter table bands enable row level security;
alter table band_members enable row level security;
alter table songs enable row level security;
alter table song_versions enable row level security;
alter table song_variations enable row level security;
alter table audio_attachments enable row level security;
alter table arrangements enable row level security;
alter table chord_definitions enable row level security;
alter table sets enable row level security;
alter table set_items enable row level security;
alter table set_shares enable row level security;
alter table projection_sessions enable row level security;

-- users: row corresponds to authenticated user; everyone reads minimal info
create policy users_self_read on users for select to authenticated
  using (true);
create policy users_self_update on users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- churches: members can read; only admin can update/delete
create policy churches_member_read on churches for select to authenticated
  using (is_church_member(id));
create policy churches_admin_write on churches for all to authenticated
  using (has_church_role(id, array['admin']::church_role[]))
  with check (has_church_role(id, array['admin']::church_role[]));

-- church_members: members can read all members of their churches; admin can write
create policy church_members_read on church_members for select to authenticated
  using (is_church_member(church_id));
create policy church_members_admin_write on church_members for all to authenticated
  using (has_church_role(church_id, array['admin']::church_role[]))
  with check (has_church_role(church_id, array['admin']::church_role[]));

-- bands
create policy bands_member_read on bands for select to authenticated
  using (is_church_member(church_id));
create policy bands_admin_write on bands for all to authenticated
  using (has_church_role(church_id, array['admin', 'director']::church_role[]))
  with check (has_church_role(church_id, array['admin', 'director']::church_role[]));

create policy band_members_read on band_members for select to authenticated
  using (is_band_member(band_id) or exists (
    select 1 from bands b where b.id = band_id and is_church_member(b.church_id)
  ));
create policy band_members_write on band_members for all to authenticated
  using (exists (
    select 1 from bands b where b.id = band_id
      and has_church_role(b.church_id, array['admin', 'director']::church_role[])
  ))
  with check (exists (
    select 1 from bands b where b.id = band_id
      and has_church_role(b.church_id, array['admin', 'director']::church_role[])
  ));

-- songs: canonical (church_id null) readable by all authenticated; church-scoped by members
create policy songs_read on songs for select to authenticated
  using (church_id is null or is_church_member(church_id));
create policy songs_write on songs for all to authenticated
  using (
    (church_id is null and false) -- canonical only writable by service role
    or has_church_role(church_id, array['admin', 'director']::church_role[])
  )
  with check (
    (church_id is null and false)
    or has_church_role(church_id, array['admin', 'director']::church_role[])
  );

-- song_versions: same readability as parent song
create policy song_versions_read on song_versions for select to authenticated
  using (exists (
    select 1 from songs s where s.id = song_id
      and (s.church_id is null or is_church_member(s.church_id))
  ));
create policy song_versions_write on song_versions for all to authenticated
  using (exists (
    select 1 from songs s where s.id = song_id
      and (s.church_id is not null and has_church_role(s.church_id, array['admin', 'director']::church_role[]))
  ))
  with check (exists (
    select 1 from songs s where s.id = song_id
      and (s.church_id is not null and has_church_role(s.church_id, array['admin', 'director']::church_role[]))
  ));

-- song_variations: read if member of the relevant scope; write if owner of scope
create policy variations_read on song_variations for select to authenticated
  using (
    (scope = 'church' and is_church_member(scope_church_id))
    or (scope = 'band' and (is_band_member(scope_band_id) or exists (
      select 1 from bands b where b.id = scope_band_id and is_church_member(b.church_id)
    )))
    or (scope = 'user' and scope_user_id = auth.uid())
  );
create policy variations_write on song_variations for all to authenticated
  using (
    (scope = 'church' and has_church_role(scope_church_id, array['admin', 'director']::church_role[]))
    or (scope = 'band' and is_band_member(scope_band_id))
    or (scope = 'user' and scope_user_id = auth.uid())
  )
  with check (
    (scope = 'church' and has_church_role(scope_church_id, array['admin', 'director']::church_role[]))
    or (scope = 'band' and is_band_member(scope_band_id))
    or (scope = 'user' and scope_user_id = auth.uid())
  );

-- audio_attachments: visible if parent visible
create policy audio_read on audio_attachments for select to authenticated
  using (
    (song_id is not null and exists (select 1 from songs s where s.id = song_id and (s.church_id is null or is_church_member(s.church_id))))
    or (variation_id is not null and exists (select 1 from song_variations v where v.id = variation_id))
  );
create policy audio_write on audio_attachments for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- arrangements: same scoping as variations
create policy arrangements_read on arrangements for select to authenticated
  using (
    (scope = 'church' and is_church_member(scope_church_id))
    or (scope = 'band' and (is_band_member(scope_band_id) or exists (
      select 1 from bands b where b.id = scope_band_id and is_church_member(b.church_id)
    )))
    or (scope = 'user' and scope_user_id = auth.uid())
  );
create policy arrangements_write on arrangements for all to authenticated
  using (
    (scope = 'church' and has_church_role(scope_church_id, array['admin', 'director']::church_role[]))
    or (scope = 'band' and is_band_member(scope_band_id))
    or (scope = 'user' and scope_user_id = auth.uid())
  )
  with check (
    (scope = 'church' and has_church_role(scope_church_id, array['admin', 'director']::church_role[]))
    or (scope = 'band' and is_band_member(scope_band_id))
    or (scope = 'user' and scope_user_id = auth.uid())
  );

-- chord_definitions: defaults readable by all; scoped follow scope ownership
create policy chord_defs_read on chord_definitions for select to authenticated
  using (
    is_default
    or (scope = 'church' and is_church_member(scope_church_id))
    or (scope = 'band' and (is_band_member(scope_band_id) or exists (
      select 1 from bands b where b.id = scope_band_id and is_church_member(b.church_id)
    )))
    or (scope = 'user' and scope_user_id = auth.uid())
  );
create policy chord_defs_write on chord_definitions for all to authenticated
  using (
    (not is_default) and (
      (scope = 'church' and has_church_role(scope_church_id, array['admin', 'director']::church_role[]))
      or (scope = 'band' and is_band_member(scope_band_id))
      or (scope = 'user' and scope_user_id = auth.uid())
    )
  )
  with check (
    (not is_default) and (
      (scope = 'church' and has_church_role(scope_church_id, array['admin', 'director']::church_role[]))
      or (scope = 'band' and is_band_member(scope_band_id))
      or (scope = 'user' and scope_user_id = auth.uid())
    )
  );

-- sets: church admin/director can read all; others see only those shared with them or created by them
create policy sets_read on sets for select to authenticated
  using (
    has_church_role(church_id, array['admin', 'director']::church_role[])
    or created_by = auth.uid()
    or exists (select 1 from set_shares ss where ss.set_id = sets.id and ss.user_id = auth.uid())
  );
create policy sets_insert on sets for insert to authenticated
  with check (
    has_church_role(church_id, array['admin', 'director', 'musico']::church_role[])
    and created_by = auth.uid()
  );
create policy sets_update on sets for update to authenticated
  using (
    has_church_role(church_id, array['admin', 'director']::church_role[])
    or created_by = auth.uid()
    or exists (select 1 from set_shares ss where ss.set_id = sets.id and ss.user_id = auth.uid() and ss.permission = 'read_write')
  );
create policy sets_delete on sets for delete to authenticated
  using (
    has_church_role(church_id, array['admin']::church_role[])
    or created_by = auth.uid()
  );

create policy set_items_read on set_items for select to authenticated
  using (exists (select 1 from sets s where s.id = set_id));
create policy set_items_write on set_items for all to authenticated
  using (exists (
    select 1 from sets s where s.id = set_id
      and (
        has_church_role(s.church_id, array['admin', 'director']::church_role[])
        or s.created_by = auth.uid()
        or exists (select 1 from set_shares ss where ss.set_id = s.id and ss.user_id = auth.uid() and ss.permission = 'read_write')
      )
  ))
  with check (exists (
    select 1 from sets s where s.id = set_id
      and (
        has_church_role(s.church_id, array['admin', 'director']::church_role[])
        or s.created_by = auth.uid()
        or exists (select 1 from set_shares ss where ss.set_id = s.id and ss.user_id = auth.uid() and ss.permission = 'read_write')
      )
  ));

create policy set_shares_read on set_shares for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from sets s where s.id = set_id and (
      has_church_role(s.church_id, array['admin', 'director']::church_role[])
      or s.created_by = auth.uid()
    ))
  );
create policy set_shares_write on set_shares for all to authenticated
  using (exists (select 1 from sets s where s.id = set_id and s.created_by = auth.uid()))
  with check (exists (select 1 from sets s where s.id = set_id and s.created_by = auth.uid()));

-- projection_sessions: read if you can read the set; write only by master
create policy projection_read on projection_sessions for select to authenticated
  using (exists (select 1 from sets s where s.id = set_id));
create policy projection_write on projection_sessions for all to authenticated
  using (master_user_id = auth.uid())
  with check (master_user_id = auth.uid());

-- =====================================================================
-- USER PROVISIONING TRIGGER
-- =====================================================================
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
