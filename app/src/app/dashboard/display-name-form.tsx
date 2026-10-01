'use client';

import { useState, useTransition } from 'react';
import { updateDisplayName } from '@/lib/churches/actions';

export function DisplayNameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-zinc-400 hover:text-white"
        title="Modifica nome"
      >
        ✎
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await updateDisplayName(name);
          if (res.error) {
            setError(res.error);
            return;
          }
          setEditing(false);
        });
      }}
      className="flex items-center gap-1"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        placeholder="Il tuo nome"
        className="px-2 py-1 rounded-md bg-bg border border-border focus:border-accent outline-none text-xs"
      />
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="px-2 py-1 rounded border border-accent text-accent hover:bg-accent/10 text-xs disabled:opacity-50"
      >
        {pending ? '…' : 'Salva'}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setName(initial);
          setError(null);
        }}
        className="text-xs text-zinc-500 hover:text-white px-1"
      >
        ×
      </button>
      {error && <span className="text-xs text-red-400 ml-1">{error}</span>}
    </form>
  );
}
