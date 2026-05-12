-- Atomic church creation: insert church + insert creator as admin in church_members.
-- SECURITY DEFINER bypasses RLS for this single operation; auth.uid() is still checked.

create or replace function create_church_with_admin(p_name text, p_slug text)
returns table (id uuid, slug text, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_church_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'invalid_name';
  end if;
  if p_slug is null or btrim(p_slug) = '' then
    raise exception 'invalid_slug';
  end if;

  insert into churches (name, slug, created_by)
  values (btrim(p_name), btrim(p_slug), v_user)
  returning churches.id into v_church_id;

  insert into church_members (church_id, user_id, role)
  values (v_church_id, v_user, 'admin');

  return query
    select c.id, c.slug, c.name
    from churches c
    where c.id = v_church_id;
end;
$$;

revoke all on function create_church_with_admin(text, text) from public;
grant execute on function create_church_with_admin(text, text) to authenticated;
