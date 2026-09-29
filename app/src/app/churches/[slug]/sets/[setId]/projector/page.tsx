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
      'id, position, transpose_semitones, capo, variation_id, song:songs(id, title, artist, original_key, current_version_id)'
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

  const slides: Slide[] = itemList.map((i) => ({
    itemId: i.id as string,
    songId: i.song.id as string,
    variationId: (i.variation_id as string | null) ?? null,
    title: i.song.title as string,
    artist: i.song.artist as string | null,
    originalKey: i.song.original_key as string | null,
    transpose: i.transpose_semitones as number,
    body:
      (i.variation_id ? variationsById.get(i.variation_id) : null) ??
      versionsById.get(i.song.current_version_id ?? '') ??
      '',
  }));

  return <Projector setId={set.id} slides={slides} />;
}
