'use client';

import { useState } from 'react';
import { updateSong } from '@/lib/songs/actions';

export function EditSongForm({
  slug,
  songId,
  initialBody,
}: {
  slug: string;
  songId: string;
  initialBody: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await updateSong(slug, songId, formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="text-sm text-zinc-400 block mb-1">OnSong body</label>
        <textarea
          name="body"
          required
          rows={24}
          defaultValue={initialBody}
          className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none font-mono text-sm"
        />
      </div>
      <div>
        <label className="text-sm text-zinc-400 block mb-1">Note di versione (opzionale)</label>
        <input
          name="notes"
          placeholder="Es: nuovo arrangiamento del ponte, fix testo v.2…"
          className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? 'Salvataggio…' : 'Salva come nuova versione'}
        </button>
        {error && <p className="text-sm text-red-400 self-center">{error}</p>}
      </div>
    </form>
  );
}
