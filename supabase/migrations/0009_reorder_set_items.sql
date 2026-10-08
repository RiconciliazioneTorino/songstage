-- Persist a whole set order in one shot, for drag-and-drop reordering.
--
-- set_items has a non-deferrable unique (set_id, position), so renumbering has
-- to happen in two passes: first park every row on a negative position (never
-- taken, since live positions are positive), then write the final 1..n.

create or replace function reorder_set_items(p_set_id uuid, p_item_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not (set_owner_or_church_lead(p_set_id) or can_write_set_shared(p_set_id)) then
    raise exception 'Non autorizzato';
  end if;

  select count(*) into v_count from set_items where set_id = p_set_id;
  if v_count <> coalesce(array_length(p_item_ids, 1), 0) then
    raise exception 'Il riordino deve elencare tutte le canzoni del set';
  end if;

  if (select count(distinct t.item_id) from unnest(p_item_ids) as t(item_id)) <> v_count then
    raise exception 'Il riordino contiene elementi duplicati';
  end if;

  -- The alias has to name the column (t(item_id)), not just the table: with
  -- `unnest(...) as id` a bare `id` binds to set_items.id in the inner scope
  -- and the check silently compares si.id to itself.
  if exists (
    select 1 from unnest(p_item_ids) as t(item_id)
    where not exists (
      select 1 from set_items si where si.id = t.item_id and si.set_id = p_set_id
    )
  ) then
    raise exception 'Il riordino contiene elementi che non appartengono al set';
  end if;

  update set_items set position = -position where set_id = p_set_id;

  update set_items si
    set position = ord.idx
    from unnest(p_item_ids) with ordinality as ord(item_id, idx)
    where si.id = ord.item_id and si.set_id = p_set_id;
end;
$$;

revoke all on function reorder_set_items(uuid, uuid[]) from public;
grant execute on function reorder_set_items(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
