import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Projector } from './projector';
import type { Slide } from '../master/master';

export default async function ProjectorPage({
  params,
}: {
  params: Promise<{ slug: string; setId: string }>;
}) {
  const { setId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: set } = await supabase.from('sets').select('id').eq('id', setId).maybeSingle();
  if (!set) notFound();

  const { data: items } = await supabase
    .from('set_items')
    .select(
      'id, position, transpose_semitones, capo, variation_id, song:songs(id, title, artist, original_key, current_version_id, church_id)'
    )
    .eq('set_id', setId)
    .order('position');

  // Only items whose song survived RLS are projectable.
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
    songTempo: null,
    songTimeSignature: null,
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

  return <Projector setId={set.id} slides={slides} />;
}
