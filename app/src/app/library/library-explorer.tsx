'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  SongSnippet,
  matchesTitleOrArtist,
  sortByRelevance,
  useSongContentSearch,
} from '@/lib/songs/content-search';

export type CanonicalSong = {
  id: string;
  title: string;
  artist: string | null;
  original_key: string | null;
};

export function LibraryExplorer({ songs }: { songs: CanonicalSong[] }) {
  const [query, setQuery] = useState('');
  // No church id: the library is exactly the canonical songs.
  const { matches: contentMatches } = useSongContentSearch(query, null);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return songs;
    const kept = songs.filter((s) => matchesTitleOrArtist(s, q) || contentMatches.has(s.id));
    return sortByRelevance(kept, q, contentMatches);
  }, [songs, query, contentMatches]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Cerca per titolo, artista o testo…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
      />

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-zinc-500">
          Nessuna canzone trovata.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const contentMatch = contentMatches.get(s.id) ?? null;
            return (
              <Link
                key={s.id}
                href={`/library/${s.id}`}
                className="block rounded-md border border-border bg-panel p-3 hover:border-accent transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.title}</div>
                    {s.artist && <div className="text-xs text-zinc-500 truncate">{s.artist}</div>}
                    {contentMatch && <SongSnippet match={contentMatch} />}
                  </div>
                  {s.original_key && (
                    <span className="flex-shrink-0 text-xs text-zinc-400 px-2 py-0.5 rounded-full bg-bg border border-border">
                      {s.original_key}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
