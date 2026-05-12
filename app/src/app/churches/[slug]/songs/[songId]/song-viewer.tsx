'use client';

import { useMemo, useState } from 'react';
import { parseOnSong, SongView } from '@/lib/onsong';

export function SongViewer({ body }: { body: string }) {
  const [semitones, setSemitones] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const [showChords, setShowChords] = useState(true);

  const song = useMemo(() => parseOnSong(body), [body]);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2 items-center mb-6 p-2 rounded-md bg-panel border border-border">
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-400 px-2">Trasposizione</span>
          <button
            onClick={() => setSemitones((s) => s - 1)}
            className="px-2 py-1 rounded border border-border hover:border-accent text-sm"
          >
            −
          </button>
          <span className="text-xs px-2 py-1 rounded bg-bg border border-border min-w-[2.5rem] text-center">
            {semitones >= 0 ? '+' : ''}
            {semitones}
          </span>
          <button
            onClick={() => setSemitones((s) => s + 1)}
            className="px-2 py-1 rounded border border-border hover:border-accent text-sm"
          >
            +
          </button>
          <button
            onClick={() => setSemitones(0)}
            className="px-2 py-1 rounded border border-border hover:border-accent text-xs ml-1"
          >
            reset
          </button>
        </div>

        <div className="flex items-center gap-1 ml-2">
          <span className="text-xs text-zinc-400 px-2">Font</span>
          <button
            onClick={() => setFontScale((f) => Math.max(0.6, f - 0.1))}
            className="px-2 py-1 rounded border border-border hover:border-accent text-sm"
          >
            A−
          </button>
          <button
            onClick={() => setFontScale((f) => Math.min(3, f + 0.1))}
            className="px-2 py-1 rounded border border-border hover:border-accent text-sm"
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
