import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SongsExplorer } from './songs-explorer';

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

  // Membership and the song list don't depend on each other — fetch in parallel.
  const [membershipRes, songsRes] = await Promise.all([
    supabase
      .from('church_members')
      .select('role')
      .eq('church_id', church.id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('songs')
      .select(
        `id, title, artist, original_key, default_tempo, time_signature, church_id,
         current_version:song_versions!songs_current_version_fk(version_number),
         audio_attachments(kind)`
      )
      .or(`church_id.eq.${church.id},church_id.is.null`)
      .order('title'),
  ]);
  const myMembership = membershipRes.data;
  const songs = songsRes.data;
  const canCreate =
    !!myMembership && (myMembership.role === 'admin' || myMembership.role === 'director');
  const isAdmin = myMembership?.role === 'admin';

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-3xl mx-auto">
      <Link href={`/churches/${church.slug}`} className="text-sm text-zinc-400 hover:text-white">
        ← {church.name}
      </Link>
      <header className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Canzoni</h1>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/churches/${church.slug}/songs/import`}
              className="inline-flex items-center justify-center gap-1.5 min-w-[2.25rem] px-3 py-1.5 rounded-full border border-border hover:border-accent text-sm"
              title="Importa OnSong"
              aria-label="Importa OnSong"
            >
              <span aria-hidden>📥</span>
              <span className="hidden sm:inline">Importa OnSong</span>
            </Link>
            {isAdmin && (
              <Link
                href={`/churches/${church.slug}/songs/import-pdf`}
                className="inline-flex items-center justify-center gap-1.5 min-w-[2.25rem] px-3 py-1.5 rounded-full border border-border hover:border-accent text-sm"
                title="Importa una canzone da un PDF (solo admin, beta)"
                aria-label="Importa PDF"
              >
                <span aria-hidden>📄</span>
                <span className="hidden sm:inline">Importa PDF</span>
              </Link>
            )}
            <Link
              href={`/churches/${church.slug}/songs/new`}
              className="inline-flex items-center justify-center gap-1.5 min-w-[2.25rem] px-3 py-1.5 rounded-full border border-accent text-accent hover:bg-accent/10 text-sm"
              title="Nuova canzone"
              aria-label="Nuova canzone"
            >
              <span aria-hidden>+</span>
              <span className="hidden sm:inline">Nuova</span>
            </Link>
          </div>
        )}
      </header>

      {(songs ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-zinc-500">
          Non ci sono ancora canzoni. {canCreate && <>Inizia importando da OnSong.</>}
        </div>
      ) : (
        <SongsExplorer slug={church.slug} songs={songs ?? []} canManage={canCreate} />
      )}
    </main>
  );
}
