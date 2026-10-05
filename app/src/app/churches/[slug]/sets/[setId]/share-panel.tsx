'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  shareSet,
  unshareSet,
  shareSetWithBand,
  unshareSetWithBand,
} from '@/lib/sets/actions';

type Permission = 'read' | 'read_write';

type Share = {
  user_id: string;
  permission: Permission;
  user: { email: string; display_name: string | null } | null;
};

type BandShare = {
  band_id: string;
  permission: Permission;
  band: { id: string; name: string } | null;
};

type Band = { id: string; name: string };

export function SharePanel({
  setId,
  shares,
  bandShares,
  availableBands,
}: {
  setId: string;
  shares: Share[];
  bandShares: BandShare[];
  availableBands: Band[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  const total = shares.length + bandShares.length;

  return (
    <section className="mt-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-zinc-400 hover:text-white"
      >
        {open ? '▼' : '▶'} Condiviso con ({total})
      </button>
      {open && (
        <div className="mt-3 space-y-6">
          <BandShares
            setId={setId}
            bandShares={bandShares}
            availableBands={availableBands}
            refresh={refresh}
          />
          <UserShares setId={setId} shares={shares} refresh={refresh} />
        </div>
      )}
    </section>
  );
}

function BandShares({
  setId,
  bandShares,
  availableBands,
  refresh,
}: {
  setId: string;
  bandShares: BandShare[];
  availableBands: Band[];
  refresh: () => void;
}) {
  const [bandId, setBandId] = useState('');
  const [permission, setPermission] = useState<Permission>('read');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sharedBandIds = new Set(bandShares.map((b) => b.band_id));
  const eligible = availableBands.filter((b) => !sharedBandIds.has(b.id));

  return (
    <div className="space-y-2">
      <h3 className="text-sm text-zinc-300">Gruppi</h3>
      {bandShares.length > 0 && (
        <ul className="space-y-2">
          {bandShares.map((bs) => (
            <li
              key={bs.band_id}
              className="flex items-center justify-between rounded-md border border-border bg-panel p-2"
            >
              <div className="text-sm">{bs.band?.name ?? '—'}</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 uppercase">
                  {bs.permission === 'read_write' ? 'modifica' : 'lettura'}
                </span>
                <button
                  onClick={async () => {
                    await unshareSetWithBand(setId, bs.band_id);
                    refresh();
                  }}
                  className="text-xs px-2 py-1 rounded-full border border-border hover:border-red-500"
                >
                  Rimuovi
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {availableBands.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Crea un gruppo nella chiesa per poter condividere con un gruppo intero.
        </p>
      ) : eligible.length === 0 ? (
        <p className="text-xs text-zinc-500">Tutti i gruppi sono già condivisi.</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!bandId) return;
            setPending(true);
            setError(null);
            const r = await shareSetWithBand(setId, bandId, permission);
            setPending(false);
            if (r?.error) setError(r.error);
            else {
              setBandId('');
              refresh();
            }
          }}
          className="flex gap-2 rounded-md border border-border bg-panel p-2"
        >
          <select
            value={bandId}
            onChange={(e) => setBandId(e.target.value)}
            className="flex-1 px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
          >
            <option value="">Seleziona gruppo…</option>
            {eligible.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as Permission)}
            className="px-2 py-2 rounded-md bg-bg border border-border outline-none text-sm"
          >
            <option value="read">Lettura</option>
            <option value="read_write">Modifica</option>
          </select>
          <button
            type="submit"
            disabled={pending || !bandId}
            className="px-3 py-2 rounded-full border border-accent text-accent hover:bg-accent/10 disabled:opacity-50 text-sm"
          >
            {pending ? '…' : 'Condividi'}
          </button>
        </form>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function UserShares({
  setId,
  shares,
  refresh,
}: {
  setId: string;
  shares: Share[];
  refresh: () => void;
}) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<Permission>('read');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <h3 className="text-sm text-zinc-300">Utenti</h3>
      {shares.length > 0 && (
        <ul className="space-y-2">
          {shares.map((s) => (
            <li
              key={s.user_id}
              className="flex items-center justify-between rounded-md border border-border bg-panel p-2"
            >
              <div>
                <div className="text-sm">{s.user?.display_name ?? s.user?.email}</div>
                <div className="text-xs text-zinc-500">{s.user?.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 uppercase">
                  {s.permission === 'read_write' ? 'modifica' : 'lettura'}
                </span>
                <button
                  onClick={async () => {
                    await unshareSet(setId, s.user_id);
                    refresh();
                  }}
                  className="text-xs px-2 py-1 rounded-full border border-border hover:border-red-500"
                >
                  Rimuovi
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          const r = await shareSet(setId, email, permission);
          setPending(false);
          if (r?.error) setError(r.error);
          else {
            setEmail('');
            refresh();
          }
        }}
        className="flex gap-2 rounded-md border border-border bg-panel p-2"
      >
        <input
          type="email"
          required
          placeholder="email@..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
        />
        <select
          value={permission}
          onChange={(e) => setPermission(e.target.value as Permission)}
          className="px-2 py-2 rounded-md bg-bg border border-border outline-none text-sm"
        >
          <option value="read">Lettura</option>
          <option value="read_write">Modifica</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-2 rounded-full border border-accent text-accent hover:bg-accent/10 disabled:opacity-50 text-sm"
        >
          {pending ? '…' : 'Condividi'}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
