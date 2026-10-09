'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteSet, updateSet } from '@/lib/sets/actions';

type SetData = {
  id: string;
  name: string;
  event_date: string | null;
  event_type: string | null;
  notes: string | null;
};

export function SetHeader({
  slug,
  set,
  liveHref,
}: {
  slug: string;
  set: SetData;
  /** Where "Entra nel set" points — /master or /view depending on role and
   *  whether someone else is already leading. Computed by the server page. */
  liveHref: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (editing) {
    return (
      <header className="mb-6 rounded-md border border-border bg-panel p-4">
        <form
          action={async (fd) => {
            setPending(true);
            setError(null);
            const r = await updateSet(set.id, {
              name: String(fd.get('name') ?? ''),
              event_date: String(fd.get('event_date') ?? '') || null,
              event_type: String(fd.get('event_type') ?? ''),
              notes: String(fd.get('notes') ?? ''),
            });
            setPending(false);
            if (r?.error) {
              setError(r.error);
              return;
            }
            setEditing(false);
            startTransition(() => router.refresh());
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Nome</label>
            <input
              name="name"
              defaultValue={set.name}
              required
              className="w-full px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Data</label>
              <input
                type="date"
                name="event_date"
                defaultValue={set.event_date ?? ''}
                className="w-full px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Tipo</label>
              <input
                name="event_type"
                defaultValue={set.event_type ?? ''}
                placeholder="domenica, giovani…"
                className="w-full px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Note</label>
            <textarea
              name="notes"
              defaultValue={set.notes ?? ''}
              rows={2}
              className="w-full px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="px-3 py-1.5 rounded-full border border-accent text-accent hover:bg-accent/10 disabled:opacity-50 text-sm"
            >
              {pending ? 'Salvataggio…' : 'Salva'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="px-3 py-1.5 rounded-full border border-border text-sm"
            >
              Annulla
            </button>
            {error && <span className="text-xs text-red-400 self-center">{error}</span>}
          </div>
        </form>
      </header>
    );
  }

  return (
    <header className="mb-6 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">{set.name}</h1>
        <p className="text-sm text-zinc-400">
          {[set.event_type, set.event_date].filter(Boolean).join(' · ') || 'Senza data'}
        </p>
        {set.notes && <p className="text-sm text-zinc-500 mt-1 whitespace-pre-wrap">{set.notes}</p>}
      </div>
      <div className="flex flex-col items-end gap-2">
        <Link
          href={liveHref}
          className="px-3 py-2 rounded-full border border-accent text-accent hover:bg-accent/10 text-sm"
        >
          Entra nel set ▸
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-3 py-1 rounded-full border border-border hover:border-accent"
          >
            Modifica
          </button>
          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-xs px-3 py-1 rounded-full border border-border hover:border-red-500 text-zinc-400 hover:text-red-400"
            >
              Elimina
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={async () => {
                  setPending(true);
                  setError(null);
                  const r = await deleteSet(slug, set.id);
                  setPending(false);
                  if (r?.error) setError(r.error);
                }}
                disabled={pending}
                className="text-xs px-2 py-1 rounded-full border border-red-500 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                {pending ? '…' : 'Sì, elimina'}
              </button>
              <button
                onClick={() => {
                  setConfirmingDelete(false);
                  setError(null);
                }}
                className="text-xs px-2 py-1 rounded-full border border-border"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        {error && !editing && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </header>
  );
}
