-- Search songs by what they actually say, not only by how they are labelled.
--
-- Until now every song search — the church list, the canonical library, the
-- set picker, the master console — matched on `title` and `artist` only. A
-- leader who remembers a line ("...e il tuo amore non mi lascerà") but not the
-- title had no way in. The text lives in `song_versions.body_onsong` (the one
-- pointed at by `songs.current_version_id`) and in `song_variations.body_onsong`,
-- so both are indexed here.
--
-- Design notes:
--
-- * The body is OnSong: chords in square brackets, directives in braces.
--   `[Am]Ti lodo` would tokenise as `amti`, so brackets and braces become
--   spaces before indexing. That both fixes the word boundaries and leaves the
--   chord names as searchable words of their own ("cerca Am7").
-- * The content is Italian, so `to_tsvector('italian', …)` gives useful
--   stemming (lodo/lodare/loderò) and drops Italian stopwords. Accents are
--   folded with `unaccent` because people type "perche" for "perché" and the
--   imported bodies are not consistent either.
-- * Full text alone misses mid-word fragments and phrases typed with their own
--   punctuation, so the normalised text also carries a trigram index and the
--   search ORs in an `ilike`. Two cheap index lookups, one forgiving result.
-- * The search function is `security invoker` on purpose: RLS on `songs`,
--   `song_versions` and `song_variations` already encodes exactly who may read
--   what (own church + canonical), so running as the caller means the search
--   can never surface a song the caller could not already open.

create extension if not exists "unaccent";
create extension if not exists "pg_trgm";

