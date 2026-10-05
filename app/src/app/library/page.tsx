import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_curator')
    .eq('id', user.id)
    .maybeSingle();
  const isCurator = me?.is_curator === true;

  const { data: songs } = await supabase
    .from('songs')
    .select('id, title, artist, original_key')
    .is('church_id', null)
    .order('title');

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-3xl mx-auto">
      <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
        ← Chiese
      </Link>
      <header className="mt-4 mb-2 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Libreria canonica</h1>
        {isCurator && (
          <Link
            href="/library/new"
            className="px-3 py-1.5 rounded-full border border-accent text-accent hover:bg-accent/10 text-sm"
          >
            + Nuova
          </Link>
        )}
      </header>
      <p className="text-sm text-zinc-400 mb-6">
        Base condivisa di canzoni curate: struttura, traduzione e accordi fondamentali.
        Ogni chiesa può adottare una canzone canonica e poi personalizzarla.
      </p>

      {(songs ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-zinc-500">
          Nessuna canzone canonica ancora.
        </div>
      ) : (
        <div className="space-y-2">
          {(songs ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/library/${s.id}`}
              className="block rounded-md border border-border bg-panel p-3 hover:border-accent transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.title}</div>
                  {s.artist && <div className="text-xs text-zinc-500">{s.artist}</div>}
                </div>
                {s.original_key && (
                  <span className="text-xs text-zinc-400 px-2 py-0.5 rounded-full bg-bg border border-border">
                    {s.original_key}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
