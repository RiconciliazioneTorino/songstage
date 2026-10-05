import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PdfImportForm } from './pdf-import-form';

export default async function ImportPdfPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: church } = await supabase
    .from('churches')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!church) notFound();

  const { data: membership } = await supabase
    .from('church_members')
    .select('role')
    .eq('church_id', church.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membership?.role !== 'admin') {
    redirect(`/churches/${slug}/songs`);
  }

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <Link
        href={`/churches/${slug}/songs`}
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← Canzoni
      </Link>
      <h1 className="text-3xl font-bold mt-4 mb-2">Importa da PDF</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Beta — solo per admin. Funziona con PDF generati digitalmente (OnSong,
        ChordPro, Word, Google Docs). Non funziona con PDF scansionati o foto
        (richiederebbero OCR).
      </p>
      <PdfImportForm slug={slug} />
    </main>
  );
}
