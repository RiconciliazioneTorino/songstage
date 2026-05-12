'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { parseOnSong, SongView } from '@/lib/onsong';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type Slide = {
  itemId: string;
  songId: string;
  title: string;
  artist: string | null;
  originalKey: string | null;
  transpose: number;
  body: string;
};

export type ProjectionState = {
  index: number;
  transposeOverride: number;
  fontScale: number;
  showChords: boolean;
};

export function Master({
  setId,
  setName,
  slug,
  slides,
}: {
  setId: string;
  setName: string;
  slug: string;
  slides: Slide[];
}) {
  const [index, setIndex] = useState(0);
  const [transposeOverride, setTransposeOverride] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const [showChords, setShowChords] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`set:${setId}:projection`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channel.on('broadcast', { event: 'request_state' }, () => {
      channel.send({
        type: 'broadcast',
        event: 'state',
        payload: { index, transposeOverride, fontScale, showChords },
      });
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({
      type: 'broadcast',
      event: 'state',
      payload: { index, transposeOverride, fontScale, showChords },
    });
  }, [index, transposeOverride, fontScale, showChords]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setIndex((i) => Math.min(slides.length - 1, i + 1));
        setTransposeOverride(0);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setIndex((i) => Math.max(0, i - 1));
        setTransposeOverride(0);
      } else if (e.key === '+' || e.key === '=') {
        setTransposeOverride((s) => s + 1);
      } else if (e.key === '-' || e.key === '_') {
        setTransposeOverride((s) => s - 1);
      } else if (e.key === '0') {
        setTransposeOverride(0);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  const slide = slides[index];
  const song = useMemo(() => (slide ? parseOnSong(slide.body) : null), [slide]);
  const totalSemitones = (slide?.transpose ?? 0) + transposeOverride;

  const projectorUrl = `/churches/${slug}/sets/${setId}/projector`;

  if (!slide) {
    return (
      <main className="min-h-screen p-8 max-w-2xl mx-auto">
        <p className="text-zinc-400">Questo set non ha canzoni.</p>
        <Link href={`/churches/${slug}/sets/${setId}`} className="text-accent">
          ← Torna al set
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <div className="border-b border-border bg-panel p-3 flex flex-wrap gap-3 items-center">
        <Link
          href={`/churches/${slug}/sets/${setId}`}
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← {setName}
        </Link>
        <div className="flex items-center gap-1">
          <button
            disabled={index === 0}
            onClick={() => {
              setIndex((i) => Math.max(0, i - 1));
              setTransposeOverride(0);
            }}
            className="px-3 py-1 rounded border border-border hover:border-accent disabled:opacity-30 text-sm"
          >
            ◀
          </button>
          <select
            value={index}
            onChange={(e) => {
              setIndex(Number(e.target.value));
              setTransposeOverride(0);
            }}
            className="px-2 py-1 rounded bg-bg border border-border text-sm"
          >
            {slides.map((s, i) => (
              <option key={s.itemId} value={i}>
                {i + 1}. {s.title}
              </option>
            ))}
          </select>
          <button
            disabled={index === slides.length - 1}
            onClick={() => {
              setIndex((i) => Math.min(slides.length - 1, i + 1));
              setTransposeOverride(0);
            }}
            className="px-3 py-1 rounded border border-border hover:border-accent disabled:opacity-30 text-sm"
          >
            ▶
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-400 px-1">Trasposizione</span>
          <button
            onClick={() => setTransposeOverride((s) => s - 1)}
            className="px-2 py-1 rounded border border-border hover:border-accent text-sm"
          >
            −
          </button>
          <span className="text-xs px-2 py-1 rounded bg-bg border border-border min-w-[3rem] text-center">
            {totalSemitones >= 0 ? '+' : ''}
            {totalSemitones}
          </span>
          <button
            onClick={() => setTransposeOverride((s) => s + 1)}
            className="px-2 py-1 rounded border border-border hover:border-accent text-sm"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-1">
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

        <label className="flex items-center gap-1 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={showChords}
            onChange={(e) => setShowChords(e.target.checked)}
          />
          accordi
        </label>

        <span className="flex-1" />

        <a
          href={projectorUrl}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1 rounded border border-accent text-accent hover:bg-accent/10 text-sm"
        >
          Apri proiettore ↗
        </a>
      </div>

      <div className="flex-1 overflow-auto p-8 max-w-3xl mx-auto w-full">
        {song && (
          <SongView
            song={song}
            semitones={totalSemitones}
            fontScale={fontScale}
            showChords={showChords}
          />
        )}
      </div>
    </main>
  );
}
