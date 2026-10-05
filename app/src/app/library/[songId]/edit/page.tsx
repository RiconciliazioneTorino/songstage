import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EditCanonicalForm } from './edit-form';

export default async function EditCanonicalPage({
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
  if (!me?.is_curator) redirect(`/library/${songId}`);

  const { data: song } = await supabase
    .from('songs')
    .select('id, title, current_version_id, church_id')
    .eq('id', songId)
    .maybeSingle();
  if (!song || song.church_id !== null) notFound();

  let body = '';
  if (song.current_version_id) {
    const { data: v } = await supabase
      .from('song_versions')
      .select('body_onsong')
      .eq('id', song.current_version_id)
      .maybeSingle();
    body = v?.body_onsong ?? '';
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-3xl mx-auto">
      <Link href={`/library/${songId}`} className="text-sm text-zinc-400 hover:text-white">
        ← {song.title}
      </Link>
      <h1 className="text-3xl font-bold mt-4 mb-6">Modifica canonica</h1>
      <EditCanonicalForm songId={songId} initialBody={body} />
    </main>
  );
}
