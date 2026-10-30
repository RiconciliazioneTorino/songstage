'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addSongToSet } from '@/lib/sets/actions';
import type { WritableSet } from '@/lib/sets/writable';

/**
 * Puts the song on the end of a set without leaving its page.
 *
 * Only sets that are still ahead and that the user may write are offered —
 * see `writableSetsForSong`. The page renders nothing when there are none.
 */
export function AddToSetButton({ slug, songId, sets }: { slug: string; songId: string; sets: WritableSet[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const firstFree = sets.find((s) => !s.alreadyHasSong);
  const [setId, setSetId] = useState(firstFree?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<WritableSet | null>(null);

  const chosen = sets.find((s) => s.id === setId) ?? null;

  function submit() {
    if (!chosen || chosen.alreadyHasSong) return;
    setError(null);
    startTransition(async () => {
      const res = await addSongToSet(chosen.id, songId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setAdded(chosen);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setAdded(null);
          setOpen(true);
        }}
        className="inline-flex items-center justify-center gap-1.5 min-w-[2.25rem] text-sm px-3 py-1 rounded-full border border-border hover:border-accent"
        title="Aggiungi al set"
        aria-label="Aggiungi al set"
      >
        <span aria-hidden>🎵</span>
        <span className="hidden sm:inline">Aggiungi al set</span>
      </button>

      {added && (
        <span className="text-xs text-accent">
          Aggiunta a{' '}
          <Link href={`/churches/${slug}/sets/${added.id}`} className="underline">
            {added.name}
          </Link>
        </span>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-panel border border-border rounded-lg w-full max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Aggiungi al set</h2>
            <p className="text-sm text-zinc-400">
              La canzone va in fondo al set scelto.
            </p>
            <select
              autoFocus
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
            >
              <option value="">Scegli un set…</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id} disabled={s.alreadyHasSong}>
                  {[s.event_date, s.name, s.event_type].filter(Boolean).join(' · ')}
                  {s.alreadyHasSong ? ' — già presente' : ''}
                </option>
              ))}
            </select>

            {chosen?.alreadyHasSong && (
              <p className="text-xs text-amber-300">
                Questa canzone è già in «{chosen.name}».
              </p>
            )}
            {error && (
              <p className="text-sm rounded-md border border-red-500/50 bg-red-950/40 text-red-200 px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => !busy && setOpen(false)}
                className="px-3 py-1.5 rounded-full border border-border text-sm"
              >
                Annulla
              </button>
              <button
                onClick={submit}
                disabled={busy || !chosen || chosen.alreadyHasSong}
                className="px-3 py-1.5 rounded-full bg-accent text-black text-sm disabled:opacity-50"
              >
                {busy ? 'Aggiunta…' : 'Aggiungi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
