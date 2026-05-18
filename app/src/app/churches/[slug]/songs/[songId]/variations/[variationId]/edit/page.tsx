import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EditVariationForm } from './edit-form';

export default async function EditVariationPage({
  params,
}: {
  params: Promise<{ slug: string; songId: string; variationId: string }>;
}) {
  const { slug, songId, variationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: variation } = await supabase
    .from('song_variations')
    .select('id, name, body_onsong, scope, scope_user_id, scope_band_id, song_id, band:bands(name)')
    .eq('id', variationId)
    .maybeSingle();
  if (!variation || variation.song_id !== songId) notFound();

  const v = variation as any;
  const scopeLabel =
    v.scope === 'user' ? 'Variante personale' : `Variante gruppo ${v.band?.name ?? ''}`;

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <Link
        href={`/churches/${slug}/songs/${songId}`}
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← Canzone
      </Link>
      <header className="mt-4 mb-6">
        <h1 className="text-3xl font-bold">Modifica variante</h1>
        <p className="text-sm text-zinc-400 mt-1">{scopeLabel}</p>
      </header>

      <EditVariationForm
        slug={slug}
        songId={songId}
        variationId={variationId}
        initialName={v.name}
        initialBody={v.body_onsong}
      />
    </main>
  );
}
