'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setCurrentVersion } from '@/lib/songs/actions';

type Version = {
  id: string;
  version_number: number;
  notes: string | null;
  created_at: string;
  created_by: { display_name: string | null; email: string } | null;
};

export function VersionsPanel({
  slug,
  songId,
  currentVersionId,
  versions,
  canEdit,
}: {
  slug: string;
  songId: string;
  currentVersionId: string | null;
  versions: Version[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (versions.length <= 1 && !canEdit) return null;

  return (
    <section className="mt-12">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-zinc-400 hover:text-white"
      >
        {open ? '▼' : '▶'} Versioni ({versions.length})
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {versions.map((v) => {
            const isCurrent = v.id === currentVersionId;
            const author = v.created_by?.display_name ?? v.created_by?.email ?? 'sconosciuto';
            const date = new Date(v.created_at).toLocaleString('it-IT');
            return (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-md border border-border bg-panel p-3"
              >
                <div className="text-sm">
                  <div>
                    <span className="font-medium">v{v.version_number}</span>
                    {isCurrent && (
                      <span className="ml-2 text-xs text-accent">attuale</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {author} · {date}
                    {v.notes && <> · {v.notes}</>}
                  </div>
                </div>
                {canEdit && !isCurrent && (
                  <button
                    onClick={async () => {
                      const r = await setCurrentVersion(slug, songId, v.id);
                      if (!r?.error) startTransition(() => router.refresh());
                    }}
                    className="text-xs px-2 py-1 rounded border border-border hover:border-accent"
                  >
                    Ripristina
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
