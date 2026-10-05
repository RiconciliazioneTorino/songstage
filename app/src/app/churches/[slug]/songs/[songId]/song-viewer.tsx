'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { parseOnSong, SongView } from '@/lib/onsong';

export type Track = {
  id: string;
  label: string;
  body: string;
  badge?: string;
  editHref?: string;
};

export function SongViewer({
  body,
  tracks,
  defaultTrackId,
}: {
  body?: string;
  tracks?: Track[];
  defaultTrackId?: string;
}) {
  const allTracks: Track[] = useMemo(() => {
    if (tracks && tracks.length > 0) return tracks;
    if (body !== undefined) return [{ id: 'base', label: 'Base', body }];
    return [];
  }, [tracks, body]);

  const [selectedId, setSelectedId] = useState(
    defaultTrackId && allTracks.some((t) => t.id === defaultTrackId)
      ? defaultTrackId
      : allTracks[0]?.id ?? ''
  );
  const [semitones, setSemitones] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const [showChords, setShowChords] = useState(true);

  const selected = allTracks.find((t) => t.id === selectedId) ?? allTracks[0];
  const song = useMemo(() => parseOnSong(selected?.body ?? ''), [selected]);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2 items-center mb-6 p-2 rounded-md bg-panel border border-border">
        {allTracks.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-400 px-2">Versione</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="text-sm px-2 py-1 rounded bg-bg border border-border outline-none"
            >
              {allTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                  {t.badge ? ` (${t.badge})` : ''}
                </option>
              ))}
            </select>
            {selected?.editHref && (
              <Link
                href={selected.editHref}
                className="text-xs px-2 py-1 rounded-full border border-border hover:border-accent"
              >
                Modifica
              </Link>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-400 px-2">Trasposizione</span>
          <button
            onClick={() => setSemitones((s) => s - 1)}
            className="px-2 py-1 rounded-full border border-border hover:border-accent text-sm"
          >
            −
          </button>
          <span className="text-xs px-2 py-1 rounded-full bg-bg border border-border min-w-[2.5rem] text-center">
            {semitones >= 0 ? '+' : ''}
            {semitones}
          </span>
          <button
            onClick={() => setSemitones((s) => s + 1)}
            className="px-2 py-1 rounded-full border border-border hover:border-accent text-sm"
          >
            +
          </button>
          <button
            onClick={() => setSemitones(0)}
            className="px-2 py-1 rounded-full border border-border hover:border-accent text-xs ml-1"
          >
            reset
          </button>
        </div>

        <div className="flex items-center gap-1 ml-2">
          <span className="text-xs text-zinc-400 px-2">Font</span>
          <button
            onClick={() => setFontScale((f) => Math.max(0.6, f - 0.1))}
            className="px-2 py-1 rounded-full border border-border hover:border-accent text-sm"
          >
            A−
          </button>
          <button
            onClick={() => setFontScale((f) => Math.min(3, f + 0.1))}
            className="px-2 py-1 rounded-full border border-border hover:border-accent text-sm"
          >
            A+
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-400 ml-2">
          <input
            type="checkbox"
            checked={showChords}
            onChange={(e) => setShowChords(e.target.checked)}
          />
          accordi
        </label>
      </div>

      <SongView song={song} semitones={semitones} fontScale={fontScale} showChords={showChords} />
    </div>
  );
}
