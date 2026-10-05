'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createSong } from '@/lib/songs/actions';

const SAMPLE = `Title: Amazing Grace
Artist: John Newton
Key: G
Tempo: 80

Verse 1:
[G]Amazing [G7]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [D]me`;

export default function NewSongPage() {
  const params = useParams<{ slug: string }>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createSong(params.slug, formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-3xl mx-auto">
      <Link href={`/churches/${params.slug}/songs`} className="text-sm text-zinc-400 hover:text-white">
        ← Canzoni
      </Link>
      <h1 className="text-3xl font-bold mt-4 mb-6">Nuova canzone</h1>

      <form action={action} className="space-y-4">
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Titolo (opzionale, dedotto dall&apos;header)</label>
          <input
            name="title"
            placeholder="Auto da 'Title:' del body"
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none"
          />
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">OnSong body</label>
          <textarea
            name="body"
            required
            rows={20}
            defaultValue={SAMPLE}
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none font-mono text-sm"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Header in alto (Title, Artist, Key, Tempo), riga vuota, poi il corpo con accordi <code>[Em]</code> tra il testo.
          </p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-full border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? 'Salvataggio…' : 'Salva canzone'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </main>
  );
}
