'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseOnSong, SongView } from '@/lib/onsong';
import { useFitToWidth } from '@/lib/onsong/useFitToWidth';
import { createClient } from '@/lib/supabase/client';
import { saveSlideEdit } from '@/lib/songs/actions';
import {
  addSongToSet,
  heartbeatSetMaster,
  releaseSetMaster,
  reorderSetItems,
  updateSetItem,
} from '@/lib/sets/actions';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  applyOrder,
  resolveIncomingIndex,
  type ProjectionState,
} from '@/lib/sets/projection';
import { Metronome, type MetronomeUpdate } from '@/lib/metronome/scheduler';
import { metronomePattern } from '@/lib/metronome/time-signature';
import { exportElementToPdf } from '@/lib/pdf/export';
import type { RealtimeChannel } from '@supabase/supabase-js';

const EMIT_METRONOME_KEY = 'songstage:emit-metronome';
const CHORD_COLOR_KEY = 'songstage:chord-color';
const SECTION_COLOR_KEY = 'songstage:section-color';
/**
 * Text size belongs to the screen, not to the set: a phone, a laptop at the
 * keyboard and a projector all want different sizes, and the person holding
 * each one is the only one who can judge. So it persists per device and a
 * leader's size is no longer pushed onto the people following.
 */
const FONT_SCALE_KEY = 'songstage:font-scale';
/**
 * What the congregation's screen gets. Separate from this device's own size:
 * the projector has no controls of its own, so the leader sizes it from here,
 * and a leader squinting at a phone must not shrink the wall.
 */
const PROJECTOR_FONT_SCALE_KEY = 'songstage:projector-font-scale';
const FIT_WIDTH_KEY = 'songstage:fit-width';
/** Whether to show chords is a property of who is reading this screen. */
const SHOW_CHORDS_KEY = 'songstage:show-chords';
const DEFAULT_CHORD_COLOR = '#4ade80';
const DEFAULT_SECTION_COLOR = '#fbbf24';


export type SlideVariation = {
  id: string;
  name: string;
  scope: 'church' | 'band' | 'user';
  bandName: string | null;
};

export type { ProjectionState };

export type Slide = {
  itemId: string;
  songId: string;
  variationId: string | null;
  title: string;
  artist: string | null;
  originalKey: string | null;
  songTempo: number | null;
  songTimeSignature: string | null;
  /** Canonical songs are shared across churches: key/transpose is per-set and
   *  editable, the lyrics and chords are not. */
  isCanonical: boolean;
  transpose: number;
  body: string;
  baseBody: string;
  availableVariations: SlideVariation[];
  variationBodies: Record<string, string>;
};

