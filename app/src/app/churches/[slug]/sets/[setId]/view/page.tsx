import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ViewConsole } from './view';
import type { Slide } from '../master/master';

export default async function ViewPage({
  params,
}: {
  params: Promise<{ slug: string; setId: string }>;
}) {
  const { slug, setId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: set } = await supabase
    .from('sets')
    .select('id, name, active_master_user_id, active_master_heartbeat_at')
    .eq('id', setId)
    .maybeSingle();
  if (!set) notFound();

  // Same permission check the master route uses: owner / church lead or
  // explicit write grant. Determines whether to show the "Richiedi master"
  // affordance in the viewer UI.
  const [{ data: isOwnerOrLead }, { data: canWriteShared }, { data: items }] =
    await Promise.all([
      supabase.rpc('set_owner_or_church_lead', { p_set_id: setId }),
      supabase.rpc('can_write_set_shared', { p_set_id: setId }),
      supabase
        .from('set_items')
        .select(
          'id, position, transpose_semitones, capo, variation_id, song:songs(id, title, artist, original_key, current_version_id, default_tempo, time_signature, church_id)'
        )
        .eq('set_id', setId)
        .order('position'),
    ]);
  const canBeMaster = !!isOwnerOrLead || !!canWriteShared;

  const itemList = (items ?? []).flatMap((i) => (i.song ? [{ ...i, song: i.song }] : []));
  const versionIds = itemList
    .map((i) => i.song.current_version_id)
    .filter((v): v is string => !!v);
  const variationIds = itemList
    .map((i) => i.variation_id)
    .filter((v): v is string => !!v);

  const [versionsRes, variationsRes] = await Promise.all([
    versionIds.length > 0
      ? supabase.from('song_versions').select('id, body_onsong').in('id', versionIds)
      : { data: [] },
    variationIds.length > 0
      ? supabase.from('song_variations').select('id, body_onsong').in('id', variationIds)
      : { data: [] },
  ]);

  const versionsById = new Map<string, string>();
  for (const v of versionsRes.data ?? []) versionsById.set(v.id, v.body_onsong);
  const variationsById = new Map<string, string>();
  for (const v of variationsRes.data ?? []) variationsById.set(v.id, v.body_onsong);

  const slides: Slide[] = itemList.map((i) => ({
    itemId: i.id,
    songId: i.song.id,
    variationId: i.variation_id,
    title: i.song.title,
    artist: i.song.artist,
    originalKey: i.song.original_key,
    songTempo: i.song.default_tempo,
    songTimeSignature: i.song.time_signature,
    youtubeUrl: null,
    isCanonical: i.song.church_id === null,
    transpose: i.transpose_semitones,
    baseBody: '',
    availableVariations: [],
    variationBodies: {},
    body:
      (i.variation_id ? variationsById.get(i.variation_id) : null) ??
      versionsById.get(i.song.current_version_id ?? '') ??
      '',
  }));

  const liveMasterUserId = (set.active_master_user_id as string | null) ?? null;
  const liveMasterHeartbeat = set.active_master_heartbeat_at
    ? new Date(set.active_master_heartbeat_at).getTime()
    : 0;
  const liveMasterIsFresh =
    liveMasterUserId !== null && Date.now() - liveMasterHeartbeat < 45_000;

  return (
    <ViewConsole
      slug={slug}
      setId={set.id}
      setName={set.name}
      slides={slides}
      canBeMaster={canBeMaster}
      currentUserId={user.id}
      currentUserEmail={user.email ?? ''}
      liveMasterIsFresh={liveMasterIsFresh && liveMasterUserId !== user.id}
    />
  );
}