-- =====================================================================
-- NORMALISING AN ONSONG BODY
-- =====================================================================
-- Immutable so it can back a generated column and an expression index.
-- `unaccent()` itself is only stable (the dictionary could be reloaded), hence
-- the wrapper with the dictionary named explicitly.
create or replace function song_search_text(p_body text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select unaccent('unaccent', regexp_replace(coalesce(p_body, ''), '[\[\]{}]', ' ', 'g'));
$$;

comment on function song_search_text(text) is
  'OnSong body reduced to plain, accent-folded text: brackets and braces become spaces so chords and lyrics tokenise as separate words.';

-- =====================================================================
-- STORED SEARCH TEXT + INDEXES
-- =====================================================================
-- Stored rather than computed per query: bodies change rarely and are read on
-- every keystroke of a search.
alter table song_versions
  add column if not exists search_text text
  generated always as (song_search_text(body_onsong)) stored;

alter table song_variations
  add column if not exists search_text text
  generated always as (song_search_text(body_onsong)) stored;

create index if not exists song_versions_search_fts_idx
  on song_versions using gin (to_tsvector('italian', search_text));
create index if not exists song_versions_search_trgm_idx
  on song_versions using gin (search_text gin_trgm_ops);

create index if not exists song_variations_search_fts_idx
  on song_variations using gin (to_tsvector('italian', search_text));
create index if not exists song_variations_search_trgm_idx
  on song_variations using gin (search_text gin_trgm_ops);

-- =====================================================================
-- SEARCHING
-- =====================================================================
-- Returns the songs whose text matches, plus the fragment that matched so the
-- UI can show *why* a song came up. Deliberately content-only: the four
-- surfaces already have the song list in hand and keep matching title and
-- artist themselves, instantly and offline; this call adds the one thing they
-- cannot do client-side.
--
-- `p_church_id` null  -> canonical songs only (the shared library).
-- `p_church_id` set   -> that church's songs plus the canonical ones, which is
--                        what every church-scoped surface already lists.
--
-- No `security definer`: see the header. RLS does the filtering, and the
-- church filter below is a narrowing of it, never a widening.
create or replace function search_song_content(
  p_query text,
  p_church_id uuid default null,
  p_limit integer default 60
)
returns table (song_id uuid, snippet text, source text)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_norm text := btrim(song_search_text(p_query));
  -- `%` and `_` are wildcards to `ilike`; a leader typing "100%" means the
  -- characters, so neutralise them for the pattern (v_norm stays literal, the
  -- snippet window is cut with it).
  v_like text;
  v_limit integer := greatest(1, least(200, coalesce(p_limit, 60)));
  v_terms text;
  v_tsq tsquery;
begin
  -- One or two characters match everything and cost the most; make the caller
  -- mean it. The client enforces the same floor so it never fires the request.
  if length(v_norm) < 3 then
    return;
  end if;

  v_like := '%' || replace(replace(replace(v_norm, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- Prefix-match every word so the results narrow as the leader types
  -- ("non mi lasc" already finds "non mi lascerà").
  select string_agg(quote_literal(t) || ':*', ' & ')
    into v_terms
  from unnest(regexp_split_to_array(v_norm, '[^[:alnum:]]+')) as t
  where t <> '';

  if v_terms is not null then
    v_tsq := to_tsquery('italian', v_terms);
    -- An all-stopword query ("e la") reduces to nothing; the ilike below still
    -- has something to say about it.
    if v_tsq::text = '' then
      v_tsq := null;
    end if;
  end if;

  return query
  with matches as (
    -- The current version of each song…
    select
      s.id as song_id,
      v.search_text,
      'version'::text as source
    from songs s
    join song_versions v on v.id = s.current_version_id
    where (p_church_id is null and s.church_id is null)
       or (p_church_id is not null and (s.church_id = p_church_id or s.church_id is null))
    union all
    -- …and any variation the caller is allowed to read.
    select
      s.id as song_id,
      var.search_text,
      'variation'::text as source
    from songs s
    join song_variations var on var.song_id = s.id
    where (p_church_id is null and s.church_id is null)
       or (p_church_id is not null and (s.church_id = p_church_id or s.church_id is null))
  ),
  hits as (
    select
      m.song_id,
      m.source,
      m.search_text,
      case
        when v_tsq is not null and to_tsvector('italian', m.search_text) @@ v_tsq
          then ts_rank(to_tsvector('italian', m.search_text), v_tsq)
        else 0
      end as rank
    from matches m
    where (v_tsq is not null and to_tsvector('italian', m.search_text) @@ v_tsq)
       or m.search_text ilike v_like
  ),
  -- A song matching through both its version and a variation is still one
  -- result; keep the strongest.
  best as (
    select distinct on (h.song_id)
      h.song_id,
      h.source,
      h.search_text,
      h.rank,
      position(lower(v_norm) in lower(h.search_text)) as hit_pos
    from hits h
    order by h.song_id, h.rank desc, h.source
  )
  select
    b.song_id,
    case
      when b.rank > 0 then
        ts_headline(
          'italian', b.search_text, v_tsq,
          'MaxWords=14, MinWords=5, ShortWord=2, MaxFragments=1, StartSel=«, StopSel=»'
        )
      else
        -- An `ilike`-only hit has no tsquery to highlight, so cut a window
        -- around the literal match by hand and mark it the same way, so the
        -- client only ever has to understand one shape.
        substr(b.search_text, greatest(1, b.hit_pos - 30), least(30, b.hit_pos - 1))
          || '«' || substr(b.search_text, b.hit_pos, length(v_norm)) || '»'
          || substr(b.search_text, b.hit_pos + length(v_norm), 30)
    end as snippet,
    b.source
  from best b
  order by b.rank desc, b.song_id
  limit v_limit;
end;
$$;

comment on function search_song_content(text, uuid, integer) is
  'Songs whose OnSong body (current version or a readable variation) matches the query, with the matching fragment marked with « ». Runs as the caller, so RLS decides what is searchable.';

revoke all on function search_song_content(text, uuid, integer) from public;
revoke all on function search_song_content(text, uuid, integer) from anon;
grant execute on function search_song_content(text, uuid, integer) to authenticated;

notify pgrst, 'reload schema';
