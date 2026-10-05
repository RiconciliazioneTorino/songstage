'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createSet } from '@/lib/sets/actions';

export default function NewSetPage() {
  const params = useParams<{ slug: string }>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createSet(params.slug, formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-md mx-auto">
      <Link href={`/churches/${params.slug}/sets`} className="text-sm text-zinc-400 hover:text-white">
        ← Set
      </Link>
      <h1 className="text-3xl font-bold mt-4 mb-6">Nuovo set</h1>
      <form action={action} className="space-y-4">
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Nome</label>
          <input
            name="name"
            required
            autoFocus
            placeholder="Domenica 12 maggio"
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none"
          />
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Data</label>
          <input
            type="date"
            name="event_date"
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none"
          />
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Tipo</label>
          <input
            name="event_type"
            placeholder="domenica, giovani, ritiro…"
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full px-4 py-2 rounded-full border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? 'Creazione…' : 'Crea set'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </main>
  );
}
