import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseOnSongBackup } from '@/lib/songs/import';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!church) return NextResponse.json({ error: 'Chiesa non trovata' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File mancante' }, { status: 400 });
  }
  if (file.size > 200 * 1024 * 1024) {
    return NextResponse.json({ error: 'File troppo grande (max 200MB)' }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseOnSongBackup(buf);
  } catch (e) {
    return NextResponse.json({ error: `Impossibile aprire lo zip: ${(e as Error).message}` }, { status: 400 });
  }

  const created: { title: string; id: string }[] = [];
  const failed: { title: string; error: string }[] = [];

  for (const row of parsed.rows) {
    const { data: song, error: songErr } = await supabase
      .from('songs')
      .insert({
        church_id: church.id,
        title: row.title,
        artist: row.artist,
        original_key: row.originalKey,
        default_tempo: row.tempo,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (songErr || !song) {
      failed.push({ title: row.title, error: songErr?.message ?? 'unknown' });
      continue;
    }

    const { data: version, error: vErr } = await supabase
      .from('song_versions')
      .insert({
        song_id: song.id,
        version_number: 1,
        body_onsong: row.body,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (vErr || !version) {
      failed.push({ title: row.title, error: `versión: ${vErr?.message ?? 'unknown'}` });
      continue;
    }

    await supabase
      .from('songs')
      .update({ current_version_id: version.id })
      .eq('id', song.id);

    created.push({ title: row.title, id: song.id });
  }

  return NextResponse.json({
    imported: created.length,
    failedCount: failed.length,
    skippedCount: parsed.skipped.length,
    failed,
    skipped: parsed.skipped,
  });
}
