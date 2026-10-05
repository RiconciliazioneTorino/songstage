'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createCanonicalSong } from '@/lib/library/actions';

const SAMPLE = `Title: Amazing Grace
Artist: John Newton
Key: G
Tempo: 80

Verse 1:
[G]Amazing [G7]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [D]me`;

export default function NewCanonicalPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createCanonicalSong(formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <Link href="/library" className="text-sm text-zinc-400 hover:text-white">
        ← Libreria canonica
      </Link>
      <h1 className="text-3xl font-bold mt-4 mb-6">Nuova canzone canonica</h1>

      <form action={action} className="space-y-4">
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Titolo (opzionale)</label>
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
        </div>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-full border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? 'Salvataggio…' : 'Salva nella libreria'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </main>
  );
}
