'use client';

import { useState } from 'react';
import { addChurchMember } from '@/lib/churches/actions';

type Role = 'admin' | 'director' | 'musico' | 'lector';

export function AddMemberForm({ churchId }: { churchId: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('musico');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await addChurchMember(churchId, email, role);
    setPending(false);
    if (result?.error) setError(result.error);
    else {
      setEmail('');
      setRole('musico');
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 rounded-md border border-border bg-panel p-3 space-y-2">
      <div className="text-sm text-zinc-400">Aggiungi membro</div>
      <div className="flex gap-2">
        <input
          type="email"
          required
          placeholder="email@..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="px-3 py-2 rounded-md bg-bg border border-border outline-none text-sm"
        >
          <option value="admin">Admin</option>
          <option value="director">Direttore</option>
          <option value="musico">Musicista</option>
          <option value="lector">Lettore</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-2 rounded-md border border-accent text-accent hover:bg-accent/10 disabled:opacity-50 text-sm"
        >
          {pending ? '…' : 'Aggiungi'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
