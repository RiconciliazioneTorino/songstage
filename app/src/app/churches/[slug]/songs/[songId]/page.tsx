import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SongViewer } from './song-viewer';
import { VersionsPanel } from './versions-panel';
import { DeleteSongButton } from './delete-button';
import { AudioPanel } from './audio-panel';

export default async function SongPage({
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
    .select('id, title, artist, original_key, default_tempo, current_version_id, church_id')
    .eq('id', songId)
    .maybeSingle();
  if (!song) notFound();

  const { data: myMembership } = await supabase
    .from('church_members')
    .select('role')
    .eq('church_id', song.church_id!)
    .eq('user_id', user.id)
    .maybeSingle();
  const canEdit = myMembership?.role === 'admin' || myMembership?.role === 'director';

  let body = '';
  if (song.current_version_id) {
    const { data: version } = await supabase
      .from('song_versions')
      .select('body_onsong')
      .eq('id', song.current_version_id)
      .maybeSingle();
    body = version?.body_onsong ?? '';
  } else {
    const { data: latest } = await supabase
      .from('song_versions')
      .select('body_onsong')
      .eq('song_id', songId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    body = latest?.body_onsong ?? '';
  }

  const { data: versions } = await supabase
    .from('song_versions')
    .select('id, version_number, notes, created_at, created_by:users(display_name, email)')
    .eq('song_id', songId)
    .order('version_number', { ascending: false });

  const { data: audios } = await supabase
    .from('audio_attachments')
    .select('id, kind, url, storage_path')
    .eq('song_id', songId)
    .order('created_at');

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto p-8">
        <div className="flex items-center justify-between">
          <Link
            href={`/churches/${slug}/songs`}
            className="text-sm text-zinc-400 hover:text-white"
          >
            ← Canzoni
          </Link>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Link
                href={`/churches/${slug}/songs/${songId}/edit`}
                className="text-sm px-3 py-1 rounded-md border border-border hover:border-accent"
              >
                Modifica
              </Link>
              <DeleteSongButton slug={slug} songId={songId} title={song.title} />
            </div>
          )}
        </div>
        <SongViewer body={body} />
        <AudioPanel songId={songId} audios={(audios as any) ?? []} canEdit={canEdit} />
        <VersionsPanel
          slug={slug}
          songId={songId}
          currentVersionId={song.current_version_id}
          versions={(versions as any) ?? []}
          canEdit={canEdit}
        />
      </div>
    </main>
  );
}
