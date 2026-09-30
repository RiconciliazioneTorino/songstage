'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  addChurchMember,
  cancelChurchInvitation,
  inviteChurchMember,
  searchUsersForChurch,
} from '@/lib/churches/actions';

type Role = 'admin' | 'director' | 'musico' | 'lector';
type Candidate = { id: string; email: string; display_name: string | null };
type Invitation = { id: string; email: string; role: Role; created_at: string };

export function AddMemberForm({
  churchId,
  invitations,
}: {
  churchId: string;
  invitations: Invitation[];
}) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [role, setRole] = useState<Role>('musico');
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await searchUsersForChurch(churchId, query.trim());
      if (cancelled) return;
      if (!res.error) setCandidates(res.users ?? []);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, churchId]);

  function add(userId: string) {
    startTransition(async () => {
      const res = await addChurchMember(churchId, userId, role);
      if (res.error) setBanner({ kind: 'error', text: res.error });
      else {
        setBanner({ kind: 'info', text: 'Membro aggiunto.' });
        setQuery('');
      }
    });
  }

  function invite() {
    startTransition(async () => {
      const res = await inviteChurchMember(churchId, query, role);
      if (res.error) setBanner({ kind: 'error', text: res.error });
      else if (res.added)
        setBanner({ kind: 'info', text: 'Utente esistente aggiunto direttamente.' });
      else setBanner({ kind: 'info', text: 'Invito creato — sarà aggiunto al primo accesso.' });
      setQuery('');
    });
  }

  const trimmed = query.trim();
  const looksLikeEmail = /@/.test(trimmed) && !/\s/.test(trimmed);
  const noExactMatch =
    looksLikeEmail && !candidates.some((c) => c.email.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="mt-4 rounded-md border border-border bg-panel p-3 space-y-2">
      <div className="text-sm text-zinc-400">Aggiungi membro</div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Cerca per email o nome…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
      </div>

      {candidates.length > 0 && (
        <ul className="divide-y divide-border rounded border border-border bg-bg max-h-64 overflow-auto">
          {candidates.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => add(c.id)}
                className="w-full text-left px-3 py-2 hover:bg-panel flex items-center justify-between text-sm disabled:opacity-50"
              >
                <div>
                  <div>{c.display_name || c.email}</div>
                  {c.display_name && (
                    <div className="text-xs text-zinc-500">{c.email}</div>
                  )}
                </div>
                <span className="text-xs text-accent">+ Aggiungi</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {noExactMatch && (
        <button
          type="button"
          disabled={pending}
          onClick={invite}
          className="w-full text-left px-3 py-2 rounded border border-dashed border-border hover:border-accent text-sm text-zinc-400 hover:text-accent"
        >
          + Invita <span className="font-mono">{trimmed}</span> — sarà aggiunto al primo accesso
        </button>
      )}

      {banner && (
        <p
          className={`text-xs ${
            banner.kind === 'error' ? 'text-red-400' : 'text-accent'
          }`}
        >
          {banner.text}
        </p>
      )}

      {invitations.length > 0 && (
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-zinc-500 mb-1">Inviti in attesa ({invitations.length})</div>
          <ul className="space-y-1">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-mono">{inv.email}</span>
                  <span className="ml-2 text-xs text-zinc-500 uppercase">{inv.role}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await cancelChurchInvitation(inv.id);
                    })
                  }
                  className="text-xs text-zinc-400 hover:text-red-400"
                >
                  Annulla
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
