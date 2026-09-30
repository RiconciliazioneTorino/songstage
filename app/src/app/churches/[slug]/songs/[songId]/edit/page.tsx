import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EditSongForm } from './edit-form';

export default async function EditSongPage({
  params,
}: {
  params: Promise<{ slug: string; songId: string }>;
}) {
  const { slug, songId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: song } = await supabase
    .from('songs')
    .select('id, title, current_version_id, church:churches(id, slug)')
    .eq('id', songId)
    .maybeSingle();
  if (!song) notFound();

  let body = '';
  if (song.current_version_id) {
    const { data: version } = await supabase
      .from('song_versions')
      .select('body_onsong')
      .eq('id', song.current_version_id)
      .maybeSingle();
    body = version?.body_onsong ?? '';
  }

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <Link
        href={`/churches/${slug}/songs/${songId}`}
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← {song.title}
      </Link>
      <h1 className="text-3xl font-bold mt-4 mb-6">Modifica canzone</h1>
      <EditSongForm slug={slug} songId={songId} initialBody={body} />
    </main>
  );
}
