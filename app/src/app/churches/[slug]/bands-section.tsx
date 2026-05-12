'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBand } from '@/lib/bands/actions';

type Band = {
  id: string;
  name: string;
  members: { user_id: string }[];
};

export function BandsSection({
  churchSlug,
  bands,
  canManage,
}: {
  churchSlug: string;
  bands: Band[];
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Gruppi</h2>
        <span className="text-xs text-zinc-500">{bands.length}</span>
      </div>

      {bands.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-zinc-500">
          Nessun gruppo ancora.
        </div>
      ) : (
        <ul className="space-y-2">
          {bands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/churches/${churchSlug}/bands/${b.id}`}
                className="flex items-center justify-between rounded-md border border-border bg-panel px-3 py-2 hover:border-accent transition"
              >
                <div>
                  <div className="text-sm font-medium">{b.name}</div>
                  <div className="text-xs text-zinc-500">
                    {b.members.length} {b.members.length === 1 ? 'membro' : 'membri'}
                  </div>
                </div>
                <span className="text-xs text-zinc-500">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-3">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="text-sm px-3 py-2 rounded-md border border-dashed border-border hover:border-accent text-zinc-400 hover:text-accent w-full"
            >
              + Nuovo gruppo
            </button>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPending(true);
                setError(null);
                const fd = new FormData();
                fd.set('name', name);
                const r = await createBand(churchSlug, fd);
                setPending(false);
                if (r?.error) setError(r.error);
                else {
                  setName('');
                  setCreating(false);
                  startTransition(() => router.refresh());
                }
              }}
              className="flex gap-2 rounded-md border border-border bg-panel p-2"
            >
              <input
                autoFocus
                required
                placeholder="Nome del gruppo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
              />
              <button
                type="submit"
                disabled={pending}
                className="px-3 py-2 rounded-md border border-accent text-accent hover:bg-accent/10 disabled:opacity-50 text-sm"
              >
                {pending ? '…' : 'Crea'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
                className="px-3 py-2 rounded-md border border-border text-sm"
              >
                Annulla
              </button>
            </form>
          )}
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      )}
    </>
  );
}
