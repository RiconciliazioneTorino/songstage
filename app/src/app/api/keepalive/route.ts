import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  // Lightweight read that goes through PostgREST so Supabase registers activity.
  const started = Date.now();
  const { error } = await supabase.from('churches').select('id', { head: true, count: 'exact' }).limit(1);
  const ms = Date.now() - started;

  return NextResponse.json({ ok: !error, ms, error: error?.message ?? null });
}
