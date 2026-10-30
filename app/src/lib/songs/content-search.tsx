'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Searching songs by their text.
 *
 * Every song-picking surface already holds the list of songs it can show and
 * filters it in the browser, which is instant and survives a flaky connection.
 * The one thing it cannot do there is look inside the bodies: shipping every
 * `body_onsong` to the client would mean hundreds of kilobytes on a page the
 * leader opens mid-service.
 *
 * So the division is: title and artist stay client-side and unchanged, and the
 * body is searched by `search_song_content` (migration 0012), which runs as the
 * caller and so can only ever return songs that user could already open. Each
 * surface unions the two sets of matches and shows the returned fragment as the
 * reason a song it never typed the title of is on screen.
 */

/** Same floor as the SQL function: shorter queries match everything. */
export const MIN_CONTENT_QUERY = 3;

export type SongContentMatch = {
  songId: string;
  /** Fragment that matched, with the hit wrapped in « ». */
  snippet: string;
  source: 'version' | 'variation';
  /** Position in the ranked result, best first. */
  order: number;
};

/**
 * Content matches for `query`, keyed by song id.
 *
 * `churchId` null searches the canonical library only; a church id searches
 * that church's songs plus the canonical ones — the same two scopes the
 * surfaces themselves list.
 */
export function useSongContentSearch(
  query: string,
  churchId: string | null
): { matches: Map<string, SongContentMatch>; searching: boolean } {
  const [matches, setMatches] = useState<Map<string, SongContentMatch>>(new Map());
  const [searching, setSearching] = useState(false);
  // Results can land out of order; only the newest request may paint.
  const latest = useRef(0);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_CONTENT_QUERY) {
      latest.current += 1;
      setMatches(new Map());
      setSearching(false);
      return;
    }

    const requestId = ++latest.current;
    setSearching(true);
    // Typing is faster than a round trip; wait for a pause.
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('search_song_content', {
        p_query: trimmed,
        p_church_id: churchId,
      });
      if (requestId !== latest.current) return;
      setSearching(false);
      if (error) {
        // A failed content search must not blank the title/artist results the
        // surface is already showing.
        setMatches(new Map());
        return;
      }
      const next = new Map<string, SongContentMatch>();
      for (const row of data ?? []) {
        if (!row.song_id || next.has(row.song_id)) continue;
        next.set(row.song_id, {
          songId: row.song_id,
          snippet: row.snippet ?? '',
          source: row.source === 'variation' ? 'variation' : 'version',
          // The function returns them best first; keep that.
          order: next.size,
        });
      }
      setMatches(next);
    }, 250);

    return () => clearTimeout(timer);
  }, [trimmed, churchId]);

  return { matches, searching };
}

/** Lowercased and stripped of accents, so "perche" matches "perché". */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

export type SearchableSong = { id: string; title: string; artist: string | null };

/** The client-side half of the search: title and artist, accent-insensitive. */
export function matchesTitleOrArtist(song: SearchableSong, query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  return (
    normalizeForSearch(song.title).includes(q) ||
    normalizeForSearch(song.artist ?? '').includes(q)
  );
}

/**
 * How well a song answers the query, lower being better.
 *
 * Someone who types a title means that song, even when a dozen others happen
 * to sing the same words: the title comes first, then the artist, and the
 * songs found only by their text come last in the order Postgres ranked them.
 */
function relevance(song: SearchableSong, query: string, contentOrder: number | null): number {
  const q = normalizeForSearch(query);
  const title = normalizeForSearch(song.title);
  if (title === q) return 0;
  if (title.startsWith(q)) return 1;
  if (title.includes(q)) return 2;
  if (normalizeForSearch(song.artist ?? '').includes(q)) return 3;
  // Keep the ranked order of the content matches, below every name match.
  return 4 + (contentOrder ?? 0) / 100000;
}

/**
 * Orders a filtered list by relevance to `query`. An empty query leaves the
 * list as it was, which is the alphabetical order the surfaces load it in.
 */
export function sortByRelevance<T extends SearchableSong>(
  songs: T[],
  query: string,
  matches: Map<string, SongContentMatch>
): T[] {
  if (!normalizeForSearch(query)) return songs;
  return [...songs].sort((a, b) => {
    const da = relevance(a, query, matches.get(a.id)?.order ?? null);
    const db = relevance(b, query, matches.get(b.id)?.order ?? null);
    if (da !== db) return da - db;
    return a.title.localeCompare(b.title);
  });
}

export type SnippetPart = { text: string; hit: boolean };

/**
 * Splits a snippet on the « » the SQL function marks the hit with, and
 * collapses the whitespace: bodies are full of line breaks and the fragment is
 * rendered on one line.
 */
export function parseSnippet(snippet: string): SnippetPart[] {
  // Nothing but whitespace is nothing to show, markers or not.
  if (snippet.replace(/[«»\s]/g, '') === '') return [];
  const parts: SnippetPart[] = [];
  // Split keeping the markers, then fold runs of whitespace per piece.
  for (const piece of snippet.split(/(«[^»]*»)/g)) {
    if (!piece) continue;
    const hit = piece.startsWith('«') && piece.endsWith('»');
    // Some imported bodies carry the line break as the two characters `\r`
    // rather than the control character; both are just a break to the reader.
    const text = (hit ? piece.slice(1, -1) : piece)
      .replace(/\\[rn]/g, ' ')
      .replace(/\s+/g, ' ');
    if (!text) continue;
    parts.push({ text, hit });
  }
  return parts;
}

/** The matched fragment, with the hit itself picked out. */
export function SongSnippet({
  match,
  className = '',
}: {
  match: SongContentMatch;
  className?: string;
}) {
  const parts = parseSnippet(match.snippet);
  if (parts.length === 0) return null;
  return (
    <div className={`text-xs text-zinc-500 truncate ${className}`}>
      <span className="text-zinc-600">
        {match.source === 'variation' ? 'Variazione: ' : 'Testo: '}
      </span>
      …
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="bg-accent/20 text-accent rounded-sm px-0.5">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
      …
    </div>
  );
}
