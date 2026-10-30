import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LibraryExplorer } from './library-explorer';

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
        <LibraryExplorer songs={songs ?? []} />
      )}
    </main>
  );
}
