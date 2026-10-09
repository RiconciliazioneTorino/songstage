import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Master, type Slide, type SlideVariation } from './master';

export default async function MasterPage({
  params,
}: {
  params: Promise<{ slug: string; setId: string }>;
}) {
  const { slug, setId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // One read covers both the set itself and the live-master indicator.
  const { data: set } = await supabase
    .from('sets')
    .select('id, name, church_id, active_master_user_id, active_master_heartbeat_at')
    .eq('id', setId)
    .maybeSingle();
  if (!set) notFound();

  const liveMasterUserId = (set.active_master_user_id as string | null) ?? null;
  const liveMasterHeartbeat = set.active_master_heartbeat_at
    ? new Date(set.active_master_heartbeat_at).getTime()
    : 0;

  // Permissions, the song picker and the set contents are independent.
  const [{ data: isOwnerOrLead }, { data: canWriteShared }, { data: availableSongs }, { data: items }] =
    await Promise.all([
      supabase.rpc('set_owner_or_church_lead', { p_set_id: setId }),
      supabase.rpc('can_write_set_shared', { p_set_id: setId }),
      supabase
        .from('songs')
        .select('id, title, artist, original_key, church_id')
        .or(`church_id.eq.${set.church_id},church_id.is.null`)
        .order('title'),
      supabase
        .from('set_items')
        .select(
          'id, position, transpose_semitones, capo, variation_id, song:songs(id, title, artist, original_key, current_version_id, default_tempo, time_signature, church_id)'
        )
        .eq('set_id', setId)
        .order('position'),
    ]);
  const canBeMaster = !!isOwnerOrLead || !!canWriteShared;
  // The full console is only useful to someone who can actually drive the
  // set. Everyone else lands on the simplified /view, which can offer a
  // "Richiedi master" button if they later gain rights.
  if (!canBeMaster) redirect(`/churches/${slug}/sets/${setId}/view`);

  // Only items whose song survived RLS are projectable.
  const itemList = (items ?? []).flatMap((i) => (i.song ? [{ ...i, song: i.song }] : []));
  const versionIds = itemList
    .map((i) => i.song.current_version_id)
    .filter((v): v is string => !!v);
  const songIds = itemList.map((i) => i.song.id);

  // Current bodies, every variation the user can see for these songs, and any
  // YouTube link attached — fetched together so the leader can switch variation
  // or hit play without another round trip.
  const [versionsRes, allVarsRes, audioRes] = await Promise.all([
    versionIds.length > 0
      ? supabase.from('song_versions').select('id, body_onsong').in('id', versionIds)
      : { data: [] },
    songIds.length > 0
      ? supabase
          .from('song_variations')
          .select('id, song_id, name, scope, body_onsong, band:bands(name)')
          .in('song_id', songIds)
      : { data: [] },
    songIds.length > 0
      ? supabase
          .from('audio_attachments')
          .select('song_id, kind, url, created_at')
          .in('song_id', songIds)
          .eq('kind', 'youtube')
          .order('created_at')
      : { data: [] },
  ]);

  const versionsById = new Map<string, string>();
  for (const v of versionsRes.data ?? []) versionsById.set(v.id, v.body_onsong);

  const youtubeBySong = new Map<string, string>();
  for (const a of audioRes.data ?? []) {
    if (!youtubeBySong.has(a.song_id as string) && typeof a.url === 'string') {
      youtubeBySong.set(a.song_id as string, a.url);
    }
  }

  const variationsBySong = new Map<string, SlideVariation[]>();
  const variationBodiesById = new Map<string, string>();
  for (const v of allVarsRes.data ?? []) {
    const list = variationsBySong.get(v.song_id) ?? [];
    list.push({
      id: v.id,
      name: v.name,
      scope: v.scope,
      bandName: v.band?.name ?? null,
    });
    variationsBySong.set(v.song_id, list);
    variationBodiesById.set(v.id, v.body_onsong);
  }

  const slides: Slide[] = itemList.map((i) => ({
    itemId: i.id,
    songId: i.song.id,
    variationId: i.variation_id,
    title: i.song.title,
    artist: i.song.artist,
    originalKey: i.song.original_key,
    songTempo: i.song.default_tempo,
    songTimeSignature: i.song.time_signature,
    youtubeUrl: youtubeBySong.get(i.song.id) ?? null,
    isCanonical: i.song.church_id === null,
    transpose: i.transpose_semitones,
    baseBody: versionsById.get(i.song.current_version_id ?? '') ?? '',
    body:
      (i.variation_id ? variationBodiesById.get(i.variation_id) : null) ??
      versionsById.get(i.song.current_version_id ?? '') ??
      '',
    availableVariations: variationsBySong.get(i.song.id) ?? [],
    variationBodies: Object.fromEntries(
      (variationsBySong.get(i.song.id) ?? []).map((v) => [
        v.id,
        variationBodiesById.get(v.id) ?? '',
      ])
    ),
  }));

  return (
    <Master
      setId={set.id}
      setName={set.name}
      slug={slug}
      slides={slides}
      availableSongs={(availableSongs ?? []).map((s) => ({
        id: s.id as string,
        title: s.title as string,
        artist: s.artist as string | null,
        original_key: s.original_key as string | null,
        isCanonical: s.church_id === null,
      }))}
      currentUserId={user.id}
      currentUserEmail={user.email ?? ''}
      canBeMaster={canBeMaster}
      liveMasterUserId={liveMasterUserId}
      liveMasterHeartbeat={liveMasterHeartbeat}
    />
  );
}
