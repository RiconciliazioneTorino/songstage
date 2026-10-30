'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPublicSetLink, revokePublicSetLink } from '@/lib/sets/actions';

export type PublicLink = {
  id: string;
  token: string;
  expires_at: string;
  created_at: string;
};

const DAY_OPTIONS = [1, 7, 30];

function formatExpiry(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  const days = Math.ceil(ms / 86_400_000);
  if (days >= 1) return `scade tra ${days} ${days === 1 ? 'giorno' : 'giorni'}`;
  const hours = Math.max(0, Math.ceil(ms / 3_600_000));
  return `scade tra ${hours} ${hours === 1 ? 'ora' : 'ore'}`;
}

/**
 * Read-only links for people without an account — the Friday family set goes
 * into the WhatsApp group and everyone follows the lyrics from their phone.
 */
export function PublicLinkPanel({
  setId,
  links,
}: {
  setId: string;
  links: PublicLink[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [days, setDays] = useState(7);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // The absolute URL and the countdown both depend on the browser, so they
  // only exist after mount: rendering them on the server would not match.
  const [origin, setOrigin] = useState('');
  const [now, setNow] = useState(0);
  useEffect(() => {
    setOrigin(window.location.origin);
    setNow(Date.now());
  }, []);

  function publicUrl(token: string) {
    return `${origin}/s/${token}`;
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function copy(token: string) {
    const url = publicUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
    } catch {
      // Clipboard blocked (http, permissions): the link is in the field above,
      // say so instead of leaving a silent failure.
      setError('Copia non riuscita: seleziona il link qui sopra e copialo a mano.');
    }
  }

  return (
    <section className="mt-8 space-y-3">
      <div>
        <h3 className="text-sm text-zinc-300">Link pubblico</h3>
        <p className="text-xs text-zinc-500">
          Chi apre il link vede la proiezione in sola lettura, senza account.
        </p>
      </div>

      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((l) => (
            <li
              key={l.id}
              className="rounded-md border border-border bg-panel p-2 space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={publicUrl(l.token)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-bg border border-border text-xs text-zinc-300 outline-none"
                />
                <button
                  onClick={() => copy(l.token)}
                  className="px-3 py-1.5 rounded-full border border-accent text-accent hover:bg-accent/10 text-xs whitespace-nowrap"
                >
                  {copied === l.token ? 'Copiato' : 'Copia'}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {now ? formatExpiry(l.expires_at, now) : ''}
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(publicUrl(l.token))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded-full border border-border hover:border-accent"
                  >
                    WhatsApp
                  </a>
                  <button
                    onClick={async () => {
                      await revokePublicSetLink(setId, l.id);
                      refresh();
                    }}
                    className="text-xs px-2 py-1 rounded-full border border-border hover:border-red-500"
                  >
                    Revoca
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 rounded-md border border-border bg-panel p-2">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-2 py-2 rounded-md bg-bg border border-border outline-none text-sm"
        >
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d === 1 ? '1 giorno' : `${d} giorni`}
            </option>
          ))}
        </select>
        <button
          onClick={async () => {
            setPending(true);
            setError(null);
            const r = await createPublicSetLink(setId, days);
            setPending(false);
            if (r.error) setError(r.error);
            else {
              if (r.token) await copy(r.token);
              refresh();
            }
          }}
          disabled={pending}
          className="px-3 py-2 rounded-full border border-accent text-accent hover:bg-accent/10 disabled:opacity-50 text-sm"
        >
          {pending ? '…' : 'Crea link'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 break-all">{error}</p>}
    </section>
  );
}
