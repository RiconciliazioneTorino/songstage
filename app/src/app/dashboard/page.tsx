import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/churches/actions';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('church_members')
    .select('role, church:churches(id, slug, name)')
    .eq('user_id', user.id);

  const churches = (memberships ?? []).map((m: any) => ({
    ...m.church,
    role: m.role as 'admin' | 'director' | 'musico' | 'lector',
  }));

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Chiese</h1>
          <p className="text-zinc-400 text-sm">{user.email}</p>
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
            className="inline-block px-4 py-2 rounded-md border border-accent text-accent hover:bg-accent/10"
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
    </main>
  );
}
