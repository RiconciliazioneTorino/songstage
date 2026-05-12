-- Fix: sets_read and set_shares_read referenced each other, causing infinite RLS recursion.
-- Solution: helper functions with SECURITY DEFINER that bypass RLS for the lookup.

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
  );
$$;

create or replace function set_owner_or_church_lead(p_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from sets s
    where s.id = p_set_id
      and (
        s.created_by = auth.uid()
        or has_church_role(s.church_id, array['admin', 'director']::church_role[])
      )
  );
$$;

revoke all on function is_set_shared_with_me(uuid) from public;
revoke all on function can_write_set_shared(uuid) from public;
revoke all on function set_owner_or_church_lead(uuid) from public;
grant execute on function is_set_shared_with_me(uuid) to authenticated;
grant execute on function can_write_set_shared(uuid) to authenticated;
grant execute on function set_owner_or_church_lead(uuid) to authenticated;

-- Replace recursive policies
drop policy if exists sets_read on sets;
drop policy if exists sets_update on sets;
drop policy if exists set_items_read on set_items;
drop policy if exists set_items_write on set_items;
drop policy if exists set_shares_read on set_shares;

create policy sets_read on sets for select to authenticated
  using (
    has_church_role(church_id, array['admin', 'director']::church_role[])
    or created_by = auth.uid()
    or is_set_shared_with_me(id)
  );

create policy sets_update on sets for update to authenticated
  using (
    has_church_role(church_id, array['admin', 'director']::church_role[])
    or created_by = auth.uid()
    or can_write_set_shared(id)
  );

create policy set_items_read on set_items for select to authenticated
  using (
    set_owner_or_church_lead(set_id)
    or is_set_shared_with_me(set_id)
  );

create policy set_items_write on set_items for all to authenticated
  using (
    set_owner_or_church_lead(set_id)
    or can_write_set_shared(set_id)
  )
  with check (
    set_owner_or_church_lead(set_id)
    or can_write_set_shared(set_id)
  );

create policy set_shares_read on set_shares for select to authenticated
  using (
    user_id = auth.uid()
    or set_owner_or_church_lead(set_id)
  );

notify pgrst, 'reload schema';
