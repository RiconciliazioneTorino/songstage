-- Allow sharing a set with an entire band (group), not just individual users.
-- Adds a parallel set_band_shares table and updates the helper functions used by
-- sets/set_items RLS so that membership in a shared band counts as access.

create table if not exists set_band_shares (
  set_id uuid not null references sets(id) on delete cascade,
  band_id uuid not null references bands(id) on delete cascade,
  permission set_permission not null default 'read',
  shared_at timestamptz not null default now(),
  primary key (set_id, band_id)
);

alter table set_band_shares enable row level security;

drop policy if exists set_band_shares_read on set_band_shares;
drop policy if exists set_band_shares_write on set_band_shares;

create policy set_band_shares_read on set_band_shares for select to authenticated
  using (
    set_owner_or_church_lead(set_id)
    or exists (
      select 1 from band_members bm
      where bm.band_id = set_band_shares.band_id and bm.user_id = auth.uid()
    )
  );

create policy set_band_shares_write on set_band_shares for all to authenticated
  using (set_owner_or_church_lead(set_id))
  with check (set_owner_or_church_lead(set_id));

create or replace function is_set_shared_with_me(p_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from set_shares
    where set_id = p_set_id and user_id = auth.uid()
  ) or exists (
    select 1
    from set_band_shares sbs
    join band_members bm on bm.band_id = sbs.band_id
    where sbs.set_id = p_set_id and bm.user_id = auth.uid()
  );
$$;

create or replace function can_write_set_shared(p_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from set_shares
    where set_id = p_set_id and user_id = auth.uid() and permission = 'read_write'
  ) or exists (
    select 1
    from set_band_shares sbs
    join band_members bm on bm.band_id = sbs.band_id
    where sbs.set_id = p_set_id
      and bm.user_id = auth.uid()
      and sbs.permission = 'read_write'
  );
$$;

notify pgrst, 'reload schema';
