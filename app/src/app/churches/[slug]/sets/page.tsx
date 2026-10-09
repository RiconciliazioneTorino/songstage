import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { splitByDate, todayInRome } from '@/lib/sets/schedule';

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
  const setIds = list.map((s) => s.id);
  const creatorIds = Array.from(
    new Set(list.map((s) => s.created_by).filter((id): id is string => !!id))
  );

  // Creators + counts fetched in parallel — they don't depend on each other.
  const [creatorsRes, itemsRes] = await Promise.all([
    creatorIds.length > 0
      ? supabase.from('users').select('id, email, display_name').in('id', creatorIds)
      : { data: [] },
    setIds.length > 0
      ? supabase.from('set_items').select('set_id').in('set_id', setIds)
      : { data: [] },
  ]);

  const creatorsMap = new Map(
    (creatorsRes.data ?? []).map((c) => [c.id, c] as const)
  );

  const countsMap = new Map<string, number>();
  for (const it of itemsRes.data ?? []) {
    countsMap.set(it.set_id, (countsMap.get(it.set_id) ?? 0) + 1);
  }

  const now = Date.now();
  const rows = list.map((s) => {
    const heartbeat = s.active_master_heartbeat_at
      ? new Date(s.active_master_heartbeat_at).getTime()
      : 0;
    const creator = s.created_by ? creatorsMap.get(s.created_by) : undefined;
    return {
      id: s.id,
      name: s.name,
      event_date: s.event_date,
      event_type: s.event_type,
      creatorLabel: creator?.display_name || creator?.email || '',
      itemsCount: countsMap.get(s.id) ?? 0,
      isLive: heartbeat > 0 && now - heartbeat < LIVE_THRESHOLD_MS,
    };
  });

  const { current, past } = splitByDate(rows, todayInRome());

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
        <>
          {current.length > 0 ? (
            <div className="space-y-2">
              {current.map((s) => (
                <SetCard key={s.id} set={s} slug={church.slug} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-zinc-500">
              Nessun set in programma.
            </div>
          )}

          {past.length > 0 && (
            // A plain <details> keeps this a server component: no state, no
            // JavaScript, and it still works before React has loaded.
            <details className="mt-6 group">
              <summary className="cursor-pointer list-none select-none text-sm text-zinc-400 hover:text-white flex items-center gap-2 py-2">
                <span className="transition-transform group-open:rotate-90" aria-hidden>
                  ▶
                </span>
                Set passati ({past.length})
              </summary>
              <div className="space-y-2 mt-2 opacity-70">
                {past.map((s) => (
                  <SetCard key={s.id} set={s} slug={church.slug} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </main>
  );
}

type SetRow = {
  id: string;
  name: string;
  event_date: string | null;
  event_type: string | null;
  creatorLabel: string;
  itemsCount: number;
  isLive: boolean;
};

function SetCard({ set: s, slug }: { set: SetRow; slug: string }) {
  return (
    <Link
      href={`/churches/${slug}/sets/${s.id}`}
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
          {s.event_type && <div className="text-xs text-zinc-500 mt-0.5">{s.event_type}</div>}
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
  );
}
