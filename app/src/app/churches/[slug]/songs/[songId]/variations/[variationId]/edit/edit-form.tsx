'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteVariation, updateVariation } from '@/lib/variations/actions';

export function EditVariationForm({
  slug,
  songId,
  variationId,
  initialName,
  initialBody,
}: {
  slug: string;
  songId: string;
  variationId: string;
  initialName: string;
  initialBody: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [body, setBody] = useState(initialBody);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await updateVariation(variationId, { name, body_onsong: body });
    setPending(false);
    if (r?.error) setError(r.error);
    else {
      startTransition(() => router.push(`/churches/${slug}/songs/${songId}`));
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="text-sm text-zinc-400 block mb-1">Nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none"
        />
      </div>
      <div>
        <label className="text-sm text-zinc-400 block mb-1">OnSong body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={24}
          className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none font-mono text-sm"
        />
      </div>
      <div className="flex gap-2 items-center">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? 'Salvataggio…' : 'Salva'}
        </button>

        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-xs px-3 py-2 rounded-md border border-border hover:border-red-500 text-zinc-400 hover:text-red-400"
          >
            Elimina variante
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Eliminare?</span>
            <button
              type="button"
              onClick={async () => {
                setPending(true);
                setError(null);
                const r = await deleteVariation(slug, songId, variationId);
                setPending(false);
                if (r?.error) setError(r.error);
              }}
              disabled={pending}
              className="text-xs px-2 py-1 rounded-md border border-red-500 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              Sì
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-xs px-2 py-1 rounded-md border border-border"
            >
              No
            </button>
          </div>
        )}

        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </form>
  );
}
