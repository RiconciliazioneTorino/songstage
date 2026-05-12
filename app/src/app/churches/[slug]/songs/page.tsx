import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function SongsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: church } = await supabase
    .from('churches')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!church) notFound();

  const { data: myMembership } = await supabase
    .from('church_members')
    .select('role')
    .eq('church_id', church.id)
    .eq('user_id', user.id)
    .maybeSingle();
  const canCreate = myMembership && (myMembership.role === 'admin' || myMembership.role === 'director');

  const { data: songs } = await supabase
    .from('songs')
    .select('id, title, artist, original_key')
    .eq('church_id', church.id)
    .order('title');

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <Link href={`/churches/${church.slug}`} className="text-sm text-zinc-400 hover:text-white">
        ← {church.name}
      </Link>
      <header className="mt-4 mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Canzoni</h1>
        {canCreate && (
          <div className="flex gap-2">
            <Link
              href={`/churches/${church.slug}/songs/import`}
              className="px-3 py-1.5 rounded-md border border-border hover:border-accent text-sm"
            >
              Importa OnSong
            </Link>
            <Link
              href={`/churches/${church.slug}/songs/new`}
              className="px-3 py-1.5 rounded-md border border-accent text-accent hover:bg-accent/10 text-sm"
            >
              + Nuova
            </Link>
          </div>
        )}
      </header>

      {(songs ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-zinc-500">
          Non ci sono ancora canzoni. {canCreate && <>Inizia importando da OnSong.</>}
        </div>
      ) : (
        <div className="space-y-2">
          {(songs ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/churches/${church.slug}/songs/${s.id}`}
              className="block rounded-md border border-border bg-panel p-3 hover:border-accent transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.title}</div>
                  {s.artist && <div className="text-xs text-zinc-500">{s.artist}</div>}
                </div>
                {s.original_key && (
                  <span className="text-xs text-zinc-400 px-2 py-0.5 rounded bg-bg border border-border">
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
