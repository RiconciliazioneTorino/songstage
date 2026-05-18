import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SongViewer } from '@/app/churches/[slug]/songs/[songId]/song-viewer';
import { CanonicalActions } from './canonical-actions';

export default async function CanonicalSongPage({
  params,
}: {
  params: Promise<{ songId: string }>;
}) {
  const { songId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_curator')
    .eq('id', user.id)
    .maybeSingle();
  const isCurator = me?.is_curator === true;

  const { data: song } = await supabase
    .from('songs')
    .select('id, title, artist, original_key, default_tempo, current_version_id, church_id')
    .eq('id', songId)
    .maybeSingle();
  if (!song || song.church_id !== null) notFound();

  let body = '';
  if (song.current_version_id) {
    const { data: version } = await supabase
      .from('song_versions')
      .select('body_onsong')
      .eq('id', song.current_version_id)
      .maybeSingle();
    body = version?.body_onsong ?? '';
  }

  const { data: myChurches } = await supabase
    .from('church_members')
    .select('role, church:churches(id, slug, name)')
    .eq('user_id', user.id)
    .in('role', ['admin', 'director']);

  const adoptableChurches = (myChurches ?? [])
    .map((m: any) => m.church)
    .filter((c: any) => c) as { id: string; slug: string; name: string }[];

  const { data: adoptions } = await supabase
    .from('songs')
    .select('id, church:churches(slug, name)')
    .eq('parent_song_id', songId);

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto p-8">
        <Link href="/library" className="text-sm text-zinc-400 hover:text-white">
          ← Libreria canonica
        </Link>

        <CanonicalActions
          songId={song.id}
          songTitle={song.title}
          isCurator={isCurator}
          adoptableChurches={adoptableChurches}
          adoptions={
            (adoptions ?? []).map((a: any) => ({
              id: a.id,
              churchSlug: a.church?.slug ?? '',
              churchName: a.church?.name ?? '',
            }))
          }
        />

        <SongViewer body={body} />
      </div>
    </main>
  );
}
