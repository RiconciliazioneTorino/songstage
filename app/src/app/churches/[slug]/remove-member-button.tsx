'use client';

import { useTransition } from 'react';
import { removeChurchMember } from '@/lib/churches/actions';

export function RemoveMemberButton({
  churchId,
  userId,
  label,
}: {
  churchId: string;
  userId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Rimuovere ${label} dalla chiesa?`)) return;
        startTransition(async () => {
          const res = await removeChurchMember(churchId, userId);
          if (res.error) alert(res.error);
        });
      }}
      className="text-xs text-zinc-400 hover:text-red-400 disabled:opacity-50"
      title="Rimuovi dalla chiesa"
    >
      ×
    </button>
  );
}
