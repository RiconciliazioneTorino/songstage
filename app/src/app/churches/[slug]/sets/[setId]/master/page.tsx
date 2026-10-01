import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Master } from './master';

export default async function MasterPage({
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
    .select('id, name, church_id')
    .eq('id', setId)
    .maybeSingle();
  if (!set) notFound();

  const [{ data: isOwnerOrLead }, { data: canWriteShared }] = await Promise.all([
    supabase.rpc('set_owner_or_church_lead', { p_set_id: setId }),
    supabase.rpc('can_write_set_shared', { p_set_id: setId }),
  ]);
  const canBeMaster = !!isOwnerOrLead || !!canWriteShared;

  const { data: availableSongs } = await supabase
    .from('songs')
    .select('id, title, artist, original_key')
    .eq('church_id', set.church_id)
    .order('title');

  const { data: items } = await supabase
    .from('set_items')
    .select(
      'id, position, transpose_semitones, capo, variation_id, song:songs(id, title, artist, original_key, current_version_id, default_tempo, time_signature)'
    )
    .eq('set_id', setId)
    .order('position');

  const itemList = (items ?? []) as any[];
  const versionIds = itemList
    .map((i) => i.song?.current_version_id)
    .filter((v): v is string => !!v);
  const variationIds = itemList
    .map((i) => i.variation_id)
    .filter((v): v is string => !!v);

  const versionsById = new Map<string, string>();
  if (versionIds.length > 0) {
    const { data: versions } = await supabase
      .from('song_versions')
      .select('id, body_onsong')
      .in('id', versionIds);
    (versions ?? []).forEach((v) => versionsById.set(v.id, v.body_onsong));
  }
  const variationsById = new Map<string, string>();
  if (variationIds.length > 0) {
    const { data: variations } = await supabase
      .from('song_variations')
      .select('id, body_onsong')
      .in('id', variationIds);
    (variations ?? []).forEach((v) => variationsById.set(v.id, v.body_onsong));
  }

  // All variations visible for the songs in this set, so the master can switch.
  const songIds = itemList.map((i) => i.song?.id).filter(Boolean);
  const variationsBySong = new Map<string, any[]>();
  const allVariationBodiesById = new Map<string, string>();
  if (songIds.length > 0) {
    const { data: allVars } = await supabase
      .from('song_variations')
      .select('id, song_id, name, scope, body_onsong, band:bands(name)')
      .in('song_id', songIds);
    for (const v of allVars ?? []) {
      const list = variationsBySong.get(v.song_id) ?? [];
      list.push({
        id: v.id,
        name: v.name,
        scope: v.scope,
        bandName: (v as any).band?.name ?? null,
      });
      variationsBySong.set(v.song_id, list);
      allVariationBodiesById.set(v.id, v.body_onsong);
    }
  }

  const slides = itemList.map((i) => ({
    itemId: i.id as string,
    songId: i.song.id as string,
    variationId: (i.variation_id as string | null) ?? null,
    title: i.song.title as string,
    artist: i.song.artist as string | null,
    originalKey: i.song.original_key as string | null,
    songTempo: (i.song.default_tempo as number | null) ?? null,
    songTimeSignature: (i.song.time_signature as string | null) ?? null,
    transpose: i.transpose_semitones as number,
    baseBody: versionsById.get(i.song.current_version_id ?? '') ?? '',
    body:
      (i.variation_id ? allVariationBodiesById.get(i.variation_id) ?? variationsById.get(i.variation_id) : null) ??
      versionsById.get(i.song.current_version_id ?? '') ??
      '',
    availableVariations: variationsBySong.get(i.song.id) ?? [],
    variationBodies: Object.fromEntries(
      (variationsBySong.get(i.song.id) ?? []).map((v) => [
        v.id,
        allVariationBodiesById.get(v.id) ?? '',
      ])
    ),
  }));

  return (
    <Master
      setId={set.id}
      setName={set.name}
      slug={slug}
      slides={slides}
      availableSongs={(availableSongs as any) ?? []}
      currentUserId={user.id}
      currentUserEmail={user.email ?? ''}
      canBeMaster={canBeMaster}
    />
  );
}
