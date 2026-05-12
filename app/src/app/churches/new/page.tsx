'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createChurch } from '@/lib/churches/actions';

export default function NewChurchPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createChurch(formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <main className="min-h-screen p-8 max-w-md mx-auto">
      <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">← Indietro</Link>
      <h1 className="text-3xl font-bold mt-4 mb-6">Nuova chiesa</h1>
      <form action={action} className="space-y-4">
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Nome</label>
          <input
            name="name"
            required
            autoFocus
            placeholder="Chiesa Evangelica della Riconciliazione"
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none"
          />
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Slug (URL)</label>
          <input
            name="slug"
            placeholder="riconciliazione (opzionale, auto dal nome)"
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none"
          />
          <p className="text-xs text-zinc-500 mt-1">Solo lettere, numeri e trattini. Lascialo vuoto per auto-generarlo.</p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full px-4 py-2 rounded-md border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? 'Creazione…' : 'Crea chiesa'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </main>
  );
}
