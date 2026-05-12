import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function SetsPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const { data: sets } = await supabase
    .from('sets')
    .select('id, name, event_date, event_type')
    .eq('church_id', church.id)
    .order('event_date', { ascending: false, nullsFirst: false });

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <Link href={`/churches/${church.slug}`} className="text-sm text-zinc-400 hover:text-white">
        ← {church.name}
      </Link>
      <header className="mt-4 mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Set</h1>
        <Link
          href={`/churches/${church.slug}/sets/new`}
          className="px-3 py-1.5 rounded-md border border-accent text-accent hover:bg-accent/10 text-sm"
        >
          + Nuovo
        </Link>
      </header>

      {(sets ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-zinc-500">
          Nessun set ancora.
        </div>
      ) : (
        <div className="space-y-2">
          {(sets ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/churches/${church.slug}/sets/${s.id}`}
              className="block rounded-md border border-border bg-panel p-3 hover:border-accent transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.name}</div>
                  {s.event_type && <div className="text-xs text-zinc-500">{s.event_type}</div>}
                </div>
                {s.event_date && (
                  <span className="text-xs text-zinc-400">{s.event_date}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
