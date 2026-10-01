-- Lightweight "live master" indicator for sets.
-- The projection master heartbeats every ~15s so the sets listing can show
-- a "live" badge when a set is actively being projected.

alter table sets add column if not exists active_master_user_id uuid references users(id) on delete set null;
alter table sets add column if not exists active_master_heartbeat_at timestamptz;

create index if not exists sets_active_master_heartbeat_idx on sets (active_master_heartbeat_at)
  where active_master_heartbeat_at is not null;

create or replace function heartbeat_set_master(p_set_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (set_owner_or_church_lead(p_set_id) or can_write_set_shared(p_set_id)) then
    return;
  end if;
  update sets
    set active_master_user_id = auth.uid(),
        active_master_heartbeat_at = now()
    where id = p_set_id;
end;
$$;

create or replace function release_set_master(p_set_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update sets
    set active_master_user_id = null,
        active_master_heartbeat_at = null
    where id = p_set_id
      and active_master_user_id = auth.uid();
end;
$$;

revoke all on function heartbeat_set_master(uuid) from public;
revoke all on function release_set_master(uuid) from public;
grant execute on function heartbeat_set_master(uuid) to authenticated;
grant execute on function release_set_master(uuid) to authenticated;

notify pgrst, 'reload schema';
