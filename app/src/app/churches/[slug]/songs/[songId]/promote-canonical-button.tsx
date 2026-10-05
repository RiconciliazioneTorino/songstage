'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { promoteSongToCanonical } from '@/lib/library/actions';

export function PromoteCanonicalButton({ songId, title }: { songId: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Promuovere "${title}" alla libreria canonica?`)) return;
        startTransition(async () => {
          const res = await promoteSongToCanonical(songId);
          if (res.error) {
            alert(res.error);
            return;
          }
          if (res.canonicalId) router.push(`/library/${res.canonicalId}`);
        });
      }}
      className="inline-flex items-center justify-center gap-1.5 min-w-[2.25rem] text-sm px-3 py-1 rounded-full border border-border hover:border-accent disabled:opacity-50"
      title="Promuovi a canonica"
      aria-label="Promuovi a canonica"
    >
      {pending ? (
        '…'
      ) : (
        <>
          <span aria-hidden>📚</span>
          <span className="hidden sm:inline">Promuovi a canonica</span>
        </>
      )}
    </button>
  );
}
