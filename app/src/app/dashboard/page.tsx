import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/churches/actions';
import { DisplayNameForm } from './display-name-form';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('display_name, is_curator')
    .eq('id', user.id)
    .maybeSingle();
  const displayName = (me?.display_name as string) ?? '';
  const isCurator = !!(me?.is_curator as boolean | null);

  const { data: memberships } = await supabase
    .from('church_members')
    .select('role, church:churches(id, slug, name)')
    .eq('user_id', user.id);

  const churches = (memberships ?? []).flatMap((m) =>
    m.church ? [{ ...m.church, role: m.role }] : []
  );
  const isChurchAdmin = churches.some((c) => c.role === 'admin');
  const showLibrary = isCurator || isChurchAdmin;

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Chiese</h1>
          <div className="text-zinc-400 text-sm flex items-center gap-2 flex-wrap mt-1">
            <span className="text-white">{displayName || user.email}</span>
            <DisplayNameForm initial={displayName} />
            {displayName && <span>· {user.email}</span>}
          </div>
        </div>
        <form action={signOut}>
          <button className="text-sm text-zinc-400 hover:text-white">Esci</button>
        </form>
      </header>

      {churches.length === 0 ? (
        <div className="rounded-lg border border-border bg-panel p-6 text-center">
          <p className="mb-4 text-zinc-300">Non appartieni ancora a nessuna chiesa.</p>
          <Link
            href="/churches/new"
            className="inline-block px-4 py-2 rounded-full border border-accent text-accent hover:bg-accent/10"
          >
            Crea chiesa
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {churches.map((c) => (
            <Link
              key={c.id}
              href={`/churches/${c.slug}`}
              className="block rounded-lg border border-border bg-panel p-4 hover:border-accent transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-lg">{c.name}</h2>
                  <p className="text-xs text-zinc-500">/{c.slug}</p>
                </div>
                <span className="text-xs text-zinc-400 uppercase tracking-wide">{c.role}</span>
              </div>
            </Link>
          ))}
          <Link
            href="/churches/new"
            className="block rounded-lg border border-dashed border-border p-4 text-center text-sm text-zinc-400 hover:border-accent hover:text-accent transition"
          >
            + Crea un&apos;altra chiesa
          </Link>
        </div>
      )}

      {showLibrary && (
        <div className="mt-10 pt-6 border-t border-border">
          <Link
            href="/library"
            className="block rounded-lg border border-border bg-panel p-4 hover:border-accent transition"
          >
            <div className="font-medium">📚 Libreria canonica</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Base condivisa di canzoni curate, adottabili da ogni chiesa
            </div>
          </Link>
        </div>
      )}
    </main>
  );
}
