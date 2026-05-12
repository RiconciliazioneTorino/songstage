import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BandMembersPanel } from './band-members-panel';

export default async function BandDetailPage({
  params,
}: {
  params: Promise<{ slug: string; bandId: string }>;
}) {
  const { slug, bandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: church } = await supabase
    .from('churches')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!church) notFound();

  const { data: band } = await supabase
    .from('bands')
    .select('id, name, church_id')
    .eq('id', bandId)
    .maybeSingle();
  if (!band || band.church_id !== church.id) notFound();

  const { data: myMembership } = await supabase
    .from('church_members')
    .select('role')
    .eq('church_id', church.id)
    .eq('user_id', user.id)
    .maybeSingle();
  const canManage = myMembership?.role === 'admin' || myMembership?.role === 'director';

  const { data: bandMembers } = await supabase
    .from('band_members')
    .select('user_id, user:users(id, email, display_name)')
    .eq('band_id', bandId);

  const { data: churchMembers } = await supabase
    .from('church_members')
    .select('role, user:users(id, email, display_name)')
    .eq('church_id', church.id);

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <Link
        href={`/churches/${church.slug}`}
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← {church.name}
      </Link>
      <header className="mt-4 mb-6">
        <h1 className="text-3xl font-bold">{band.name}</h1>
      </header>

      <BandMembersPanel
        churchSlug={church.slug}
        bandId={band.id}
        bandName={band.name}
        bandMembers={(bandMembers as any) ?? []}
        churchMembers={(churchMembers as any) ?? []}
        canManage={canManage}
      />
    </main>
  );
}
