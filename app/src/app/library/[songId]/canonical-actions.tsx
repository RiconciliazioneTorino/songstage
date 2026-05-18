'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adoptCanonicalToChurch, deleteCanonicalSong } from '@/lib/library/actions';

type Church = { id: string; slug: string; name: string };
type Adoption = { id: string; churchSlug: string; churchName: string };

export function CanonicalActions({
  songId,
  songTitle,
  isCurator,
  adoptableChurches,
  adoptions,
}: {
  songId: string;
  songTitle: string;
  isCurator: boolean;
  adoptableChurches: Church[];
  adoptions: Adoption[];
}) {
  const [adopting, setAdopting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const adoptedByMap = new Map(adoptions.map((a) => [a.churchSlug, a]));

  return (
    <div className="mt-4 mb-4 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2">
        {isCurator && (
          <>
            <Link
              href={`/library/${songId}/edit`}
              className="text-sm px-3 py-1 rounded-md border border-border hover:border-accent"
            >
              Modifica
            </Link>
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-sm px-3 py-1 rounded-md border border-border hover:border-red-500 text-zinc-400 hover:text-red-400"
              >
                Elimina
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">
                  Eliminare &quot;{songTitle}&quot;?
                </span>
                <button
                  onClick={async () => {
                    setPending(true);
                    setError(null);
                    const r = await deleteCanonicalSong(songId);
                    setPending(false);
                    if (r?.error) setError(r.error);
                  }}
                  disabled={pending}
                  className="text-xs px-2 py-1 rounded-md border border-red-500 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {pending ? '…' : 'Sì, elimina'}
                </button>
                <button
                  onClick={() => {
                    setConfirmingDelete(false);
                    setError(null);
                  }}
                  className="text-xs px-2 py-1 rounded-md border border-border"
                >
                  Annulla
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {adoptableChurches.length === 0 ? null : !adopting ? (
          <button
            onClick={() => setAdopting(true)}
            className="text-sm px-3 py-1.5 rounded-md border border-accent text-accent hover:bg-accent/10"
          >
            Adotta nel repertorio…
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {adoptableChurches.map((c) => {
              const already = adoptedByMap.get(c.slug);
              if (already) {
                return (
                  <Link
                    key={c.id}
                    href={`/churches/${c.slug}/songs/${already.id}`}
                    className="text-xs px-2 py-1 rounded border border-border bg-panel text-zinc-300 hover:border-accent"
                  >
                    {c.name} ✓
                  </Link>
                );
              }
              return (
                <button
                  key={c.id}
                  onClick={async () => {
                    setPending(true);
                    setError(null);
                    const r = await adoptCanonicalToChurch(songId, c.slug);
                    setPending(false);
                    if (r?.error) setError(r.error);
                    else router.refresh();
                  }}
                  disabled={pending}
                  className="text-xs px-2 py-1 rounded border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  → {c.name}
                </button>
              );
            })}
            <button
              onClick={() => setAdopting(false)}
              className="text-xs px-2 py-1 rounded border border-border"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400 w-full">{error}</p>}
    </div>
  );
}
