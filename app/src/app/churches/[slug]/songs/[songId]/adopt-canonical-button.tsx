'use client';

import { useTransition } from 'react';
import { adoptCanonicalToChurch } from '@/lib/library/actions';

export function AdoptCanonicalButton({
  canonicalSongId,
  churchSlug,
  title,
}: {
  canonicalSongId: string;
  churchSlug: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Adottare "${title}" nel repertorio della chiesa?`)) return;
        startTransition(async () => {
          const r = await adoptCanonicalToChurch(canonicalSongId, churchSlug);
          if (r?.error) alert(r.error);
        });
      }}
      className="text-sm px-3 py-1 rounded-full border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
      title="Crea una copia modificabile di questa canzone per la chiesa"
    >
      {pending ? '…' : '⤓ Adotta per la chiesa'}
    </button>
  );
}
