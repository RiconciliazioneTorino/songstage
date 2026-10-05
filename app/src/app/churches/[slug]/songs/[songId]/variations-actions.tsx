'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBandVariation, createUserVariation } from '@/lib/variations/actions';

type Band = { id: string; name: string };

export function VariationsActions({
  slug,
  songId,
  hasUserVariation,
  myBands,
  bandVariationsBandIds,
}: {
  slug: string;
  songId: string;
  hasUserVariation: boolean;
  myBands: Band[];
  bandVariationsBandIds: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bandsWithoutVariation = myBands.filter((b) => !bandVariationsBandIds.includes(b.id));

  const canCreateUser = !hasUserVariation;
  const canCreateBand = bandsWithoutVariation.length > 0;

  if (!canCreateUser && !canCreateBand) return null;

  return (
    <section className="mt-6 flex flex-wrap gap-2 items-center">
      <span className="text-xs text-zinc-500">Crea variante:</span>

      {canCreateUser && (
        <button
          onClick={async () => {
            setPending(true);
            setError(null);
            const r = await createUserVariation(slug, songId);
            setPending(false);
            if (r?.error) setError(r.error);
            else startTransition(() => router.refresh());
          }}
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-accent disabled:opacity-50"
        >
          + Personale
        </button>
      )}

      {bandsWithoutVariation.map((b) => (
        <button
          key={b.id}
          onClick={async () => {
            setPending(true);
            setError(null);
            const r = await createBandVariation(slug, songId, b.id);
            setPending(false);
            if (r?.error) setError(r.error);
            else startTransition(() => router.refresh());
          }}
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-accent disabled:opacity-50"
        >
          + Gruppo {b.name}
        </button>
      ))}

      {error && <span className="text-xs text-red-400 w-full">{error}</span>}
    </section>
  );
}
