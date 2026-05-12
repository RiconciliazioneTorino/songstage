'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addBandMember, deleteBand, removeBandMember } from '@/lib/bands/actions';

type User = { id: string; email: string; display_name: string | null };
type BandMember = { user_id: string; user: User };
type ChurchMember = { role: string; user: User };

export function BandMembersPanel({
  churchSlug,
  bandId,
  bandName,
  bandMembers,
  churchMembers,
  canManage,
}: {
  churchSlug: string;
  bandId: string;
  bandName: string;
  bandMembers: BandMember[];
  churchMembers: ChurchMember[];
  canManage: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const inBand = new Set(bandMembers.map((m) => m.user_id));
  const eligible = churchMembers.filter((cm) => !inBand.has(cm.user.id));

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Membri</h2>
        <span className="text-xs text-zinc-500">{bandMembers.length}</span>
      </div>

      {bandMembers.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-zinc-500">
          Nessun membro nel gruppo.
        </div>
      ) : (
        <ul className="space-y-2">
          {bandMembers.map((m) => (
            <li
              key={m.user.id}
              className="flex items-center justify-between rounded-md border border-border bg-panel px-3 py-2"
            >
              <div>
                <div className="text-sm">{m.user.display_name ?? m.user.email}</div>
                <div className="text-xs text-zinc-500">{m.user.email}</div>
              </div>
              {canManage && (
                <button
                  onClick={async () => {
                    await removeBandMember(bandId, m.user.id);
                    refresh();
                  }}
                  className="text-xs px-2 py-1 rounded border border-border hover:border-red-500"
                >
                  Rimuovi
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <>
          {!pickerOpen ? (
            <button
              onClick={() => setPickerOpen(true)}
              className="w-full px-3 py-2 rounded-md border border-dashed border-border hover:border-accent text-sm text-zinc-400 hover:text-accent"
            >
              + Aggiungi membro
            </button>
          ) : (
            <div className="rounded-md border border-border bg-panel p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Aggiungi dalla chiesa</span>
                <button
                  onClick={() => setPickerOpen(false)}
                  className="text-xs px-2 py-1 rounded border border-border"
                >
                  Chiudi
                </button>
              </div>
              {eligible.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-2">
                  Tutti i membri della chiesa sono già nel gruppo.
                </p>
              ) : (
                <ul className="max-h-64 overflow-auto divide-y divide-border">
                  {eligible.map((cm) => (
                    <li key={cm.user.id} className="flex items-center justify-between py-2">
                      <div>
                        <div className="text-sm">{cm.user.display_name ?? cm.user.email}</div>
                        <div className="text-xs text-zinc-500">{cm.user.email}</div>
                      </div>
                      <button
                        onClick={async () => {
                          const r = await addBandMember(bandId, cm.user.id);
                          if (r?.error) setError(r.error);
                          else {
                            setError(null);
                            refresh();
                          }
                        }}
                        className="text-xs px-2 py-1 rounded border border-accent text-accent hover:bg-accent/10"
                      >
                        Aggiungi
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          )}

          <div className="pt-6 border-t border-border">
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-zinc-500 hover:text-red-400"
              >
                Elimina gruppo
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">
                  Eliminare &quot;{bandName}&quot;?
                </span>
                <button
                  onClick={async () => {
                    setPending(true);
                    setError(null);
                    const r = await deleteBand(churchSlug, bandId);
                    setPending(false);
                    if (r?.error) setError(r.error);
                  }}
                  disabled={pending}
                  className="text-xs px-2 py-1 rounded border border-red-500 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {pending ? '…' : 'Sì, elimina'}
                </button>
                <button
                  onClick={() => {
                    setConfirmingDelete(false);
                    setError(null);
                  }}
                  className="text-xs px-2 py-1 rounded border border-border"
                >
                  Annulla
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
