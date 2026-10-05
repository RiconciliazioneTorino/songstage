'use client';

import { useState } from 'react';
import { updateCanonicalSong } from '@/lib/library/actions';

export function EditCanonicalForm({
  songId,
  initialBody,
}: {
  songId: string;
  initialBody: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setPending(true);
    setError(null);
    const r = await updateCanonicalSong(songId, formData);
    setPending(false);
    if (r?.error) setError(r.error);
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
          className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-full border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? 'Salvataggio…' : 'Salva come nuova versione'}
        </button>
        {error && <p className="text-sm text-red-400 self-center">{error}</p>}
      </div>
    </form>
  );
}
