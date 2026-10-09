'use client';

import { useState } from 'react';
import { youtubeEmbedUrl } from '@/lib/audio/youtube';

/**
 * YouTube reference-audio panel. The iframe is kept at 1×1 off-screen so the
 * leader (and any follower that opted in to shared audio) hears the recording
 * without a video distracting them.
 *
 * Pass `playing` + `onToggle` to drive it externally (shared-audio sync).
 * Omit both for a self-contained panel.
 */
export function YoutubePlayer({
  url,
  title,
  playing,
  onToggle,
  canToggle = true,
}: {
  url: string;
  title: string;
  playing?: boolean;
  onToggle?: (next: boolean) => void;
  canToggle?: boolean;
}) {
  const embed = youtubeEmbedUrl(url);
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = typeof playing === 'boolean';
  const isPlaying = controlled ? playing : internalOpen;
  if (!embed) return null;
  const src = `${embed}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`;

  function toggle() {
    if (!canToggle) return;
    const next = !isPlaying;
    if (controlled) onToggle?.(next);
    else setInternalOpen(next);
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-panel overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={toggle}
          disabled={!canToggle}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 text-white disabled:opacity-40 disabled:cursor-not-allowed ${
            isPlaying ? 'bg-red-700 hover:bg-red-600' : 'bg-red-600 hover:bg-red-500'
          }`}
          title={isPlaying ? 'Ferma' : 'Riproduci YouTube (solo audio)'}
          aria-label={isPlaying ? 'Ferma YouTube' : 'Riproduci YouTube'}
        >
          <span aria-hidden className="text-sm leading-none">
            {isPlaying ? '■' : '▶'}
          </span>
        </button>
        <span className="text-xs text-zinc-400 truncate flex-1 min-w-0">
          {isPlaying ? 'Audio in riproduzione' : `Ascolta: ${title}`}
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
      {isPlaying && (
        // Audio-only: iframe stays mounted but off-screen. The user said the
        // video itself isn't useful; sound keeps flowing to the mixer / monitor.
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
          <iframe
            src={src}
            title={`YouTube — ${title}`}
            allow="autoplay; encrypted-media"
            width={1}
            height={1}
          />
        </div>
      )}
    </div>
  );
}
