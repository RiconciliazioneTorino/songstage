'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { extractVideoId } from '@/lib/audio/youtube';
import { loadYouTubeApi, type YtPlayer } from '@/lib/audio/youtube-api';

/**
 * YouTube reference-audio panel with a shared timeline.
 *
 * - `canControl` → leader-side: play/pause and scrub are enabled; the
 *   component calls `onLeaderUpdate` periodically and on every scrub so
 *   followers can stay in sync.
 * - `audible` → mount the actual YT.Player on this device. The leader can
 *   turn their own audio off (via the 🎧 toggle) while still broadcasting
 *   for the mixer machine.
 * - `followerTime` → followers pass the latest broadcast time here; the
 *   component seeks the local player if the gap exceeds a threshold.
 */
export function YoutubePlayer({
  url,
  title,
  playing,
  audible,
  canControl,
  onToggle,
  followerTime,
  onLeaderUpdate,
  headless = false,
  volume = 100,
}: {
  url: string;
  title: string;
  playing: boolean;
  audible: boolean;
  canControl: boolean;
  onToggle: (next: boolean) => void;
  followerTime?: number | null;
  onLeaderUpdate?: (time: number) => void;
  /** Hide the UI and only mount the audio sink. For the projector screen. */
  headless?: boolean;
  /** 0–100. Applied to the YT.Player output when audio is unmuted. */
  volume?: number;
}) {
  const videoId = extractVideoId(url);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  // Build the YT.Player once per video id. It starts muted so autoplay is
  // allowed with no gesture; audio is gated with mute()/unMute() below.
  useEffect(() => {
    if (!videoId || !hostRef.current) return;
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const player = new YT.Player(hostRef.current, {
        videoId,
        width: 1,
        height: 1,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          mute: 1,
        },
        events: {
          onReady: ({ target }) => {
            setReady(true);
            try {
              setDuration(target.getDuration() || 0);
            } catch {}
          },
          onStateChange: ({ target }) => {
            try {
              setDuration(target.getDuration() || 0);
            } catch {}
          },
        },
      });
      playerRef.current = player;
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {}
      playerRef.current = null;
      setReady(false);
      setDuration(0);
      setCurrentTime(0);
    };
  }, [videoId]);

  // Audio gate: mute/unmute without tearing down the player. Keeping state
  // across toggles means a slave can silence itself without pausing the
  // leader's broadcast or losing its own playback position.
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    try {
      if (audible) {
        playerRef.current.unMute();
        playerRef.current.setVolume(Math.max(0, Math.min(100, volume)));
      } else {
        playerRef.current.mute();
      }
    } catch {}
  }, [audible, ready, volume]);

  // Apply play/pause to the local player when the controlling state flips.
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    try {
      if (playing) playerRef.current.playVideo();
      else playerRef.current.pauseVideo();
    } catch {}
  }, [playing, ready]);

  // Follower: snap the local player when the broadcast time diverges.
  useEffect(() => {
    if (canControl) return; // leader doesn't follow itself
    if (!ready || !playerRef.current) return;
    if (typeof followerTime !== 'number') return;
    try {
      const local = playerRef.current.getCurrentTime() || 0;
      if (Math.abs(local - followerTime) > 1.0) {
        playerRef.current.seekTo(followerTime, true);
      }
    } catch {}
  }, [followerTime, ready, canControl]);

  // Poll local time; the leader additionally forwards it over the channel.
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    const interval = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const now = p.getCurrentTime() || 0;
        if (!scrubbing) setCurrentTime(now);
        if (canControl && playing) onLeaderUpdate?.(now);
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [ready, playing, canControl, onLeaderUpdate, scrubbing]);

  const handleScrub = useCallback(
    (sec: number) => {
      if (!canControl) return;
      setCurrentTime(sec);
      try {
        playerRef.current?.seekTo(sec, true);
      } catch {}
      onLeaderUpdate?.(sec);
    },
    [canControl, onLeaderUpdate]
  );

  if (!videoId) return null;
  const sliderMax = Math.max(duration, 1);
  const sliderValue = Math.min(currentTime, sliderMax);

  if (headless) {
    return (
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          left: -9999,
          top: -9999,
        }}
      >
        <div ref={hostRef} />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-panel">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => canControl && onToggle(!playing)}
          disabled={!canControl}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 text-white disabled:opacity-40 disabled:cursor-not-allowed ${
            playing ? 'bg-red-700 hover:bg-red-600' : 'bg-red-600 hover:bg-red-500'
          }`}
          title={playing ? 'Ferma' : 'Riproduci YouTube'}
          aria-label={playing ? 'Ferma YouTube' : 'Riproduci YouTube'}
        >
          <span aria-hidden className="text-sm leading-none">
            {playing ? '■' : '▶'}
          </span>
        </button>
        <span className="text-xs text-zinc-400 truncate flex-1 min-w-0">
          {title}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-zinc-500 hover:text-accent flex-shrink-0"
          title="Apri su YouTube"
        >
          ↗
        </a>
      </div>

      <div className="px-3 pb-2 flex items-center gap-2">
        <span className="text-[10px] text-zinc-500 font-mono tabular-nums w-10 text-right">
          {fmtTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={0.5}
          value={sliderValue}
          onChange={(e) => {
            if (!canControl) return;
            const v = parseFloat(e.target.value);
            setCurrentTime(v);
          }}
          onMouseDown={() => setScrubbing(true)}
          onTouchStart={() => setScrubbing(true)}
          onMouseUp={(e) => {
            setScrubbing(false);
            if (!canControl) return;
            handleScrub(parseFloat((e.target as HTMLInputElement).value));
          }}
          onTouchEnd={(e) => {
            setScrubbing(false);
            if (!canControl) return;
            handleScrub(parseFloat((e.target as HTMLInputElement).value));
          }}
          disabled={!canControl}
          className="flex-1 accent-red-600 disabled:opacity-40"
          aria-label="Posizione nella traccia"
        />
        <span className="text-[10px] text-zinc-500 font-mono tabular-nums w-10">
          {fmtTime(duration)}
        </span>
      </div>

      {/* Audio sink: an off-screen 1×1 host for YT.Player. Always mounted so
          the slider position and sync keep flowing even with 🎧 off — the
          `audible` prop just mutes / unmutes the running player. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          left: -9999,
          top: -9999,
        }}
      >
        <div ref={hostRef} />
      </div>
    </div>
  );
}

function fmtTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const r = total % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
