import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SetEditor } from './set-editor';
import { SetHeader } from './set-header';
import { SharePanel } from './share-panel';

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ slug: string; setId: string }>;
}) {
  const { slug, setId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [churchRes, setRes] = await Promise.all([
    supabase.from('churches').select('id, name, slug').eq('slug', slug).maybeSingle(),
    supabase
      .from('sets')
      .select('id, name, event_date, event_type, notes')
      .eq('id', setId)
      .maybeSingle(),
  ]);
  const church = churchRes.data;
  const set = setRes.data;
  if (!church || !set) notFound();

  // Contents, picker and sharing panels are independent of each other.
  const [itemsRes, songsRes, sharesRes, bandSharesRes, churchBandsRes] = await Promise.all([
    supabase
      .from('set_items')
      .select(
        'id, position, transpose_semitones, capo, variation_id, performance_notes, song:songs(id, title, artist, original_key, church_id)'
      )
      .eq('set_id', setId)
      .order('position'),
    supabase
      .from('songs')
      .select('id, title, artist, original_key, church_id')
      .or(`church_id.eq.${church.id},church_id.is.null`)
      .order('title'),
    supabase
      .from('set_shares')
      .select('user_id, permission, user:users(email, display_name)')
      .eq('set_id', setId),
    supabase
      .from('set_band_shares')
      .select('band_id, permission, band:bands(id, name)')
      .eq('set_id', setId),
    supabase.from('bands').select('id, name').eq('church_id', church.id).order('name'),
  ]);

  const items = itemsRes.data;
  const shares = sharesRes.data;
  const bandShares = bandSharesRes.data;
  const churchBands = churchBandsRes.data;
  const songs = (songsRes.data ?? []).map((s: any) => ({
    id: s.id as string,
    title: s.title as string,
    artist: s.artist as string | null,
    original_key: s.original_key as string | null,
    isCanonical: s.church_id === null,
  }));

  // Variations visible to the user for the songs in this set
  const songIds = (items ?? []).map((i: any) => i.song?.id).filter(Boolean);
  const { data: vars } =
    songIds.length > 0
      ? await supabase
          .from('song_variations')
          .select('id, song_id, name, scope, scope_user_id, scope_band_id, band:bands(name)')
          .in('song_id', songIds)
      : { data: [] as any[] };

  const variationsBySong = new Map<string, any[]>();
  for (const v of vars ?? []) {
    const list = variationsBySong.get(v.song_id) ?? [];
    list.push(v);
    variationsBySong.set(v.song_id, list);
  }
  // Attach variations to items
  const itemsWithVariations = ((items as any[]) ?? []).map((i) => ({
    ...i,
    isCanonical: i.song?.church_id === null,
    availableVariations: variationsBySong.get(i.song?.id) ?? [],
  }));

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-3xl mx-auto">
      <Link href={`/churches/${church.slug}/sets`} className="text-sm text-zinc-400 hover:text-white">
        ← Set
      </Link>
      <div className="mt-4">
        <SetHeader slug={church.slug} set={set as any} />
      </div>

      <SetEditor
        setId={set.id}
        items={itemsWithVariations as any}
        availableSongs={songs}
      />

      <SharePanel
        setId={set.id}
        shares={(shares as any) ?? []}
        bandShares={(bandShares as any) ?? []}
        availableBands={(churchBands as any) ?? []}
      />
    </main>
  );
}