export type AvailableSong = {
  id: string;
  title: string;
  artist: string | null;
  original_key: string | null;
  isCanonical: boolean;
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
  const [projectorFontScale, setProjectorFontScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(false);
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
  // Absolute transpose pushed by the leader; null until the first state frame.
  const [followerTranspose, setFollowerTranspose] = useState<number | null>(null);
  // The song the leader last reported, so a refreshed slide list can catch up
  // to a song that wasn't in ours when the frame arrived.
  const [followerItemId, setFollowerItemId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
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
  const [metronomeSubdivisions, setMetronomeSubdivisions] = useState(1);
  const [metronomeStrongEvery, setMetronomeStrongEvery] = useState(4);
  const [emitMetronome, setEmitMetronome] = useState(false);
  const [chordColor, setChordColor] = useState(DEFAULT_CHORD_COLOR);
  const [sectionColor, setSectionColor] = useState(DEFAULT_SECTION_COLOR);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
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
  // The broadcast handlers are installed once, so they read the slide list
  // through a ref instead of a stale closure.
  const slidesLocalRef = useRef(slidesLocal);
  useEffect(() => {
    slidesLocalRef.current = slidesLocal;
  }, [slidesLocal]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const scrollFractionRef = useRef(0);
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => setSlidesLocal(slides), [slides]);

  const currentSlide = slidesLocal[index];

  // A refresh may have just brought in the song the leader moved to.
  useEffect(() => {
    if (roleRef.current !== 'viewer' || !followerItemId) return;
    const found = slidesLocal.findIndex((s) => s.itemId === followerItemId);
    if (found !== -1 && found !== index) setIndex(found);
  }, [slidesLocal, followerItemId, index]);
  const currentTranspose = currentSlide?.transpose ?? 0;

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

  const stateRef = useRef({
    itemId: currentSlide?.itemId ?? null,
    index,
    transpose: currentTranspose,
    fontScale: projectorFontScale,
    showChords,
  });
  useEffect(() => {
    stateRef.current = {
      itemId: currentSlide?.itemId ?? null,
      index,
      transpose: currentTranspose,
      fontScale: projectorFontScale,
      showChords,
    };
  }, [currentSlide, index, currentTranspose, projectorFontScale, showChords]);

  const metronomeStateRef = useRef<MetronomeUpdate>({
    running: metronomeRunning,
    bpm: metronomeBpm,
    startAt: metronomeStartAt,
    beatsPerBar: metronomeBeatsPerBar,
    subdivisionsPerBeat: metronomeSubdivisions,
    strongEvery: metronomeStrongEvery,
  });
  useEffect(() => {
    metronomeStateRef.current = {
      running: metronomeRunning,
      bpm: metronomeBpm,
      startAt: metronomeStartAt,
      beatsPerBar: metronomeBeatsPerBar,
      subdivisionsPerBeat: metronomeSubdivisions,
      strongEvery: metronomeStrongEvery,
    };
  }, [
    metronomeRunning,
    metronomeBpm,
    metronomeStartAt,
    metronomeBeatsPerBar,
    metronomeSubdivisions,
    metronomeStrongEvery,
  ]);

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
    const pattern = metronomePattern(slide.songTimeSignature);
    const newBeats = pattern.beatsPerBar;
    const newSubs = pattern.subdivisionsPerBeat;
    const newStrong = pattern.strongEvery;
    const t = slide.songTempo;
    const tempoChanged = !!(t && t > 0 && t !== metronomeBpm);
    const beatsChanged = newBeats !== metronomeBeatsPerBar;
    const subsChanged = newSubs !== metronomeSubdivisions;
    const strongChanged = newStrong !== metronomeStrongEvery;
    if (!tempoChanged && !beatsChanged && !subsChanged && !strongChanged) return;
    const nextBpm = tempoChanged ? t! : metronomeBpm;
    if (tempoChanged) setMetronomeBpm(t!);
    if (beatsChanged) setMetronomeBeatsPerBar(newBeats);
    if (subsChanged) setMetronomeSubdivisions(newSubs);
    if (strongChanged) setMetronomeStrongEvery(newStrong);
    const ch = channelRef.current;
    if (metronomeRunning) {
      const startAt = Date.now() + 100;
      setMetronomeStartAt(startAt);
      ch?.send({
        type: 'broadcast',
        event: 'metronome_update',
        payload: {
          running: true,
          bpm: nextBpm,
          startAt,
          beatsPerBar: newBeats,
          subdivisionsPerBeat: newSubs,
          strongEvery: newStrong,
        },
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
          subdivisionsPerBeat: newSubs,
          strongEvery: newStrong,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, role, slidesLocal]);

  // Restore local color preferences
  useEffect(() => {
    try {
      const c = localStorage.getItem(CHORD_COLOR_KEY);
      const s = localStorage.getItem(SECTION_COLOR_KEY);
      if (c) setChordColor(c);
      if (s) setSectionColor(s);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CHORD_COLOR_KEY, chordColor);
      localStorage.setItem(SECTION_COLOR_KEY, sectionColor);
    } catch {}
  }, [chordColor, sectionColor]);

  // Restore this device's text size, and the projection size this device sets
  useEffect(() => {
    try {
      const mine = Number.parseFloat(localStorage.getItem(FONT_SCALE_KEY) ?? '');
      if (Number.isFinite(mine) && mine > 0) setFontScale(mine);
      const proj = Number.parseFloat(
        localStorage.getItem(PROJECTOR_FONT_SCALE_KEY) ?? ''
      );
      if (Number.isFinite(proj) && proj > 0) setProjectorFontScale(proj);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(fontScale));
    } catch {}
  }, [fontScale]);
  useEffect(() => {
    try {
      localStorage.setItem(PROJECTOR_FONT_SCALE_KEY, String(projectorFontScale));
    } catch {}
  }, [projectorFontScale]);

  // Restore this screen's reading preferences
  useEffect(() => {
    try {
      if (localStorage.getItem(FIT_WIDTH_KEY) === '1') setFitWidth(true);
      const chords = localStorage.getItem(SHOW_CHORDS_KEY);
      if (chords !== null) setShowChords(chords === '1');
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(FIT_WIDTH_KEY, fitWidth ? '1' : '0');
      localStorage.setItem(SHOW_CHORDS_KEY, showChords ? '1' : '0');
    } catch {}
  }, [fitWidth, showChords]);

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
        subdivisionsPerBeat: metronomeSubdivisions,
        strongEvery: metronomeStrongEvery,
      });
    } else {
      metronomeRef.current.stop();
    }
  }, [
    emitMetronome,
    metronomeRunning,
    metronomeBpm,
    metronomeStartAt,
    metronomeBeatsPerBar,
    metronomeSubdivisions,
    metronomeStrongEvery,
  ]);

  useEffect(() => {
    return () => {
      metronomeRef.current?.dispose();
      metronomeRef.current = null;
    };
  }, []);

  // The print tree re-parses and re-renders every slide, so it's only mounted
  // while an export is in flight — this effect runs once it's in the DOM.
  useEffect(() => {
    if (!exportingPdf) return;
    const el = printRef.current;
    if (!el) return;
    let active = true;
    (async () => {
      try {
        await exportElementToPdf(
          el,
          `${setName.replace(/[^a-z0-9]+/gi, '-') || 'scaletta'}.pdf`
        );
      } finally {
        if (active) setExportingPdf(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [exportingPdf, setName]);

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
      if (typeof p.subdivisionsPerBeat === 'number' && p.subdivisionsPerBeat >= 1)
        setMetronomeSubdivisions(p.subdivisionsPerBeat);
      if (typeof p.strongEvery === 'number' && p.strongEvery >= 1)
        setMetronomeStrongEvery(p.strongEvery);
    });

    // viewer applies incoming state so its UI mirrors the master
    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      if (roleRef.current !== 'viewer') return;
      const p = payload as ProjectionState;
      setFollowerItemId(p.itemId ?? null);
      const next = resolveIncomingIndex(p, slidesLocalRef.current, stateRef.current.index);
      if (next === -1) {
        // The leader added a song we don't have. Pull the new set and stay put
        // meanwhile; the next state frame lands us on the right slide.
        router.refresh();
      } else {
        setIndex(next);
      }
      // p.fontScale and p.showChords are deliberately ignored: how this screen
      // is read belongs to whoever is reading it. The unattended projector
      // still follows the leader, since nobody is standing at it.
      if (typeof p.transpose === 'number') setFollowerTranspose(p.transpose);
      const el = scrollRef.current;
      if (el) {
        const max = el.scrollHeight - el.clientHeight;
        if (max > 0) el.scrollTop = p.scrollFraction * max;
      }
    });

    // The leader edited the lyrics or switched variation in place. The
    // projector listens for this too; viewers on this page need it as well or
    // they keep reading the version they loaded with.
    channel.on('broadcast', { event: 'slide_update' }, ({ payload }) => {
      if (roleRef.current === 'master') return;
      const { itemId, body } = payload as { itemId: string; body: string };
      setSlidesLocal((prev) =>
        prev.map((s) => (s.itemId === itemId ? { ...s, body } : s))
      );
    });

    // The leader reordered the set mid-service. Followers re-sort in place:
    // a refetch would be slower and could blank the screen mid-song.
    channel.on('broadcast', { event: 'set_order' }, ({ payload }) => {
      if (roleRef.current === 'master') return;
      const { itemIds } = payload as { itemIds: string[] };
      setSlidesLocal((prev) => applyOrder(prev, itemIds));
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
      setFollowerTranspose(null);
      setRole('master');
      // Re-read the set so our own transposes start from what's stored, not
      // from whatever the previous leader had broadcast.
      router.refresh();
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

  // Moving to another song starts it from the top.
  useEffect(() => {
    if (roleRef.current !== 'master') return;
    const ch = channelRef.current;
    if (!ch) return;
    scrollFractionRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    ch.send({
      type: 'broadcast',
      event: 'state',
      payload: {
        itemId: slidesLocal[index]?.itemId ?? null,
        index,
        transpose: currentTranspose,
        fontScale: projectorFontScale,
        showChords,
        scrollFraction: 0,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Transpose, font size and chord visibility are adjusted mid-song: push them
  // out without moving anyone's scroll position.
  useEffect(() => {
    if (roleRef.current !== 'master') return;
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({
      type: 'broadcast',
      event: 'state',
      payload: {
        itemId: slidesLocal[index]?.itemId ?? null,
        index,
        transpose: currentTranspose,
        fontScale: projectorFontScale,
        showChords,
        scrollFraction: scrollFractionRef.current,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTranspose, projectorFontScale, showChords]);

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
          itemId: slidesLocal[index]?.itemId ?? null,
          index,
          transpose: currentTranspose,
          fontScale: projectorFontScale,
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

  const fitRef = useFitToWidth({
    enabled: fitWidth,
    currentScale: fontScale,
    onFit: setFontScale,
    // Re-measure per song: the longest line is what sets the size, and it
    // changes from one song to the next.
    deps: currentSlide?.itemId,
  });

  const sortSensors = useSensors(
    // A small movement is enough to mean "drag" with a mouse.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch is different: the list scrolls, and a finger that starts on the
    // handle is usually trying to scroll past it. Waiting for a short hold
    // tells the two apart, and gives the press somewhere to register.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function onSidebarDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = slidesLocal.findIndex((s) => s.itemId === active.id);
    const to = slidesLocal.findIndex((s) => s.itemId === over.id);
    if (from === -1 || to === -1) return;

    const previous = slidesLocal;
    const next = arrayMove(slidesLocal, from, to);
    const currentItemId = slidesLocal[index]?.itemId;

    setSlidesLocal(next);
    // Stay on whatever song is playing, wherever it landed.
    const stillAt = next.findIndex((s) => s.itemId === currentItemId);
    if (stillAt !== -1) setIndex(stillAt);

    const itemIds = next.map((s) => s.itemId);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'set_order',
      payload: { itemIds },
    });
    // Re-anchor everyone on the current song right after the shuffle: a viewer
    // that has never received a state frame is still sitting on index 0, which
    // is now a different song.
    channelRef.current?.send({
      type: 'broadcast',
      event: 'state',
      payload: {
        itemId: currentItemId ?? null,
        index: stillAt !== -1 ? stillAt : index,
        transpose: currentTranspose,
        fontScale: projectorFontScale,
        showChords,
        scrollFraction: scrollFractionRef.current,
      },
    });

    const { error } = await reorderSetItems(setId, itemIds);
    if (error) {
      setSlidesLocal(previous);
      const back = previous.findIndex((s) => s.itemId === currentItemId);
      if (back !== -1) setIndex(back);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'set_order',
        payload: { itemIds: previous.map((s) => s.itemId) },
      });
      setReorderError(error);
    }
  }
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
        subdivisionsPerBeat: metronomeSubdivisions,
        strongEvery: metronomeStrongEvery,
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
        subdivisionsPerBeat: metronomeSubdivisions,
        strongEvery: metronomeStrongEvery,
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
        subdivisionsPerBeat: metronomeSubdivisions,
        strongEvery: metronomeStrongEvery,
      });
    } else {
      broadcastMetronome({
        running: false,
        bpm: nextBpm,
        startAt: metronomeStartAt,
        beatsPerBar: metronomeBeatsPerBar,
        subdivisionsPerBeat: metronomeSubdivisions,
        strongEvery: metronomeStrongEvery,
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
    setFollowerTranspose(null);
    setRole('master');
    router.refresh();
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
  const totalSemitones =
    isViewer && followerTranspose !== null ? followerTranspose : slide?.transpose ?? 0;

  const projectorUrl = `/churches/${slug}/sets/${setId}/projector`;

  if (!slide) {
    return (
      <main className="min-h-screen px-4 py-6 sm:p-8 max-w-2xl mx-auto">
        <p className="text-zinc-400">Questo set non ha canzoni.</p>
        <Link href={`/churches/${slug}/sets/${setId}`} className="text-accent">
          ← Torna al set
        </Link>
      </main>
    );
  }

  return (
    <main
      className="h-dvh flex flex-col"
      style={
        {
          '--chord-color': chordColor,
          '--section-color': sectionColor,
        } as React.CSSProperties
      }
    >
      {/* On a phone this bar wrapped into eight stacked rows and ate most of
          the screen. One row that scrolls sideways keeps every control
          reachable and gives the song back its space. */}
      <div
        data-no-print
        className="border-b border-border bg-panel p-3 flex gap-3 items-center max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[&>*]:shrink-0 sm:flex-wrap"
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
          className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-lg leading-none flex items-center justify-center"
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
            className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent disabled:opacity-30 text-lg leading-none flex items-center justify-center"
          >
            ◀
          </button>
          <span className="text-sm text-zinc-400 px-2 min-w-[3.5rem] text-center font-mono">
            {index + 1} / {slidesLocal.length}
          </span>
          <button
            disabled={index === slidesLocal.length - 1}
            onClick={() => setIndex((i) => Math.min(slidesLocal.length - 1, i + 1))}
            className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent disabled:opacity-30 text-lg leading-none flex items-center justify-center"
          >
            ▶
          </button>
        </div>

        <div className="flex items-center gap-1" title="Trasposizione">
          <button
            onClick={() => bumpTranspose(-1)}
            className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-xl leading-none flex items-center justify-center"
            title="Abbassa di un semitono"
          >
            ♭
          </button>
          <span className="text-sm h-9 px-2 rounded-full bg-bg border border-border min-w-[3rem] text-center font-mono flex items-center justify-center">
            {totalSemitones >= 0 ? '+' : ''}
            {totalSemitones}
          </span>
          <button
            onClick={() => bumpTranspose(1)}
            className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-xl leading-none flex items-center justify-center"
            title="Alza di un semitono"
          >
            ♯
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              // An explicit choice of size wins over the automatic one.
              setFitWidth(false);
              setFontScale((f) => Math.max(0.6, f - 0.1));
            }}
            className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center"
            title="Diminuisci carattere su questo schermo"
          >
            A−
          </button>
          <button
            onClick={() => {
              setFitWidth(false);
              setFontScale((f) => Math.min(3, f + 0.1));
            }}
            className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center"
            title="Ingrandisci carattere su questo schermo"
          >
            A+
          </button>
          <button
            onClick={() => setFitWidth((v) => !v)}
            aria-pressed={fitWidth}
            className={`min-w-[2.25rem] h-9 rounded-full border text-sm flex items-center justify-center ${
              fitWidth
                ? 'border-accent text-accent'
                : 'border-border hover:border-accent text-zinc-400'
            }`}
            title="Adatta il testo alla larghezza dello schermo"
          >
            ⇔
          </button>
        </div>

        {isMaster && (
          <div className="flex items-center gap-1" title="Carattere sullo schermo di proiezione">
            <span className="text-xs text-zinc-500 px-1">📽</span>
            <button
              onClick={() => setProjectorFontScale((f) => Math.max(0.6, f - 0.1))}
              className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center"
              title="Rimpicciolisci la proiezione"
            >
              A−
            </button>
            <span className="text-xs h-9 px-1 min-w-[2.5rem] text-center font-mono flex items-center justify-center text-zinc-400">
              {Math.round(projectorFontScale * 100)}%
            </span>
            <button
              onClick={() => setProjectorFontScale((f) => Math.min(3, f + 0.1))}
              className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center"
              title="Ingrandisci la proiezione"
            >
              A+
            </button>
          </div>
        )}

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
          className={`min-w-[2.25rem] h-9 rounded-full border text-xl leading-none flex items-center justify-center ${
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
            className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center"
            title="BPM -1"
          >
            −
          </button>
          <button
            onClick={toggleMetronome}
            className={`h-9 px-2 rounded-full border text-sm font-mono flex items-center justify-center min-w-[5rem] ${
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
            className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center"
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
          className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-xl leading-none flex items-center justify-center"
          title="Aggiungi canzone al set"
        >
          +
        </button>

        {slide.isCanonical && !slide.variationId ? (
          <span
            className="min-w-[2.25rem] h-9 rounded-full border border-border text-lg leading-none flex items-center justify-center opacity-40 cursor-not-allowed"
            title="Canzone canonica: la tonalità si cambia qui, il testo si modifica nella libreria o adottandola per la chiesa"
            aria-disabled
          >
            ✎
          </span>
        ) : (
          <button
            onClick={() => {
              setEditBody(slide.body);
              setEditError(null);
              setEditing(true);
            }}
            className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-lg leading-none flex items-center justify-center"
            title="Modifica testo canzone"
          >
            ✎
          </button>
        )}

        </div>

        <button
          type="button"
          onClick={() => setEmitMetronome((v) => !v)}
          className={`h-9 px-2 rounded-full border text-lg leading-none flex items-center justify-center ${
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

        <div className="relative">
          <button
            type="button"
            onClick={() => setColorPickerOpen((v) => !v)}
            className="h-9 px-2 rounded-full border border-border hover:border-accent flex items-center gap-1"
            title="Colori di accordi e sezioni"
            aria-expanded={colorPickerOpen}
          >
            <span
              className="inline-block w-3 h-3 rounded-sm border border-zinc-700"
              style={{ background: chordColor }}
            />
            <span
              className="inline-block w-3 h-3 rounded-sm border border-zinc-700"
              style={{ background: sectionColor }}
            />
          </button>
          {colorPickerOpen && (
            <div className="absolute right-0 top-10 z-30 w-64 bg-panel border border-border rounded-md shadow-lg p-3 space-y-3">
              <div>
                <label className="text-xs text-zinc-400 flex items-center justify-between mb-1">
                  <span>Accordi</span>
                  <button
                    type="button"
                    onClick={() => setChordColor(DEFAULT_CHORD_COLOR)}
                    className="text-xs text-zinc-500 hover:text-white"
                  >
                    Reset
                  </button>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={chordColor}
                    onChange={(e) => setChordColor(e.target.value)}
                    className="w-9 h-9 bg-transparent border border-border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={chordColor}
                    onChange={(e) => setChordColor(e.target.value)}
                    className="flex-1 px-2 py-1 rounded bg-bg border border-border text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 flex items-center justify-between mb-1">
                  <span>Sezioni</span>
                  <button
                    type="button"
                    onClick={() => setSectionColor(DEFAULT_SECTION_COLOR)}
                    className="text-xs text-zinc-500 hover:text-white"
                  >
                    Reset
                  </button>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={sectionColor}
                    onChange={(e) => setSectionColor(e.target.value)}
                    className="w-9 h-9 bg-transparent border border-border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={sectionColor}
                    onChange={(e) => setSectionColor(e.target.value)}
                    className="flex-1 px-2 py-1 rounded bg-bg border border-border text-sm font-mono"
                  />
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                Le modifiche sono locali al tuo dispositivo e si applicano a questa vista. In stampa i colori sono fissi.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={exportingPdf}
          onClick={() => setExportingPdf(true)}
          className="h-9 px-2 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center disabled:opacity-50"
          title="Scarica la scaletta in PDF (fondo bianco, accordi rossi, sezioni verdi)"
        >
          {exportingPdf ? '…' : 'PDF'}
        </button>

        <a
          href={projectorUrl}
          target="_blank"
          rel="noreferrer"
          className="h-9 px-3 rounded-full border border-accent text-accent hover:bg-accent/10 text-sm flex items-center gap-1.5"
          title="Apri la vista proiettore in una nuova finestra per il video"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
            aria-hidden
          >
            <rect x="2" y="4" width="20" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          Proietta
        </a>
      </div>

      {isViewer && (
        <div data-no-print className="border-b border-yellow-600/50 bg-yellow-950/40 text-yellow-200 text-sm px-4 py-2 flex items-center gap-3 flex-wrap">
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
              className="px-3 py-1 rounded-full border border-yellow-400 text-yellow-100 hover:bg-yellow-500/10 text-xs"
            >
              Richiedi controllo
            </button>
          ) : (
            <button
              type="button"
              onClick={takeControlDirect}
              className="px-3 py-1 rounded-full border border-yellow-400 text-yellow-100 hover:bg-yellow-500/10 text-xs"
            >
              Prendi il controllo
            </button>
          )}
        </div>
      )}
      {role === 'connecting' && (
        <div data-no-print className="border-b border-border bg-panel/60 text-zinc-400 text-sm px-4 py-2">
          Connessione…
        </div>
      )}

      <div data-no-print className="flex-1 flex overflow-hidden relative">
        {sidebarOpen && (
          <aside className="w-56 border-r border-border bg-panel/50 overflow-auto flex-shrink-0 max-sm:absolute max-sm:inset-y-0 max-sm:left-0 max-sm:z-20 max-sm:bg-panel max-sm:shadow-2xl">
            {reorderError && (
              <div className="m-2 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
                {reorderError}
              </div>
            )}
            <DndContext
              sensors={sortSensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={onSidebarDragEnd}
            >
              <SortableContext
                items={slidesLocal.map((s) => s.itemId)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="p-2 text-sm">
                  {slidesLocal.map((s, i) => (
                    <SetlistRow
                      key={s.itemId}
                      slide={s}
                      position={i}
                      isCurrent={i === index}
                      // Only the leader reorders: a viewer dragging would
                      // desync their screen from everyone else's.
                      draggable={isMaster}
                      onSelect={() => setIndex(i)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
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
            <div
              ref={fitRef}
              className="max-w-3xl mx-auto w-full p-8 px-16 md:px-20"
            >
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
              className="px-2.5 py-1 rounded-full border border-border hover:border-accent text-xs"
            >
              Nega
            </button>
            <button
              onClick={grantLead}
              className="px-2.5 py-1 rounded-full bg-accent text-black text-xs font-medium"
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
                className="px-3 py-1.5 rounded-full border border-border hover:border-accent text-sm disabled:opacity-50"
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
                className="px-3 py-1.5 rounded-full bg-accent text-black text-sm disabled:opacity-50"
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
                      {s.isCanonical && (
                        <span
                          title="Dalla libreria canonica"
                          className="text-[10px] uppercase tracking-wide text-zinc-400 px-2 py-0.5 rounded-full bg-bg border border-border"
                        >
                          Canonica
                        </span>
                      )}
                      {s.original_key && (
                        <span className="text-xs text-zinc-400 px-2 py-0.5 rounded-full bg-bg border border-border">
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

      {exportingPdf && (
        <div ref={printRef} className="print-only" aria-hidden>
          {slidesLocal.map((s) => {
            const parsed = parseOnSong(s.body);
            return (
              <div key={s.itemId} className="print-page">
                <SongView
                  song={parsed}
                  semitones={s.transpose}
                  fontScale={1}
                  showChords
                />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function SetlistRow({
  slide,
  position,
  isCurrent,
  draggable,
  onSelect,
}: {
  slide: Slide;
  position: number;
  isCurrent: boolean;
  draggable: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.itemId,
    disabled: !draggable,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center ${isDragging ? 'dragging-row relative z-10 opacity-80' : ''}`}
    >
      {draggable && (
        <button
          {...attributes}
          {...listeners}
          // The same long press opens the context menu on Android.
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`Riordina ${slide.title}`}
          title="Trascina per riordinare"
          className="drag-handle px-2 py-2 text-zinc-600 hover:text-accent cursor-grab active:cursor-grabbing text-sm leading-none"
        >
          ⠿
        </button>
      )}
      <button
        onClick={onSelect}
        className={`flex-1 min-w-0 text-left px-2 py-2 rounded-full flex items-baseline gap-2 hover:bg-bg ${
          isCurrent ? 'bg-bg' : ''
        }`}
      >
        <span
          className={`text-xs min-w-[1.5rem] ${isCurrent ? 'text-accent' : 'text-zinc-500'}`}
        >
          {position + 1}.
        </span>
        <div className="flex-1 min-w-0">
          <div className={`truncate ${isCurrent ? 'text-white' : 'text-zinc-300'}`}>
            {slide.title}
          </div>
          {slide.artist && (
            <div className="text-xs text-zinc-500 truncate">{slide.artist}</div>
          )}
        </div>
      </button>
    </li>
  );
}
