'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseOnSong, SongView } from '@/lib/onsong';
import { createClient } from '@/lib/supabase/client';
import { applyOrder, resolveIncomingIndex, type ProjectionState } from '@/lib/sets/projection';
import type { Slide } from '../master/master';

/**
 * This screen's own zoom, multiplied on top of whatever size the leader sends.
 * Keeping it a multiplier rather than an absolute size means both still work:
 * the leader can resize every screen at once, and whoever is standing at this
 * one can still nudge it for the room without that nudge being wiped out by
 * the leader's next adjustment.
 */
const ZOOM_KEY = 'songstage:projector-zoom';
/**
 * Chords on the congregation's screen are this screen's business too. Until
 * someone here decides, it follows the leader, so nothing changes for a
 * church that never touches the button.
 */
const SHOW_CHORDS_KEY = 'songstage:projector-show-chords';
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4;

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

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
  const [zoom, setZoom] = useState(1);
  const [showChordsLocal, setShowChordsLocal] = useState<boolean | null>(null);
  // The controls sit out of the way until someone interacts: this screen is
  // pointed at a congregation, not at an operator.
  const [controlsVisible, setControlsVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hideControlsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  // The broadcast handler is installed once, so the slide list and the current
  // position reach it through refs rather than a stale closure.
  const slidesLocalRef = useRef(slidesLocal);
  const indexRef = useRef(0);

  useEffect(() => setSlidesLocal(slides), [slides]);

  useEffect(() => {
    try {
      const saved = Number.parseFloat(localStorage.getItem(ZOOM_KEY) ?? '');
      if (Number.isFinite(saved) && saved > 0) setZoom(clampZoom(saved));
      const chords = localStorage.getItem(SHOW_CHORDS_KEY);
      if (chords !== null) setShowChordsLocal(chords === '1');
    } catch {}
  }, []);

  // The gesture listeners are installed once, so they read and write the
  // current zoom through a ref.
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  function applyZoom(next: number) {
    const clamped = clampZoom(next);
    zoomRef.current = clamped;
    setZoom(clamped);
    try {
      localStorage.setItem(ZOOM_KEY, String(clamped));
    } catch {}
    revealControls();
  }

  function toggleChords() {
    const next = !(showChordsLocal ?? state.showChords);
    setShowChordsLocal(next);
    try {
      localStorage.setItem(SHOW_CHORDS_KEY, next ? '1' : '0');
    } catch {}
    revealControls();
  }

  function nudgeZoom(delta: number) {
    applyZoom(zoomRef.current + delta);
  }

  function revealControls() {
    setControlsVisible(true);
    if (hideControlsRef.current) clearTimeout(hideControlsRef.current);
    hideControlsRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }

  useEffect(
    () => () => {
      if (hideControlsRef.current) clearTimeout(hideControlsRef.current);
    },
    []
  );
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

  // Pinch to zoom, plus the trackpad pinch browsers report as ctrl+wheel.
  // Registered by hand because both need preventDefault, which React's
  // passive listeners do not allow.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let startSpread = 0;
    let startZoom = 1;

    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        startSpread = spread();
        startZoom = zoomRef.current;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size !== 2 || startSpread === 0) return;
      e.preventDefault();
      applyZoom(startZoom * (spread() / startSpread));
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) startSpread = 0;
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      // Exponential so that zooming in and back out returns to exactly where
      // it started, instead of drifting down with every pair of gestures.
      applyZoom(zoomRef.current * Math.exp(-e.deltaY / 200));
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      className="h-dvh overflow-auto p-12 touch-pan-y"
      onPointerDown={revealControls}
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
          // The leader's size for the room, scaled by this screen's own zoom.
          fontScale={state.fontScale * zoom * 1.4}
          showChords={showChordsLocal ?? state.showChords}
        />
      )}

      <div
        data-no-print
        className={`fixed bottom-3 right-3 flex items-center gap-1 rounded-full bg-panel/90 border border-border px-1.5 py-1 transition-opacity duration-500 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={() => nudgeZoom(-0.1)}
          aria-label="Rimpicciolisci il testo"
          className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center"
        >
          A−
        </button>
        <span className="text-xs min-w-[3rem] text-center font-mono text-zinc-400">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => nudgeZoom(0.1)}
          aria-label="Ingrandisci il testo"
          className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center"
        >
          A+
        </button>
        <button
          onClick={toggleChords}
          aria-pressed={showChordsLocal ?? state.showChords}
          aria-label="Mostra o nascondi gli accordi"
          title="Mostra o nascondi gli accordi"
          className={`min-w-[2.25rem] h-9 rounded-full border text-sm flex items-center justify-center ${
            (showChordsLocal ?? state.showChords)
              ? 'border-accent text-accent'
              : 'border-border hover:border-accent text-zinc-400'
          }`}
        >
          ♪
        </button>
      </div>
    </main>
  );
}
