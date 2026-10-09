'use client';

import { useState } from 'react';
import { youtubeEmbedUrl } from '@/lib/audio/youtube';

/**
 * Minimal YouTube panel: a collapsed row with a play button; expanded, an
 * embedded iframe that autoplays. Unmounts on close so the audio stops.
 * Cross-origin restrictions mean we can't control pitch or sync tempo — the
 * iframe is a reference player.
 */
export function YoutubePlayer({ url, title }: { url: string; title: string }) {
  const embed = youtubeEmbedUrl(url);
  const [open, setOpen] = useState(false);
  if (!embed) return null;
  const src = `${embed}?autoplay=1&rel=0&modestbranding=1`;

  return (
    <div className="mt-3 rounded-md border border-border bg-panel overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex-shrink-0"
          title={open ? 'Chiudi player' : 'Riproduci YouTube'}
          aria-label={open ? 'Chiudi player' : 'Riproduci YouTube'}
        >
          <span aria-hidden className="text-sm leading-none">
            {open ? '■' : '▶'}
          </span>
        </button>
        <span className="text-xs text-zinc-400 truncate flex-1 min-w-0">
          {open ? 'YouTube in riproduzione' : `Ascolta: ${title}`}
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
      {open && (
        <div className="aspect-video bg-black border-t border-border">
          <iframe
            src={src}
            title={`YouTube — ${title}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  );
}
