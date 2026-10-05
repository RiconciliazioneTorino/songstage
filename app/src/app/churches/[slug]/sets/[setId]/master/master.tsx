'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseOnSong, SongView } from '@/lib/onsong';
import { createClient } from '@/lib/supabase/client';
import { saveSlideEdit } from '@/lib/songs/actions';
import {
  addSongToSet,
  heartbeatSetMaster,
  releaseSetMaster,
  updateSetItem,
} from '@/lib/sets/actions';
import { Metronome, type MetronomeUpdate } from '@/lib/metronome/scheduler';
import type { RealtimeChannel } from '@supabase/supabase-js';

const EMIT_METRONOME_KEY = 'songstage:emit-metronome';

function parseBeatsPerBar(sig: string | null | undefined): number {
  if (!sig) return 4;
  const m = sig.match(/^\s*(\d+)\s*\//);
  if (!m) return 4;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 32 ? n : 4;
}

export type SlideVariation = {
  id: string;
  name: string;
  scope: 'church' | 'band' | 'user';
  bandName: string | null;
};

export type Slide = {
  itemId: string;
  songId: string;
  variationId: string | null;
  title: string;
  artist: string | null;
  originalKey: string | null;
  songTempo: number | null;
  songTimeSignature: string | null;
  transpose: number;
  body: string;
  baseBody: string;
  availableVariations: SlideVariation[];
  variationBodies: Record<string, string>;
};

export type ProjectionState = {
  index: number;
  transposeOverride: number;
  fontScale: number;
  showChords: boolean;
  scrollFraction: number;
};

export type AvailableSong = {
  id: string;
  title: string;
  artist: string | null;
  original_key: string | null;
};

export function Master({
  setId,
  setName,
  slug,
  slides,
  availableSongs,
  currentUserId,
  currentUserEmail,
  canBeMaster,
  liveMasterUserId,
  liveMasterHeartbeat,
}: {
  setId: string;
  setName: string;
  slug: string;
  slides: Slide[];
  availableSongs: AvailableSong[];
  currentUserId: string;
  currentUserEmail: string;
  canBeMaster: boolean;
  liveMasterUserId: string | null;
  liveMasterHeartbeat: number;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [slidesLocal, setSlidesLocal] = useState(slides);
  const [fontScale, setFontScale] = useState(1);
  const [showChords, setShowChords] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [addingSongId, setAddingSongId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [role, setRole] = useState<'connecting' | 'master' | 'viewer'>('connecting');
  const [activeMasterEmail, setActiveMasterEmail] = useState<string | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<
    { userId: string; email: string; expiresAt: number } | null
  >(null);
  const [pendingRequest, setPendingRequest] = useState<{ expiresAt: number } | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [metronomeBpm, setMetronomeBpm] = useState(90);
  const [metronomeRunning, setMetronomeRunning] = useState(false);
  const [metronomeStartAt, setMetronomeStartAt] = useState(0);
  const [metronomeBeatsPerBar, setMetronomeBeatsPerBar] = useState(4);
  const [emitMetronome, setEmitMetronome] = useState(false);
  const roleRef = useRef(role);
  const metronomeRef = useRef<Metronome | null>(null);
  const promoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // DB told us there's a recent master other than me — treat as authoritative
  // for the initial window so we don't steal control from someone whose
  // Realtime presence is briefly flickering (laptop sleep, flaky wifi…).
  const dbHasOtherLiveMasterRef = useRef(
    liveMasterUserId !== null &&
      liveMasterUserId !== currentUserId &&
      Date.now() - liveMasterHeartbeat < 45_000
  );
  const channelRef = useRef<RealtimeChannel | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollFractionRef = useRef(0);
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const initialTransposeRef = useRef<Record<string, number>>(
    Object.fromEntries(slides.map((s) => [s.itemId, s.transpose]))
  );

  useEffect(() => setSlidesLocal(slides), [slides]);

  const currentSlide = slidesLocal[index];
  const transposeOverride = currentSlide
    ? currentSlide.transpose - (initialTransposeRef.current[currentSlide.itemId] ?? 0)
    : 0;

  function persistTranspose(itemId: string, value: number) {
    if (saveTimers.current[itemId]) clearTimeout(saveTimers.current[itemId]);
    saveTimers.current[itemId] = setTimeout(() => {
      updateSetItem(itemId, { transpose_semitones: value });
    }, 400);
  }

  function bumpTranspose(delta: number) {
    if (roleRef.current !== 'master') return;
    setSlidesLocal((prev) => {
      const s = prev[index];
      if (!s) return prev;
      const value = s.transpose + delta;
      persistTranspose(s.itemId, value);
      const next = prev.slice();
      next[index] = { ...s, transpose: value };
      return next;
    });
  }

  function resetTranspose() {
    if (roleRef.current !== 'master') return;
    setSlidesLocal((prev) => {
      const s = prev[index];
      if (!s) return prev;
      if (s.transpose === 0) return prev;
      persistTranspose(s.itemId, 0);
      const next = prev.slice();
      next[index] = { ...s, transpose: 0 };
      return next;
    });
  }

  const stateRef = useRef({ index, transposeOverride, fontScale, showChords });
  useEffect(() => {
    stateRef.current = { index, transposeOverride, fontScale, showChords };
  }, [index, transposeOverride, fontScale, showChords]);

  const metronomeStateRef = useRef<MetronomeUpdate>({
    running: metronomeRunning,
    bpm: metronomeBpm,
    startAt: metronomeStartAt,
    beatsPerBar: metronomeBeatsPerBar,
  });
  useEffect(() => {
    metronomeStateRef.current = {
      running: metronomeRunning,
      bpm: metronomeBpm,
      startAt: metronomeStartAt,
      beatsPerBar: metronomeBeatsPerBar,
    };
  }, [metronomeRunning, metronomeBpm, metronomeStartAt, metronomeBeatsPerBar]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  // Heartbeat while master so the sets listing can show "live" badge
  useEffect(() => {
    if (role !== 'master') return;
    heartbeatSetMaster(setId);
    const t = setInterval(() => heartbeatSetMaster(setId), 15_000);
    return () => {
      clearInterval(t);
      releaseSetMaster(setId);
    };
  }, [role, setId]);

  // When the active song changes and I'm master, adopt its tempo + time signature
  useEffect(() => {
    if (role !== 'master') return;
    const slide = slidesLocal[index];
    if (!slide) return;
    const newBeats = parseBeatsPerBar(slide.songTimeSignature);
    const t = slide.songTempo;
    const tempoChanged = !!(t && t > 0 && t !== metronomeBpm);
    const beatsChanged = newBeats !== metronomeBeatsPerBar;
    if (!tempoChanged && !beatsChanged) return;
    const nextBpm = tempoChanged ? t! : metronomeBpm;
    if (tempoChanged) setMetronomeBpm(t!);
    if (beatsChanged) setMetronomeBeatsPerBar(newBeats);
    const ch = channelRef.current;
    if (metronomeRunning) {
      const startAt = Date.now() + 100;
      setMetronomeStartAt(startAt);
      ch?.send({
        type: 'broadcast',
        event: 'metronome_update',
        payload: { running: true, bpm: nextBpm, startAt, beatsPerBar: newBeats },
      });
    } else {
      ch?.send({
        type: 'broadcast',
        event: 'metronome_update',
        payload: {
          running: false,
          bpm: nextBpm,
          startAt: metronomeStartAt,
          beatsPerBar: newBeats,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, role, slidesLocal]);

  // Restore local emit-metronome preference
  useEffect(() => {
    try {
      const v = localStorage.getItem(EMIT_METRONOME_KEY);
      if (v === '1') setEmitMetronome(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(EMIT_METRONOME_KEY, emitMetronome ? '1' : '0');
    } catch {}
  }, [emitMetronome]);

  // Drive the local audio engine from current metronome state and toggle
  useEffect(() => {
    if (emitMetronome && !metronomeRef.current) {
      metronomeRef.current = new Metronome();
    }
    if (!metronomeRef.current) return;
    if (emitMetronome && metronomeRunning) {
      metronomeRef.current.update({
        running: true,
        bpm: metronomeBpm,
        startAt: metronomeStartAt,
        beatsPerBar: metronomeBeatsPerBar,
      });
    } else {
      metronomeRef.current.stop();
    }
  }, [emitMetronome, metronomeRunning, metronomeBpm, metronomeStartAt, metronomeBeatsPerBar]);

  useEffect(() => {
    return () => {
      metronomeRef.current?.dispose();
      metronomeRef.current = null;
    };
  }, []);

  // countdown ticker for request timeouts
  useEffect(() => {
    if (!incomingRequest && !pendingRequest) return;
    const t = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(t);
  }, [incomingRequest, pendingRequest]);

  useEffect(() => {
    if (incomingRequest && nowTick >= incomingRequest.expiresAt) {
      setIncomingRequest(null);
    }
    if (pendingRequest && nowTick >= pendingRequest.expiresAt) {
      setPendingRequest(null);
    }
  }, [nowTick, incomingRequest, pendingRequest]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`set:${setId}:projection`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: currentUserId },
      },
    });

    channel.on('broadcast', { event: 'request_state' }, () => {
      if (roleRef.current !== 'master') return;
      channel.send({
        type: 'broadcast',
        event: 'state',
        payload: {
          ...stateRef.current,
          scrollFraction: scrollFractionRef.current,
        },
      });
      channel.send({
        type: 'broadcast',
        event: 'metronome_update',
        payload: metronomeStateRef.current,
      });
    });

    channel.on('broadcast', { event: 'metronome_update' }, ({ payload }) => {
      const p = payload as MetronomeUpdate;
      setMetronomeRunning(p.running);
      if (typeof p.bpm === 'number' && p.bpm > 0) setMetronomeBpm(p.bpm);
      if (typeof p.startAt === 'number' && p.startAt > 0) setMetronomeStartAt(p.startAt);
      if (typeof p.beatsPerBar === 'number' && p.beatsPerBar >= 1)
        setMetronomeBeatsPerBar(p.beatsPerBar);
    });

    // viewer applies incoming state so its UI mirrors the master
    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      if (roleRef.current !== 'viewer') return;
      const p = payload as {
        index: number;
        fontScale: number;
        showChords: boolean;
        scrollFraction: number;
      };
      setIndex(p.index);
      setFontScale(p.fontScale);
      setShowChords(p.showChords);
      const el = scrollRef.current;
      if (el) {
        const max = el.scrollHeight - el.clientHeight;
        if (max > 0) el.scrollTop = p.scrollFraction * max;
      }
    });

    channel.on('broadcast', { event: 'lead_request' }, ({ payload }) => {
      if (roleRef.current !== 'master') return;
      const { fromUserId, fromEmail } = payload as {
        fromUserId: string;
        fromEmail: string;
      };
      if (fromUserId === currentUserId) return;
      setIncomingRequest({
        userId: fromUserId,
        email: fromEmail,
        expiresAt: Date.now() + 20_000,
      });
    });

    channel.on('broadcast', { event: 'lead_grant' }, ({ payload }) => {
      const { toUserId } = payload as { toUserId: string };
      if (toUserId !== currentUserId) return;
      if (roleRef.current !== 'viewer') return;
      setPendingRequest(null);
      channel.track({
        role: 'master',
        email: currentUserEmail,
        joinedAt: Date.now(),
      });
      setRole('master');
    });

    channel.on('broadcast', { event: 'lead_deny' }, ({ payload }) => {
      const { toUserId } = payload as { toUserId: string };
      if (toUserId !== currentUserId) return;
      setPendingRequest(null);
    });

    channel.on('presence', { event: 'sync' }, () => {
      const st = channel.presenceState() as Record<
        string,
        { role?: string; email?: string; joinedAt?: number }[]
      >;
      let masterEntry: { userId: string; email: string } | null = null;
      let masterJoinedAt = Number.POSITIVE_INFINITY;
      for (const [userId, metas] of Object.entries(st)) {
        const m = metas.find((x) => x.role === 'master');
        if (!m) continue;
        const joined = m.joinedAt ?? 0;
        if (joined < masterJoinedAt) {
          masterEntry = { userId, email: m.email ?? userId };
          masterJoinedAt = joined;
        }
      }
      if (masterEntry && masterEntry.userId !== currentUserId) {
        setActiveMasterEmail(masterEntry.email);
        dbHasOtherLiveMasterRef.current = false;
        if (promoteTimerRef.current) {
          clearTimeout(promoteTimerRef.current);
          promoteTimerRef.current = null;
        }
        if (roleRef.current !== 'viewer') setRole('viewer');
      } else if (masterEntry && masterEntry.userId === currentUserId) {
        setActiveMasterEmail(currentUserEmail);
        if (roleRef.current !== 'master') setRole('master');
      } else {
        setActiveMasterEmail(null);
        // No master visible in presence. Don't rush — the previous master may
        // just be reconnecting. Only promote after a grace period, and never
        // when the DB heartbeat says someone else was master in the last 45s.
        if (roleRef.current !== 'connecting') return;
        if (!canBeMaster) {
          setRole('viewer');
          return;
        }
        if (dbHasOtherLiveMasterRef.current) {
          setRole('viewer');
          return;
        }
        if (promoteTimerRef.current) return;
        promoteTimerRef.current = setTimeout(() => {
          promoteTimerRef.current = null;
          if (roleRef.current !== 'connecting') return;
          const stillNoMaster = Object.values(
            channel.presenceState() as Record<string, { role?: string }[]>
          ).every((metas) => !metas.some((m) => m.role === 'master'));
          if (!stillNoMaster) return;
          if (dbHasOtherLiveMasterRef.current) {
            setRole('viewer');
            return;
          }
          channel.track({
            role: 'master',
            email: currentUserEmail,
            joinedAt: Date.now(),
          });
          setRole('master');
        }, 2500);
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          role: 'viewer',
          email: currentUserEmail,
          joinedAt: Date.now(),
        });
        // Ask the current master (if any) to send us current state so a new
        // viewer catches up instead of showing song 1 by default.
        channel.send({ type: 'broadcast', event: 'request_state', payload: {} });
      }
    });

    channelRef.current = channel;
    return () => {
      if (promoteTimerRef.current) {
        clearTimeout(promoteTimerRef.current);
        promoteTimerRef.current = null;
      }
      channel.untrack();
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  useEffect(() => {
    if (roleRef.current !== 'master') return;
    const ch = channelRef.current;
    if (!ch) return;
    scrollFractionRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    ch.send({
      type: 'broadcast',
      event: 'state',
      payload: { index, transposeOverride, fontScale, showChords, scrollFraction: 0 },
    });
  }, [index, transposeOverride, fontScale, showChords]);

  function onContentScroll() {
    if (roleRef.current !== 'master') return;
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const frac = max > 0 ? el.scrollTop / max : 0;
    scrollFractionRef.current = frac;
    if (scrollThrottleRef.current) return;
    scrollThrottleRef.current = setTimeout(() => {
      scrollThrottleRef.current = null;
      const ch = channelRef.current;
      if (!ch) return;
      ch.send({
        type: 'broadcast',
        event: 'state',
        payload: {
          index,
          transposeOverride,
          fontScale,
          showChords,
          scrollFraction: scrollFractionRef.current,
        },
      });
    }, 60);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing) return;
      if (roleRef.current !== 'master') return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      const nav = ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', '+', '=', '-', '_', '0'];
      if (!nav.includes(e.key)) return;
      e.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body) active.blur();
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setIndex((i) => Math.min(slidesLocal.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === '+' || e.key === '=') {
        bumpTranspose(1);
      } else if (e.key === '-' || e.key === '_') {
        bumpTranspose(-1);
      } else if (e.key === '0') {
        resetTranspose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slidesLocal.length, index, editing]);

  const isMaster = role === 'master';
  const isViewer = role === 'viewer';

  const canPrev = index > 0 && isMaster;
  const canNext = index < slidesLocal.length - 1 && isMaster;
  const goPrev = () => {
    if (!isMaster) return;
    if (canPrev) setIndex((i) => Math.max(0, i - 1));
  };
  const goNext = () => {
    if (!isMaster) return;
    if (canNext) setIndex((i) => Math.min(slidesLocal.length - 1, i + 1));
  };

  function broadcastMetronome(update: MetronomeUpdate) {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: 'broadcast', event: 'metronome_update', payload: update });
  }

  function toggleMetronome() {
    if (!isMaster) return;
    if (metronomeRunning) {
      setMetronomeRunning(false);
      broadcastMetronome({
        running: false,
        bpm: metronomeBpm,
        startAt: metronomeStartAt,
        beatsPerBar: metronomeBeatsPerBar,
      });
    } else {
      const startAt = Date.now() + 200;
      setMetronomeRunning(true);
      setMetronomeStartAt(startAt);
      broadcastMetronome({
        running: true,
        bpm: metronomeBpm,
        startAt,
        beatsPerBar: metronomeBeatsPerBar,
      });
    }
  }

  function bumpBpm(delta: number) {
    if (!isMaster) return;
    const nextBpm = Math.max(30, Math.min(240, metronomeBpm + delta));
    setMetronomeBpm(nextBpm);
    if (metronomeRunning) {
      const startAt = Date.now() + 100;
      setMetronomeStartAt(startAt);
      broadcastMetronome({
        running: true,
        bpm: nextBpm,
        startAt,
        beatsPerBar: metronomeBeatsPerBar,
      });
    } else {
      broadcastMetronome({
        running: false,
        bpm: nextBpm,
        startAt: metronomeStartAt,
        beatsPerBar: metronomeBeatsPerBar,
      });
    }
  }

  function requestLead() {
    if (!canBeMaster) return;
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({
      type: 'broadcast',
      event: 'lead_request',
      payload: { fromUserId: currentUserId, fromEmail: currentUserEmail },
    });
    setPendingRequest({ expiresAt: Date.now() + 20_000 });
  }

  function takeControlDirect() {
    if (!canBeMaster) return;
    const ch = channelRef.current;
    if (!ch) return;
    ch.track({ role: 'master', email: currentUserEmail, joinedAt: Date.now() });
    setRole('master');
  }

  function grantLead() {
    const ch = channelRef.current;
    if (!ch || !incomingRequest) return;
    ch.send({
      type: 'broadcast',
      event: 'lead_grant',
      payload: { toUserId: incomingRequest.userId },
    });
    // demote self
    ch.track({ role: 'viewer', email: currentUserEmail, joinedAt: Date.now() });
    setRole('viewer');
    setActiveMasterEmail(incomingRequest.email);
    setIncomingRequest(null);
  }

  function denyLead() {
    const ch = channelRef.current;
    if (!ch || !incomingRequest) return;
    ch.send({
      type: 'broadcast',
      event: 'lead_deny',
      payload: { toUserId: incomingRequest.userId },
    });
    setIncomingRequest(null);
  }

  const secondsLeftPending = pendingRequest
    ? Math.max(0, Math.ceil((pendingRequest.expiresAt - nowTick) / 1000))
    : 0;
  const secondsLeftIncoming = incomingRequest
    ? Math.max(0, Math.ceil((incomingRequest.expiresAt - nowTick) / 1000))
    : 0;

  const filteredSongs = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return availableSongs;
    return availableSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.artist ?? '').toLowerCase().includes(q)
    );
  }, [availableSongs, pickerQuery]);

  const slide = currentSlide;
  const song = useMemo(() => (slide ? parseOnSong(slide.body) : null), [slide]);
  const totalSemitones = slide?.transpose ?? 0;

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
    <main className="h-dvh flex flex-col">
      <div
        className="border-b border-border bg-panel p-3 flex flex-wrap gap-3 items-center"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        }}
        data-viewer={isViewer ? '1' : undefined}
      >
        <Link
          href={`/churches/${slug}/sets/${setId}`}
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← {setName}
        </Link>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent text-lg leading-none flex items-center justify-center"
          aria-label={sidebarOpen ? 'Nascondi scaletta' : 'Mostra scaletta'}
          title={sidebarOpen ? 'Nascondi scaletta' : 'Mostra scaletta'}
        >
          ☰
        </button>

        <div
          className={`flex flex-wrap gap-3 items-center flex-1 ${isViewer ? 'opacity-60 pointer-events-none select-none' : ''}`}
        >

        <div className="flex items-center gap-1">
          <button
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent disabled:opacity-30 text-lg leading-none flex items-center justify-center"
          >
            ◀
          </button>
          <span className="text-sm text-zinc-400 px-2 min-w-[3.5rem] text-center font-mono">
            {index + 1} / {slidesLocal.length}
          </span>
          <button
            disabled={index === slidesLocal.length - 1}
            onClick={() => setIndex((i) => Math.min(slidesLocal.length - 1, i + 1))}
            className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent disabled:opacity-30 text-lg leading-none flex items-center justify-center"
          >
            ▶
          </button>
        </div>

        <div className="flex items-center gap-1" title="Trasposizione">
          <button
            onClick={() => bumpTranspose(-1)}
            className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent text-xl leading-none flex items-center justify-center"
            title="Abbassa di un semitono"
          >
            ♭
          </button>
          <span className="text-sm h-9 px-2 rounded bg-bg border border-border min-w-[3rem] text-center font-mono flex items-center justify-center">
            {totalSemitones >= 0 ? '+' : ''}
            {totalSemitones}
          </span>
          <button
            onClick={() => bumpTranspose(1)}
            className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent text-xl leading-none flex items-center justify-center"
            title="Alza di un semitono"
          >
            ♯
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setFontScale((f) => Math.max(0.6, f - 0.1))}
            className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent text-sm flex items-center justify-center"
            title="Diminuisci carattere"
          >
            A−
          </button>
          <button
            onClick={() => setFontScale((f) => Math.min(3, f + 0.1))}
            className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent text-sm flex items-center justify-center"
            title="Ingrandisci carattere"
          >
            A+
          </button>
        </div>

        {slide.availableVariations.length > 0 && (
          <select
            value={slide.variationId ?? ''}
            onChange={async (e) => {
              const val = e.target.value || null;
              setSlidesLocal((prev) => {
                const next = prev.slice();
                const s = next[index];
                const newBody = val
                  ? s.variationBodies[val] ?? s.body
                  : s.baseBody || s.body;
                next[index] = { ...s, variationId: val, body: newBody };
                return next;
              });
              await updateSetItem(slide.itemId, { variation_id: val });
              const ch = channelRef.current;
              if (ch) {
                const newBody = val
                  ? slide.variationBodies[val] ?? slide.body
                  : slide.baseBody || slide.body;
                ch.send({
                  type: 'broadcast',
                  event: 'slide_update',
                  payload: { itemId: slide.itemId, body: newBody },
                });
              }
              router.refresh();
            }}
            className="h-9 rounded border border-border bg-bg text-sm px-2 max-w-[10rem]"
            title="Variante usata"
          >
            <option value="">Base</option>
            {slide.availableVariations.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.scope === 'band' && v.bandName ? ` (${v.bandName})` : ''}
                {v.scope === 'user' ? ' (personale)' : ''}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => setShowChords((v) => !v)}
          className={`min-w-[2.25rem] h-9 rounded border text-xl leading-none flex items-center justify-center ${
            showChords
              ? 'border-accent text-accent'
              : 'border-border text-zinc-500 hover:border-accent'
          }`}
          title={showChords ? 'Nascondi accordi' : 'Mostra accordi'}
          aria-pressed={showChords}
        >
          ♪
        </button>

        <div className="flex items-center gap-1" title="Metronomo">
          <button
            onClick={() => bumpBpm(-1)}
            className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent text-sm flex items-center justify-center"
            title="BPM -1"
          >
            −
          </button>
          <button
            onClick={toggleMetronome}
            className={`h-9 px-2 rounded border text-sm font-mono flex items-center justify-center min-w-[5rem] ${
              metronomeRunning
                ? 'border-accent text-accent'
                : 'border-border text-zinc-300 hover:border-accent'
            }`}
            title={metronomeRunning ? 'Ferma metronomo' : 'Avvia metronomo'}
            aria-pressed={metronomeRunning}
          >
            {metronomeRunning ? '■' : '▶'} {metronomeBpm}
          </button>
          <button
            onClick={() => bumpBpm(1)}
            className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent text-sm flex items-center justify-center"
            title="BPM +1"
          >
            +
          </button>
        </div>

        <span className="flex-1" />

        <button
          onClick={() => {
            setPickerQuery('');
            setPickerOpen(true);
          }}
          className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent text-xl leading-none flex items-center justify-center"
          title="Aggiungi canzone al set"
        >
          +
        </button>

        <button
          onClick={() => {
            setEditBody(slide.body);
            setEditError(null);
            setEditing(true);
          }}
          className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent text-lg leading-none flex items-center justify-center"
          title="Modifica testo canzone"
        >
          ✎
        </button>

        </div>

        <button
          type="button"
          onClick={() => setEmitMetronome((v) => !v)}
          className={`h-9 px-2 rounded border text-lg leading-none flex items-center justify-center ${
            emitMetronome
              ? 'border-accent text-accent'
              : 'border-border text-zinc-500 hover:border-accent'
          }`}
          title={
            emitMetronome
              ? 'Emetti metronomo qui: acceso'
              : 'Emetti metronomo qui: spento (attivare sul dispositivo collegato al mixer)'
          }
          aria-pressed={emitMetronome}
        >
          {emitMetronome ? '🔊' : '🔈'}
        </button>

        <a
          href={projectorUrl}
          target="_blank"
          rel="noreferrer"
          className="min-w-[2.25rem] h-9 rounded border border-accent text-accent hover:bg-accent/10 text-lg leading-none flex items-center justify-center"
          title="Apri proiettore in nuova finestra"
        >
          ⧉
        </a>
      </div>

      {isViewer && (
        <div className="border-b border-yellow-600/50 bg-yellow-950/40 text-yellow-200 text-sm px-4 py-2 flex items-center gap-3 flex-wrap">
          <span>👁</span>
          <span>
            Sei in modalità viewer.
            {activeMasterEmail ? (
              <>
                {' '}
                Master attivo:{' '}
                <span className="font-medium">{activeMasterEmail}</span>.
              </>
            ) : (
              ' Nessun master connesso.'
            )}
          </span>
          <span className="flex-1" />
          {!canBeMaster ? (
            <span className="text-xs text-yellow-100/70">
              Solo lettura — non hai i permessi per dirigere.
            </span>
          ) : pendingRequest ? (
            <span className="text-xs text-yellow-100">
              Richiesta inviata… ({secondsLeftPending}s)
            </span>
          ) : activeMasterEmail ? (
            <button
              type="button"
              onClick={requestLead}
              className="px-3 py-1 rounded border border-yellow-400 text-yellow-100 hover:bg-yellow-500/10 text-xs"
            >
              Richiedi controllo
            </button>
          ) : (
            <button
              type="button"
              onClick={takeControlDirect}
              className="px-3 py-1 rounded border border-yellow-400 text-yellow-100 hover:bg-yellow-500/10 text-xs"
            >
              Prendi il controllo
            </button>
          )}
        </div>
      )}
      {role === 'connecting' && (
        <div className="border-b border-border bg-panel/60 text-zinc-400 text-sm px-4 py-2">
          Connessione…
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <aside className="w-56 border-r border-border bg-panel/50 overflow-auto flex-shrink-0">
            <ol className="p-2 text-sm">
              {slidesLocal.map((s, i) => (
                <li key={s.itemId}>
                  <button
                    onClick={() => setIndex(i)}
                    className={`w-full text-left px-2 py-2 rounded flex items-baseline gap-2 hover:bg-bg ${
                      i === index ? 'bg-bg border-l-2 border-accent' : ''
                    }`}
                  >
                    <span className="text-xs text-zinc-500 min-w-[1.5rem]">
                      {i + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`truncate ${
                          i === index ? 'text-white' : 'text-zinc-300'
                        }`}
                      >
                        {s.title}
                      </div>
                      {s.artist && (
                        <div className="text-xs text-zinc-500 truncate">
                          {s.artist}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        )}

        <div className="flex-1 relative group">
          <div
            ref={scrollRef}
            onScroll={onContentScroll}
            className="absolute inset-0 overflow-auto"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('a, button, input, select, textarea')) return;
              const sel = window.getSelection();
              if (sel && sel.toString().length > 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const zone = Math.min(rect.width * 0.22, 160);
              if (x < zone) goPrev();
              else if (x > rect.width - zone) goNext();
            }}
          >
            <div className="max-w-3xl mx-auto w-full p-8 px-16 md:px-20">
              {song && (
                <SongView
                  song={song}
                  semitones={totalSemitones}
                  fontScale={fontScale}
                  showChords={showChords}
                />
              )}
            </div>
          </div>

          <div
            aria-hidden
            className={`pointer-events-none absolute left-0 top-0 bottom-0 flex items-center justify-start pl-3 md:pl-6 text-4xl md:text-5xl text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity ${canPrev ? '' : 'invisible'}`}
            style={{ width: 'min(22%, 160px)' }}
          >
            ‹
          </div>
          <div
            aria-hidden
            className={`pointer-events-none absolute right-0 top-0 bottom-0 flex items-center justify-end pr-3 md:pr-6 text-4xl md:text-5xl text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity ${canNext ? '' : 'invisible'}`}
            style={{ width: 'min(22%, 160px)' }}
          >
            ›
          </div>
        </div>
      </div>

      {incomingRequest && (
        <div
          role="alertdialog"
          aria-labelledby="lead-req-title"
          className="fixed bottom-4 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] bg-panel/95 backdrop-blur border border-accent/60 rounded-lg shadow-lg p-3 space-y-2"
          style={{
            bottom: 'max(1rem, env(safe-area-inset-bottom))',
            right: 'max(1rem, env(safe-area-inset-right))',
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <div id="lead-req-title" className="text-sm font-semibold">
              Richiesta di controllo
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              {secondsLeftIncoming}s
            </div>
          </div>
          <p className="text-xs text-zinc-300 leading-snug">
            <span className="font-medium">{incomingRequest.email}</span> chiede
            di prendere il controllo del set.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={denyLead}
              className="px-2.5 py-1 rounded border border-border hover:border-accent text-xs"
            >
              Nega
            </button>
            <button
              onClick={grantLead}
              className="px-2.5 py-1 rounded bg-accent text-black text-xs font-medium"
            >
              Autorizza
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => !saving && setEditing(false)}
        >
          <div
            className="bg-panel border border-border rounded-lg w-full max-w-4xl h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-border flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{slide.title}</div>
                <div className="text-xs text-zinc-500">
                  {slide.variationId ? 'Modifica variante' : 'Nuova versione della canzone'}
                </div>
              </div>
              <button
                onClick={() => !saving && setEditing(false)}
                className="text-zinc-400 hover:text-white text-xl leading-none px-2"
                aria-label="Chiudi"
              >
                ×
              </button>
            </div>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="flex-1 w-full p-4 bg-bg text-sm font-mono resize-none focus:outline-none"
              spellCheck={false}
            />
            {editError && (
              <div className="px-4 py-2 text-sm text-red-400 border-t border-border">
                {editError}
              </div>
            )}
            <div className="p-3 border-t border-border flex items-center gap-2 justify-end">
              <button
                onClick={() => !saving && setEditing(false)}
                disabled={saving}
                className="px-3 py-1.5 rounded border border-border hover:border-accent text-sm disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  setEditError(null);
                  startSave(async () => {
                    const res = await saveSlideEdit(
                      slug,
                      slide.songId,
                      slide.variationId,
                      editBody
                    );
                    if (res.error) {
                      setEditError(res.error);
                      return;
                    }
                    setSlidesLocal((prev) => {
                      const next = prev.slice();
                      next[index] = { ...next[index], body: editBody };
                      return next;
                    });
                    const ch = channelRef.current;
                    if (ch) {
                      ch.send({
                        type: 'broadcast',
                        event: 'slide_update',
                        payload: { itemId: slide.itemId, body: editBody },
                      });
                    }
                    setEditing(false);
                    router.refresh();
                  });
                }}
                disabled={saving || !editBody.trim()}
                className="px-3 py-1.5 rounded bg-accent text-black text-sm disabled:opacity-50"
              >
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => !addingSongId && setPickerOpen(false)}
        >
          <div
            className="bg-panel border border-border rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-border flex items-center gap-2">
              <input
                autoFocus
                placeholder="Cerca canzone…"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
              />
              <button
                onClick={() => !addingSongId && setPickerOpen(false)}
                className="text-zinc-400 hover:text-white text-xl leading-none px-2"
                aria-label="Chiudi"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-border">
              {filteredSongs.length === 0 ? (
                <div className="p-6 text-center text-sm text-zinc-500">
                  Nessun risultato.
                </div>
              ) : (
                filteredSongs.map((s) => (
                  <button
                    key={s.id}
                    disabled={!!addingSongId}
                    onClick={async () => {
                      setAddingSongId(s.id);
                      const res = await addSongToSet(setId, s.id);
                      setAddingSongId(null);
                      if (res?.error) {
                        alert(res.error);
                        return;
                      }
                      setPickerOpen(false);
                      setPickerQuery('');
                      router.refresh();
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-bg flex items-center justify-between disabled:opacity-50"
                  >
                    <div>
                      <div className="text-sm">{s.title}</div>
                      {s.artist && (
                        <div className="text-xs text-zinc-500">{s.artist}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.original_key && (
                        <span className="text-xs text-zinc-400 px-2 py-0.5 rounded bg-bg border border-border">
                          {s.original_key}
                        </span>
                      )}
                      {addingSongId === s.id && (
                        <span className="text-xs text-accent">…</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
