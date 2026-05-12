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

  const { data: church } = await supabase
    .from('churches')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!church) notFound();

  const { data: set } = await supabase
    .from('sets')
    .select('id, name, event_date, event_type, notes')
    .eq('id', setId)
    .maybeSingle();
  if (!set) notFound();

  const { data: items } = await supabase
    .from('set_items')
    .select('id, position, transpose_semitones, capo, performance_notes, song:songs(id, title, artist, original_key)')
    .eq('set_id', setId)
    .order('position');

  const { data: songs } = await supabase
    .from('songs')
    .select('id, title, artist, original_key')
    .eq('church_id', church.id)
    .order('title');

  const { data: shares } = await supabase
    .from('set_shares')
    .select('user_id, permission, user:users(email, display_name)')
    .eq('set_id', setId);

  const { data: bandShares } = await supabase
    .from('set_band_shares')
    .select('band_id, permission, band:bands(id, name)')
    .eq('set_id', setId);

  const { data: churchBands } = await supabase
    .from('bands')
    .select('id, name')
    .eq('church_id', church.id)
    .order('name');

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <Link href={`/churches/${church.slug}/sets`} className="text-sm text-zinc-400 hover:text-white">
        ← Set
      </Link>
      <div className="mt-4">
        <SetHeader slug={church.slug} set={set as any} />
      </div>

      <SetEditor
        setId={set.id}
        items={(items as any) ?? []}
        availableSongs={(songs as any) ?? []}
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
