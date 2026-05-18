-- Canonical song library: shared base layer above all churches.
-- - users.is_curator: flag that grants write access to canonical (church_id IS NULL) songs
-- - songs.parent_song_id: when a church adopts a canonical, the church-side song links back
-- - RLS: lift the previous block on canonical writes, gate by is_curator()

alter table users add column if not exists is_curator boolean not null default false;

alter table songs add column if not exists parent_song_id uuid references songs(id) on delete set null;
create index if not exists songs_parent_song_id_idx on songs (parent_song_id);

create or replace function is_curator() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_curator from users where id = auth.uid()), false);
$$;

revoke all on function is_curator() from public;
grant execute on function is_curator() to authenticated;

drop policy if exists songs_write on songs;
create policy songs_write on songs for all to authenticated
  using (
    (church_id is null and is_curator())
    or (church_id is not null and has_church_role(church_id, array['admin', 'director']::church_role[]))
  )
  with check (
    (church_id is null and is_curator())
    or (church_id is not null and has_church_role(church_id, array['admin', 'director']::church_role[]))
  );

drop policy if exists song_versions_write on song_versions;
create policy song_versions_write on song_versions for all to authenticated
  using (exists (
    select 1 from songs s where s.id = song_id
      and (
        (s.church_id is null and is_curator())
        or (s.church_id is not null and has_church_role(s.church_id, array['admin', 'director']::church_role[]))
      )
  ))
  with check (exists (
    select 1 from songs s where s.id = song_id
      and (
        (s.church_id is null and is_curator())
        or (s.church_id is not null and has_church_role(s.church_id, array['admin', 'director']::church_role[]))
      )
  ));

-- audio_attachments for canonical songs: any curator can write them.
drop policy if exists audio_write on audio_attachments;
create policy audio_write on audio_attachments for all to authenticated
  using (
    created_by = auth.uid()
    or (
      song_id is not null and exists (
        select 1 from songs s where s.id = song_id and s.church_id is null and is_curator()
      )
    )
  )
  with check (
    created_by = auth.uid()
    or (
      song_id is not null and exists (
        select 1 from songs s where s.id = song_id and s.church_id is null and is_curator()
      )
    )
  );

notify pgrst, 'reload schema';

-- After running this migration, mark yourself as curator:
--   update public.users set is_curator = true where email = 'torres.federico@gmail.com';
