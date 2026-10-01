import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SongViewer, type Track } from './song-viewer';
import { VersionsPanel } from './versions-panel';
import { DeleteSongButton } from './delete-button';
import { AudioPanel } from './audio-panel';
import { VariationsActions } from './variations-actions';
import { PromoteCanonicalButton } from './promote-canonical-button';

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
    .select('id, title, artist, original_key, default_tempo, current_version_id, church_id, parent_song_id, parent:songs!parent_song_id(id, title)')
    .eq('id', songId)
    .maybeSingle();
  if (!song) notFound();
  const parent = (song as any).parent as { id: string; title: string } | null;

  const { data: myMembership } = await supabase
    .from('church_members')
    .select('role')
    .eq('church_id', song.church_id!)
    .eq('user_id', user.id)
    .maybeSingle();
  const canEdit = myMembership?.role === 'admin' || myMembership?.role === 'director';

  const { data: me } = await supabase
    .from('users')
    .select('is_curator')
    .eq('id', user.id)
    .maybeSingle();
  const isCurator = !!(me?.is_curator as boolean | null);
  const canPromote = isCurator && !song.parent_song_id;

  let baseBody = '';
  if (song.current_version_id) {
    const { data: version } = await supabase
      .from('song_versions')
      .select('body_onsong')
      .eq('id', song.current_version_id)
      .maybeSingle();
    baseBody = version?.body_onsong ?? '';
  } else {
    const { data: latest } = await supabase
      .from('song_versions')
      .select('body_onsong')
      .eq('song_id', songId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    baseBody = latest?.body_onsong ?? '';
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

  // Variations visible to me: user-scope (mine) + band-scope (any band I'm in for this church)
  const { data: variations } = await supabase
    .from('song_variations')
    .select('id, name, scope, scope_user_id, scope_band_id, body_onsong, band:bands(id, name)')
    .eq('song_id', songId);

  const myBandsInChurch = await supabase
    .from('band_members')
    .select('band_id, band:bands(id, name, church_id)')
    .eq('user_id', user.id);

  const myBands = ((myBandsInChurch.data ?? []) as any[])
    .filter((bm) => bm.band?.church_id === song.church_id)
    .map((bm) => ({ id: bm.band.id as string, name: bm.band.name as string }));
  const myBandIds = new Set(myBands.map((b) => b.id));

  const myUserVariation = (variations ?? []).find(
    (v: any) => v.scope === 'user' && v.scope_user_id === user.id
  ) as any;
  const myBandVariations = (variations ?? []).filter(
    (v: any) => v.scope === 'band' && myBandIds.has(v.scope_band_id)
  ) as any[];

  const tracks: Track[] = [
    {
      id: 'base',
      label: 'Base (chiesa)',
      body: baseBody,
      editHref: canEdit ? `/churches/${slug}/songs/${songId}/edit` : undefined,
    },
    ...myBandVariations.map((v) => ({
      id: `band:${v.id}`,
      label: v.name,
      body: v.body_onsong,
      badge: `gruppo ${v.band?.name ?? ''}`,
      editHref: `/churches/${slug}/songs/${songId}/variations/${v.id}/edit`,
    })),
    ...(myUserVariation
      ? [
          {
            id: `user:${myUserVariation.id}`,
            label: myUserVariation.name,
            body: myUserVariation.body_onsong,
            badge: 'personale',
            editHref: `/churches/${slug}/songs/${songId}/variations/${myUserVariation.id}/edit`,
          },
        ]
      : []),
  ];

  // Default to most specific: user > band > base
  const defaultTrackId = myUserVariation
    ? `user:${myUserVariation.id}`
    : myBandVariations.length > 0
    ? `band:${myBandVariations[0].id}`
    : 'base';

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
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {canPromote && (
              <PromoteCanonicalButton songId={songId} title={song.title} />
            )}
            {canEdit && (
              <>
                <Link
                  href={`/churches/${slug}/songs/${songId}/edit`}
                  className="text-sm px-3 py-1 rounded-md border border-border hover:border-accent"
                >
                  Modifica base
                </Link>
                <DeleteSongButton slug={slug} songId={songId} title={song.title} />
              </>
            )}
          </div>
        </div>
        {parent && (
          <div className="mt-3 text-xs text-zinc-500">
            Adottata da{' '}
            <Link
              href={`/library/${parent.id}`}
              className="text-accent hover:underline"
            >
              {parent.title}
            </Link>{' '}
            (libreria canonica)
          </div>
        )}

        <SongViewer tracks={tracks} defaultTrackId={defaultTrackId} />

        <VariationsActions
          slug={slug}
          songId={songId}
          hasUserVariation={!!myUserVariation}
          myBands={myBands}
          bandVariationsBandIds={myBandVariations.map((v) => v.scope_band_id)}
        />

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
