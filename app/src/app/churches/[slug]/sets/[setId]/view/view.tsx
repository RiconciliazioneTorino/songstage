'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseOnSong, SongView } from '@/lib/onsong';
import { createClient } from '@/lib/supabase/client';
import { Metronome, type MetronomeUpdate } from '@/lib/metronome/scheduler';
import { applyOrder, resolveIncomingIndex, type ProjectionState } from '@/lib/sets/projection';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Slide } from '../master/master';
import { YoutubePlayer } from '../master/youtube-player';
import { MixerButton } from '../mixer';

const EMIT_METRONOME_KEY = 'songstage:emit-metronome';
const RECEIVE_SHARED_AUDIO_KEY = 'songstage:receive-shared-audio';
const SHOW_CHORDS_KEY = 'songstage:show-chords';
const FONT_SCALE_KEY = 'songstage:font-scale';
const METRONOME_VOLUME_KEY = 'songstage:metronome-volume';
const YT_VOLUME_KEY = 'songstage:yt-volume';

export function ViewConsole({
  slug,
  setId,
  setName,
  slides,
  canBeMaster,
  currentUserId,
  currentUserEmail,
  liveMasterIsFresh,
}: {
  slug: string;
  setId: string;
  setName: string;
  slides: Slide[];
  canBeMaster: boolean;
  currentUserId: string;
  currentUserEmail: string;
  liveMasterIsFresh: boolean;
}) {
  const router = useRouter();
  const [slidesLocal, setSlidesLocal] = useState(slides);
  const [itemId, setItemId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [emitMetronome, setEmitMetronome] = useState(false);
  const [receiveSharedAudio, setReceiveSharedAudio] = useState(false);
  const [audioClaimedElsewhere, setAudioClaimedElsewhere] = useState(false);
  const [metronomeVolume, setMetronomeVolume] = useState(60);
  const [ytVolume, setYtVolume] = useState(100);
  const [showChords, setShowChords] = useState(true);
  const [fontScale, setFontScale] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideControlsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ expiresAt: number } | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  const [mtRunning, setMtRunning] = useState(false);
  const [mtBpm, setMtBpm] = useState(90);
  const [mtStartAt, setMtStartAt] = useState(0);
  const [mtBeatsPerBar, setMtBeatsPerBar] = useState(4);
  const [mtSubdivisions, setMtSubdivisions] = useState(1);
  const [mtStrongEvery, setMtStrongEvery] = useState(4);

  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytUrl, setYtUrl] = useState<string | null>(null);
  const [ytTitle, setYtTitle] = useState<string>('');
  const [ytTime, setYtTime] = useState<number | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const metronomeRef = useRef<Metronome | null>(null);
  const slidesLocalRef = useRef(slidesLocal);
  useEffect(() => {
    slidesLocalRef.current = slidesLocal;
  }, [slidesLocal]);

  // Local prefs restore / persist.
  useEffect(() => {
    try {
      if (localStorage.getItem(EMIT_METRONOME_KEY) === '1') setEmitMetronome(true);
      if (localStorage.getItem(RECEIVE_SHARED_AUDIO_KEY) === '1')
        setReceiveSharedAudio(true);
      const chords = localStorage.getItem(SHOW_CHORDS_KEY);
      if (chords !== null) setShowChords(chords === '1');
      const fs = Number.parseFloat(localStorage.getItem(FONT_SCALE_KEY) ?? '');
      if (Number.isFinite(fs) && fs > 0) setFontScale(fs);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(EMIT_METRONOME_KEY, emitMetronome ? '1' : '0');
    } catch {}
  }, [emitMetronome]);
  useEffect(() => {
    try {
      localStorage.setItem(RECEIVE_SHARED_AUDIO_KEY, receiveSharedAudio ? '1' : '0');
    } catch {}
  }, [receiveSharedAudio]);
  useEffect(() => {
    try {
      localStorage.setItem(SHOW_CHORDS_KEY, showChords ? '1' : '0');
    } catch {}
  }, [showChords]);
  useEffect(() => {
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(fontScale));
    } catch {}
  }, [fontScale]);
  useEffect(() => {
    try {
      const mv = Number.parseFloat(localStorage.getItem(METRONOME_VOLUME_KEY) ?? '');
      if (Number.isFinite(mv) && mv >= 0 && mv <= 100) setMetronomeVolume(mv);
      const yv = Number.parseFloat(localStorage.getItem(YT_VOLUME_KEY) ?? '');
      if (Number.isFinite(yv) && yv >= 0 && yv <= 100) setYtVolume(yv);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(METRONOME_VOLUME_KEY, String(metronomeVolume));
    } catch {}
  }, [metronomeVolume]);
  useEffect(() => {
    try {
      localStorage.setItem(YT_VOLUME_KEY, String(ytVolume));
    } catch {}
  }, [ytVolume]);
  useEffect(() => {
    metronomeRef.current?.setVolume(
      Math.max(0, Math.min(100, metronomeVolume)) / 100
    );
  }, [metronomeVolume]);

  // Another tab (typically the projector) has claimed the audio sink.
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const ch = new BroadcastChannel('songstage:audio-sink');
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleClear = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setAudioClaimedElsewhere(false), 5000);
    };
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string } | undefined;
      if (data?.type === 'claim') {
        setAudioClaimedElsewhere(true);
        scheduleClear();
      } else if (data?.type === 'release') {
        if (timer) clearTimeout(timer);
        setAudioClaimedElsewhere(false);
      }
    };
    ch.addEventListener('message', onMessage);
    return () => {
      ch.removeEventListener('message', onMessage);
      ch.close();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Ticker drives the pending-request countdown.
  useEffect(() => {
    if (!pendingRequest) return;
    const t = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(t);
  }, [pendingRequest]);
  useEffect(() => {
    if (pendingRequest && pendingRequest.expiresAt < nowTick) {
      setPendingRequest(null);
      setRequestError('Nessuna risposta dal master attuale.');
    }
  }, [pendingRequest, nowTick]);

  // Subscribe to the set channel. Everything the leader broadcasts arrives here.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`set:${setId}:projection`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: currentUserId },
      },
    });

    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      const p = payload as ProjectionState;
      setItemId(p.itemId ?? null);
      const next = resolveIncomingIndex(p, slidesLocalRef.current, index);
      if (next === -1) {
        router.refresh();
      } else {
        setIndex(next);
      }
    });
    channel.on('broadcast', { event: 'set_order' }, ({ payload }) => {
      const { itemIds } = payload as { itemIds: string[] };
      setSlidesLocal((prev) => applyOrder(prev, itemIds));
    });
    channel.on('broadcast', { event: 'slide_update' }, ({ payload }) => {
      const { itemId: id, body } = payload as { itemId: string; body: string };
      setSlidesLocal((prev) =>
        prev.map((s) => (s.itemId === id ? { ...s, body } : s))
      );
    });
    channel.on('broadcast', { event: 'metronome_update' }, ({ payload }) => {
      const p = payload as MetronomeUpdate;
      setMtRunning(p.running);
      if (typeof p.bpm === 'number' && p.bpm > 0) setMtBpm(p.bpm);
      if (typeof p.startAt === 'number' && p.startAt > 0) setMtStartAt(p.startAt);
      if (typeof p.beatsPerBar === 'number' && p.beatsPerBar >= 1)
        setMtBeatsPerBar(p.beatsPerBar);
      if (typeof p.subdivisionsPerBeat === 'number' && p.subdivisionsPerBeat >= 1)
        setMtSubdivisions(p.subdivisionsPerBeat);
      if (typeof p.strongEvery === 'number' && p.strongEvery >= 1)
        setMtStrongEvery(p.strongEvery);
    });
    channel.on('broadcast', { event: 'yt_update' }, ({ payload }) => {
      const p = payload as {
        playing?: boolean;
        url?: string | null;
        songId?: string | null;
        time?: number | null;
      };
      if (typeof p.playing === 'boolean') setYtPlaying(p.playing);
      if (typeof p.url !== 'undefined') setYtUrl(p.url ?? null);
      if (typeof p.time === 'number') setYtTime(p.time);
      if (p.songId) {
        const match = slidesLocalRef.current.find((s) => s.songId === p.songId);
        if (match) setYtTitle(match.title);
      }
    });
    channel.on('broadcast', { event: 'lead_grant' }, ({ payload }) => {
      const { toUserId } = payload as { toUserId: string };
      if (toUserId !== currentUserId) return;
      setPendingRequest(null);
      // Promote to master in a new tab: this one is the "viewer" URL, keep it
      // simple and navigate to the full console.
      router.push(`/churches/${slug}/sets/${setId}/master`);
    });
    channel.on('broadcast', { event: 'lead_deny' }, ({ payload }) => {
      const { toUserId } = payload as { toUserId: string };
      if (toUserId !== currentUserId) return;
      setPendingRequest(null);
      setRequestError('Il master ha rifiutato la richiesta.');
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ role: 'viewer', email: currentUserEmail, joinedAt: Date.now() });
        channel.send({ type: 'broadcast', event: 'request_state', payload: {} });
      }
    });
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, currentUserId, currentUserEmail, slug, router]);

  // Follow the song by itemId once the setlist re-syncs.
  useEffect(() => {
    if (!itemId) return;
    const found = slidesLocal.findIndex((s) => s.itemId === itemId);
    if (found !== -1 && found !== index) setIndex(found);
  }, [slidesLocal, itemId, index]);

  // Local metronome driver, same engine as the master uses, but passive.
  useEffect(() => {
    if (emitMetronome && !metronomeRef.current) {
      metronomeRef.current = new Metronome();
      metronomeRef.current.setVolume(
        Math.max(0, Math.min(100, metronomeVolume)) / 100
      );
    }
    const m = metronomeRef.current;
    if (!m) return;
    if (emitMetronome && mtRunning) {
      m.update({
        running: true,
        bpm: mtBpm,
        startAt: mtStartAt,
        beatsPerBar: mtBeatsPerBar,
        subdivisionsPerBeat: mtSubdivisions,
        strongEvery: mtStrongEvery,
      });
    } else {
      m.stop();
    }
  }, [
    emitMetronome,
    mtRunning,
    mtBpm,
    mtStartAt,
    mtBeatsPerBar,
    mtSubdivisions,
    mtStrongEvery,
  ]);
  useEffect(() => {
    return () => {
      metronomeRef.current?.dispose();
      metronomeRef.current = null;
    };
  }, []);

  function revealControls() {
    setControlsVisible(true);
    if (hideControlsRef.current) clearTimeout(hideControlsRef.current);
    hideControlsRef.current = setTimeout(() => setControlsVisible(false), 3500);
  }
  useEffect(
    () => () => {
      if (hideControlsRef.current) clearTimeout(hideControlsRef.current);
    },
    []
  );

  function requestLead() {
    const ch = channelRef.current;
    if (!ch || !canBeMaster) return;
    if (!liveMasterIsFresh) {
      // Nobody is leading right now: skip the handshake and just take over.
      router.push(`/churches/${slug}/sets/${setId}/master`);
      return;
    }
    setRequestError(null);
    ch.send({
      type: 'broadcast',
      event: 'lead_request',
      payload: { fromUserId: currentUserId, fromEmail: currentUserEmail },
    });
    setPendingRequest({ expiresAt: Date.now() + 20_000 });
  }

  const slide = slidesLocal[index];
  const song = useMemo(() => (slide ? parseOnSong(slide.body) : null), [slide]);
  const totalSemitones = slide?.transpose ?? 0;
  const effectiveAudible = receiveSharedAudio && !audioClaimedElsewhere;
  const secondsLeft = pendingRequest
    ? Math.max(0, Math.ceil((pendingRequest.expiresAt - nowTick) / 1000))
    : 0;

  if (!slide) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Questo set non ha canzoni.</p>
          <Link
            href={`/churches/${slug}/sets/${setId}`}
            className="text-sm text-accent hover:underline"
          >
            ← Torna al set
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="h-dvh overflow-hidden relative"
      onPointerDown={revealControls}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Full-page scrollable song */}
      <div className="h-full overflow-auto">
        <div
          className="max-w-3xl mx-auto w-full p-8 px-6 sm:px-16 md:px-20"
          style={{ fontSize: `${fontScale}em` }}
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

      {/* Setlist overlay (hidden by default; opens from the floating ☰ chip) */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside className="fixed top-0 bottom-0 left-0 w-64 bg-panel border-r border-border overflow-auto z-40 shadow-2xl">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <Link
                href={`/churches/${slug}/sets/${setId}`}
                className="text-sm text-zinc-400 hover:text-white truncate"
                title={setName}
              >
                ← {setName}
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="min-w-[2rem] h-8 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center flex-shrink-0 ml-2"
                aria-label="Chiudi scaletta"
              >
                ✕
              </button>
            </div>
            <ol className="p-2 text-sm">
              {slidesLocal.map((s, i) => (
                <li
                  key={s.itemId}
                  className={`px-3 py-2 rounded-md flex items-center gap-2 ${
                    i === index ? 'bg-accent/15 text-accent' : 'text-zinc-400'
                  }`}
                >
                  <span className="w-5 text-right text-xs tabular-nums text-zinc-500">
                    {i + 1}
                  </span>
                  <span className="truncate">{s.title}</span>
                </li>
              ))}
            </ol>
          </aside>
        </>
      )}

      {/* Top-left: back + hamburger. Always visible so the setlist is
          one tap away even when the controls have faded. */}
      <div
        className="fixed top-2 left-2 flex items-center gap-1.5 z-20"
        style={{
          marginTop: 'env(safe-area-inset-top)',
          marginLeft: 'env(safe-area-inset-left)',
        }}
      >
        <button
          onClick={() => {
            setSidebarOpen((v) => !v);
            revealControls();
          }}
          className="min-w-[2.25rem] h-9 rounded-full border border-border bg-panel/90 hover:border-accent text-lg leading-none flex items-center justify-center"
          aria-label="Scaletta"
          title="Scaletta"
        >
          ☰
        </button>
      </div>

      {/* Top-right: "Richiedi master" (only when applicable). Kept outside
          the fading controls because it's the viewer's main action. */}
      {canBeMaster && (
        <div
          className="fixed top-2 right-2 z-20"
          style={{
            marginTop: 'env(safe-area-inset-top)',
            marginRight: 'env(safe-area-inset-right)',
          }}
        >
          <button
            onClick={requestLead}
            disabled={!!pendingRequest}
            className="h-9 px-3 rounded-full border border-accent bg-panel/90 text-accent text-sm hover:bg-accent/10 disabled:opacity-50"
            title={
              liveMasterIsFresh
                ? 'Chiedi al master attuale il controllo del set'
                : 'Prendi il controllo del set (nessun master attivo)'
            }
          >
            {pendingRequest
              ? `Richiesta… ${secondsLeft}s`
              : liveMasterIsFresh
                ? '🎚 Richiedi master'
                : '🎚 Prendi il controllo'}
          </button>
        </div>
      )}

      {/* Bottom-right floating controls — fade after 3.5s like the
          projector. Any tap on the page reveals them again. */}
      <div
        className={`fixed bottom-3 right-3 flex items-center gap-1 rounded-full bg-panel/90 border border-border px-1.5 py-1 transition-opacity duration-500 z-20 ${
          controlsVisible
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none'
        }`}
        style={{
          marginBottom: 'env(safe-area-inset-bottom)',
          marginRight: 'env(safe-area-inset-right)',
        }}
      >
        <button
          onClick={() => {
            setFontScale((f) => Math.max(0.5, +(f - 0.1).toFixed(2)));
            revealControls();
          }}
          aria-label="Rimpicciolisci testo"
          className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center"
        >
          A−
        </button>
        <button
          onClick={() => {
            setFontScale((f) => Math.min(3, +(f + 0.1).toFixed(2)));
            revealControls();
          }}
          aria-label="Ingrandisci testo"
          className="min-w-[2.25rem] h-9 rounded-full border border-border hover:border-accent text-sm flex items-center justify-center"
        >
          A+
        </button>
        <button
          onClick={() => {
            setShowChords((v) => !v);
            revealControls();
          }}
          aria-pressed={showChords}
          title={showChords ? 'Nascondi accordi' : 'Mostra accordi'}
          aria-label="Mostra o nascondi accordi"
          className={`min-w-[2.25rem] h-9 rounded-full border text-xl leading-none flex items-center justify-center ${
            showChords
              ? 'border-accent text-accent'
              : 'border-border text-zinc-500 hover:border-accent'
          }`}
        >
          ♪
        </button>
        <button
          onClick={() => {
            setEmitMetronome((v) => !v);
            revealControls();
          }}
          aria-pressed={emitMetronome}
          title={
            emitMetronome
              ? 'Metronomo acustico su questo dispositivo: acceso'
              : 'Metronomo acustico su questo dispositivo: spento'
          }
          aria-label="Metronomo acustico su questo dispositivo"
          className={`h-9 px-2 rounded-full border text-lg leading-none flex items-center justify-center ${
            emitMetronome
              ? 'border-accent text-accent'
              : 'border-border text-zinc-500 hover:border-accent'
          }`}
        >
          <MetronomeIcon on={emitMetronome} />
        </button>
        <button
          onClick={() => {
            setReceiveSharedAudio((v) => !v);
            revealControls();
          }}
          aria-pressed={receiveSharedAudio}
          title={
            audioClaimedElsewhere
              ? "Audio in riproduzione in un'altra scheda (proiezione) di questo dispositivo"
              : receiveSharedAudio
                ? 'Ricevi audio YouTube del leader: acceso'
                : 'Ricevi audio YouTube del leader: spento'
          }
          aria-label="Ricevi audio YouTube del leader"
          className={`h-9 px-2 rounded-full border text-lg leading-none flex items-center justify-center ${
            effectiveAudible
              ? 'border-accent text-accent'
              : receiveSharedAudio && audioClaimedElsewhere
                ? 'border-amber-500 text-amber-400'
                : 'border-border text-zinc-500 hover:border-accent'
          }`}
        >
          🎧
        </button>
        <MixerButton
          metronomeVolume={metronomeVolume}
          onMetronomeVolumeChange={(v) => {
            setMetronomeVolume(v);
            revealControls();
          }}
          ytVolume={ytVolume}
          onYtVolumeChange={(v) => {
            setYtVolume(v);
            revealControls();
          }}
          metronomeAvailable={emitMetronome}
          ytAvailable={effectiveAudible}
        />
      </div>

      {requestError && (
        <div
          className="fixed left-1/2 -translate-x-1/2 top-14 z-30 rounded-md border border-amber-500/40 bg-amber-950/90 px-4 py-2 text-xs text-amber-200 flex items-center gap-2 shadow-lg"
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          <span>{requestError}</span>
          <button
            onClick={() => setRequestError(null)}
            className="text-amber-300/70 hover:text-amber-100"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>
      )}

      {ytUrl && (
        <YoutubePlayer
          key={ytUrl}
          headless
          url={ytUrl}
          title={ytTitle || slide.title}
          playing={ytPlaying}
          audible={effectiveAudible}
          volume={ytVolume}
          canControl={false}
          followerTime={ytTime}
          onToggle={() => {}}
        />
      )}
    </main>
  );
}

function MetronomeIcon({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 4 L15 4 L18 21 L6 21 Z" />
      <line x1="7" y1="15" x2="17" y2="15" />
      <line x1="12" y1="15" x2={on ? 16 : 12} y2="6" />
      <circle cx={on ? 16 : 12} cy="6" r="1.2" fill="currentColor" />
      {!on && (
        <line
          x1="4"
          y1="22"
          x2="20"
          y2="2"
          stroke="currentColor"
          strokeWidth={2.2}
        />
      )}
    </svg>
  );
}
