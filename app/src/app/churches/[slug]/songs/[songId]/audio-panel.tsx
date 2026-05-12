'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addSongAudioLink, removeSongAudio } from '@/lib/songs/actions';

type Audio = {
  id: string;
  kind: 'mp3_upload' | 'youtube' | 'spotify' | 'amazon' | 'soundcloud' | 'other';
  url: string | null;
  storage_path: string | null;
};

const KIND_LABELS: Record<Audio['kind'], string> = {
  mp3_upload: 'MP3',
  youtube: 'YouTube',
  spotify: 'Spotify',
  amazon: 'Amazon Music',
  soundcloud: 'SoundCloud',
  other: 'Link',
};

function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    const v = u.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${v}`;
    if (u.pathname.startsWith('/embed/')) return url;
    return null;
  } catch {
    return null;
  }
}

function spotifyEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return `https://open.spotify.com/embed${u.pathname}`;
  } catch {
    return null;
  }
}

export function AudioPanel({
  songId,
  audios,
  canEdit,
}: {
  songId: string;
  audios: Audio[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  if (audios.length === 0 && !canEdit) return null;

  return (
    <section className="mt-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-zinc-400 hover:text-white"
      >
        {open ? '▼' : '▶'} Audio / riferimento ({audios.length})
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {audios.map((a) => (
            <div key={a.id} className="rounded-md border border-border bg-panel p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-zinc-400 mr-2">{KIND_LABELS[a.kind]}</span>
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent break-all"
                    >
                      {a.url}
                    </a>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={async () => {
                      await removeSongAudio(a.id);
                      refresh();
                    }}
                    className="text-xs px-2 py-1 rounded border border-border hover:border-red-500"
                  >
                    Rimuovi
                  </button>
                )}
              </div>
              {a.kind === 'youtube' && a.url && youtubeEmbedUrl(a.url) && (
                <iframe
                  src={youtubeEmbedUrl(a.url)!}
                  className="w-full aspect-video rounded"
                  allow="encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              )}
              {a.kind === 'spotify' && a.url && spotifyEmbedUrl(a.url) && (
                <iframe
                  src={spotifyEmbedUrl(a.url)!}
                  className="w-full h-20 rounded"
                  allow="encrypted-media"
                />
              )}
            </div>
          ))}

          {canEdit && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPending(true);
                setError(null);
                const r = await addSongAudioLink(songId, url);
                setPending(false);
                if (r?.error) setError(r.error);
                else {
                  setUrl('');
                  refresh();
                }
              }}
              className="flex gap-2 rounded-md border border-border bg-panel p-2"
            >
              <input
                type="url"
                required
                placeholder="Link di YouTube, Spotify, ecc."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
              />
              <button
                type="submit"
                disabled={pending}
                className="px-3 py-2 rounded-md border border-accent text-accent hover:bg-accent/10 disabled:opacity-50 text-sm"
              >
                {pending ? '…' : 'Aggiungi'}
              </button>
            </form>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </section>
  );
}
