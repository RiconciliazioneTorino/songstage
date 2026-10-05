import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const LIVE_THRESHOLD_MS = 45_000;

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
    .select('id, name, event_date, event_type, created_by, active_master_heartbeat_at')
    .eq('church_id', church.id)
    .order('event_date', { ascending: false, nullsFirst: false });

  const list = sets ?? [];
  const setIds = list.map((s: any) => s.id);
  const creatorIds = Array.from(
    new Set(list.map((s: any) => s.created_by).filter(Boolean))
  );

  // Creators + counts fetched in parallel — they don't depend on each other.
  const [creatorsRes, itemsRes] = await Promise.all([
    creatorIds.length > 0
      ? supabase
          .from('users')
          .select('id, email, display_name')
          .in('id', creatorIds)
      : Promise.resolve({ data: [] as any[] }),
    setIds.length > 0
      ? supabase.from('set_items').select('set_id').in('set_id', setIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const creatorsMap = new Map<string, { email: string; display_name: string | null }>();
  for (const c of creatorsRes.data ?? []) {
    creatorsMap.set(c.id as string, {
      email: c.email as string,
      display_name: c.display_name as string | null,
    });
  }

  const countsMap = new Map<string, number>();
  for (const it of itemsRes.data ?? []) {
    const sid = it.set_id as string;
    countsMap.set(sid, (countsMap.get(sid) ?? 0) + 1);
  }

  const now = Date.now();
  const rows = list.map((s: any) => {
    const heartbeat = s.active_master_heartbeat_at
      ? new Date(s.active_master_heartbeat_at).getTime()
      : 0;
    const creator = creatorsMap.get(s.created_by);
    return {
      id: s.id as string,
      name: s.name as string,
      event_date: s.event_date as string | null,
      event_type: s.event_type as string | null,
      creatorLabel: creator?.display_name || creator?.email || '',
      itemsCount: countsMap.get(s.id) ?? 0,
      isLive: heartbeat > 0 && now - heartbeat < LIVE_THRESHOLD_MS,
    };
  });

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-3xl mx-auto">
      <Link href={`/churches/${church.slug}`} className="text-sm text-zinc-400 hover:text-white">
        ← {church.name}
      </Link>
      <header className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Set</h1>
        <Link
          href={`/churches/${church.slug}/sets/new`}
          className="inline-flex items-center justify-center gap-1.5 min-w-[2.25rem] px-3 py-1.5 rounded-full border border-accent text-accent hover:bg-accent/10 text-sm"
          title="Nuovo set"
          aria-label="Nuovo set"
        >
          <span aria-hidden>+</span>
          <span className="hidden sm:inline">Nuovo</span>
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-zinc-500">
          Nessun set ancora.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/churches/${church.slug}/sets/${s.id}`}
              className="block rounded-md border border-border bg-panel p-3 hover:border-accent transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-y-2 gap-x-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    <span className="truncate">{s.name}</span>
                    {s.isLive && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold text-red-100 bg-red-600/80 rounded-full px-1.5 py-0.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75 animate-ping" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-100" />
                        </span>
                        In diretta
                      </span>
                    )}
                  </div>
                  {s.event_type && (
                    <div className="text-xs text-zinc-500 mt-0.5">{s.event_type}</div>
                  )}
                </div>
                <div className="flex items-center flex-wrap gap-1.5 sm:flex-shrink-0 sm:justify-end">
                  {s.event_date && (
                    <span
                      title="Data evento"
                      className="text-xs text-sky-300 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/40 font-mono"
                    >
                      {s.event_date}
                    </span>
                  )}
                  <span
                    title={`${s.itemsCount} ${s.itemsCount === 1 ? 'canzone' : 'canzoni'}`}
                    className="text-xs text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 font-mono"
                  >
                    {s.itemsCount} {s.itemsCount === 1 ? 'canzone' : 'canzoni'}
                  </span>
                  {s.creatorLabel && (
                    <span
                      title="Creato da"
                      className="text-xs text-violet-300 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/40"
                    >
                      {s.creatorLabel}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
