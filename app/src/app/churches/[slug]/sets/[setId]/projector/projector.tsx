'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseOnSong, SongView } from '@/lib/onsong';
import { createClient } from '@/lib/supabase/client';
import { applyOrder, resolveIncomingIndex, type ProjectionState } from '@/lib/sets/projection';
import type { Slide } from '../master/master';

export function Projector({ setId, slides }: { setId: string; slides: Slide[] }) {
  // `transpose: null` means "no leader has spoken yet" — fall back to the key
  // stored on the set item.
  const [state, setState] = useState<Omit<ProjectionState, 'transpose'> & {
    transpose: number | null;
  }>({
    itemId: null,
    index: 0,
    transpose: null,
    fontScale: 1,
    showChords: true,
    scrollFraction: 0,
  });
  const [slidesLocal, setSlidesLocal] = useState(slides);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  // The broadcast handler is installed once, so the slide list and the current
  // position reach it through refs rather than a stale closure.
  const slidesLocalRef = useRef(slidesLocal);
  const indexRef = useRef(0);

  useEffect(() => setSlidesLocal(slides), [slides]);
  useEffect(() => {
    slidesLocalRef.current = slidesLocal;
  }, [slidesLocal]);
  useEffect(() => {
    indexRef.current = state.index;
  }, [state.index]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`set:${setId}:projection`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      const p = payload as ProjectionState;
      // Follow the song by id: an index alone would point at the wrong song
      // as soon as the leader reorders or inserts something.
      const next = resolveIncomingIndex(p, slidesLocalRef.current, indexRef.current);
      if (next === -1) {
        // A song we don't have yet. Keep projecting the current one — a blank
        // screen mid-service is worse — and pull the updated set.
        router.refresh();
        setState((prev) => ({ ...prev, ...p, index: prev.index }));
        return;
      }
      setState((prev) => ({ ...prev, ...p, index: next }));
    });
    // The leader reordered the set mid-service.
    channel.on('broadcast', { event: 'set_order' }, ({ payload }) => {
      const { itemIds } = payload as { itemIds: string[] };
      setSlidesLocal((prev) => applyOrder(prev, itemIds));
    });
    channel.on('broadcast', { event: 'slide_update' }, ({ payload }) => {
      const { itemId, body } = payload as { itemId: string; body: string };
      setSlidesLocal((prev) =>
        prev.map((s) => (s.itemId === itemId ? { ...s, body } : s))
      );
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        channel.send({ type: 'broadcast', event: 'request_state', payload: {} });
      } else {
        setConnected(false);
      }
    });
    return () => {
      channel.unsubscribe();
    };
  }, [setId, router]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    el.scrollTop = state.scrollFraction * max;
  }, [state.scrollFraction, state.index, state.fontScale]);

  // A refresh may have just brought in the song the leader moved to.
  useEffect(() => {
    if (!state.itemId) return;
    const found = slidesLocal.findIndex((s) => s.itemId === state.itemId);
    if (found !== -1 && found !== state.index) {
      setState((prev) => ({ ...prev, index: found }));
    }
  }, [slidesLocal, state.itemId, state.index]);

  const slide = slidesLocal[state.index];
  const song = useMemo(() => (slide ? parseOnSong(slide.body) : null), [slide]);
  const totalSemitones = state.transpose ?? slide?.transpose ?? 0;

  if (!slide) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-400">Nessuna canzone nel set.</p>
      </main>
    );
  }

  return (
    <main
      ref={scrollRef}
      className="h-dvh overflow-auto p-12"
      style={{
        paddingTop: 'max(3rem, env(safe-area-inset-top))',
        paddingBottom: 'max(3rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(3rem, env(safe-area-inset-left))',
        paddingRight: 'max(3rem, env(safe-area-inset-right))',
      }}
    >
      {!connected && (
        <div className="fixed top-2 right-2 text-xs text-zinc-500 px-2 py-1 rounded-full bg-panel border border-border">
          Connessione…
        </div>
      )}
      {song && (
        <SongView
          song={song}
          semitones={totalSemitones}
          fontScale={state.fontScale * 1.4}
          showChords={state.showChords}
        />
      )}
    </main>
  );
}
