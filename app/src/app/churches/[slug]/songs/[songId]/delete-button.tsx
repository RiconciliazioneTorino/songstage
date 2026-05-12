'use client';

import { useState } from 'react';
import { deleteSong } from '@/lib/songs/actions';

export function DeleteSongButton({
  slug,
  songId,
  title,
}: {
  slug: string;
  songId: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm px-3 py-1 rounded-md border border-border hover:border-red-500 text-zinc-400 hover:text-red-400"
      >
        Elimina
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400">Eliminare &quot;{title}&quot;?</span>
      <button
        onClick={async () => {
          setPending(true);
          setError(null);
          const r = await deleteSong(slug, songId);
          setPending(false);
          if (r?.error) setError(r.error);
        }}
        disabled={pending}
        className="text-sm px-3 py-1 rounded-md border border-red-500 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
      >
        {pending ? '…' : 'Sì, elimina'}
      </button>
      <button
        onClick={() => {
          setConfirming(false);
          setError(null);
        }}
        className="text-sm px-3 py-1 rounded-md border border-border"
      >
        Annulla
      </button>
      {error && <span className="text-xs text-red-400 ml-2">{error}</span>}
    </div>
  );
}
