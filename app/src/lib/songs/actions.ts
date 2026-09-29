'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseOnSong } from '@/lib/onsong';

export async function createSong(
  churchSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return { error: 'Incolla il contenuto OnSong della canzone' };

  const titleOverride = String(formData.get('title') ?? '').trim();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .maybeSingle();
  if (!church) return { error: 'Chiesa non trovata' };

  const parsed = parseOnSong(body);
  const title = titleOverride || parsed.meta.title || 'Senza titolo';
  const tempo = parsed.meta.tempo ? parseInt(parsed.meta.tempo, 10) : null;

  const { data: song, error: songErr } = await supabase
    .from('songs')
    .insert({
      church_id: church.id,
      title,
      artist: parsed.meta.artist ?? null,
      original_key: parsed.meta.key ?? null,
      default_tempo: Number.isFinite(tempo) ? tempo : null,
      time_signature: parsed.meta.time ?? null,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (songErr) return { error: songErr.message };

  const { data: version, error: versionErr } = await supabase
    .from('song_versions')
    .insert({
      song_id: song.id,
      version_number: 1,
      body_onsong: body,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (versionErr) return { error: versionErr.message };

  await supabase
    .from('songs')
    .update({ current_version_id: version.id })
    .eq('id', song.id);

  revalidatePath(`/churches/${churchSlug}/songs`);
  redirect(`/churches/${churchSlug}/songs/${song.id}`);
}

export async function updateSong(
  churchSlug: string,
  songId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return { error: 'Il body non può essere vuoto' };
  const versionNotes = String(formData.get('notes') ?? '').trim() || null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: lastVersion } = await supabase
    .from('song_versions')
    .select('version_number, body_onsong')
    .eq('song_id', songId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastVersion?.body_onsong === body) {
    return { error: 'Nessuna modifica rispetto alla versione attuale' };
  }

  const nextNumber = (lastVersion?.version_number ?? 0) + 1;
  const parsed = parseOnSong(body);
  const tempo = parsed.meta.tempo ? parseInt(parsed.meta.tempo, 10) : null;

  const { data: version, error: versionErr } = await supabase
    .from('song_versions')
    .insert({
      song_id: songId,
      version_number: nextNumber,
      body_onsong: body,
      notes: versionNotes,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (versionErr) return { error: versionErr.message };

  const { error: songErr } = await supabase
    .from('songs')
    .update({
      current_version_id: version.id,
      title: parsed.meta.title ?? undefined,
      artist: parsed.meta.artist ?? null,
      original_key: parsed.meta.key ?? null,
      default_tempo: Number.isFinite(tempo) ? tempo : null,
      time_signature: parsed.meta.time ?? null,
    })
    .eq('id', songId);
  if (songErr) return { error: songErr.message };

  // If the caller transposed the base version, compensate every set_item that
  // uses this song so its projected key stays the same. new_transpose = old - shift.
  const rawShift = Number(formData.get('keyShift') ?? 0);
  const keyShift = Number.isFinite(rawShift) ? Math.trunc(rawShift) : 0;
  if (keyShift !== 0) {
    const { data: items } = await supabase
      .from('set_items')
      .select('id, transpose_semitones')
      .eq('song_id', songId);
    for (const it of items ?? []) {
      await supabase
        .from('set_items')
        .update({ transpose_semitones: (it.transpose_semitones ?? 0) - keyShift })
        .eq('id', it.id);
    }
  }

  revalidatePath(`/churches/${churchSlug}/songs/${songId}`);
  redirect(`/churches/${churchSlug}/songs/${songId}`);
}

function detectAudioKind(url: string): 'youtube' | 'spotify' | 'amazon' | 'soundcloud' | 'other' {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('spotify.com')) return 'spotify';
  if (u.includes('music.amazon')) return 'amazon';
  if (u.includes('soundcloud.com')) return 'soundcloud';
  return 'other';
}

export async function addSongAudioLink(
  songId: string,
  url: string
): Promise<{ error?: string }> {
  const trimmed = url.trim();
  if (!trimmed) return { error: 'URL vuota' };
  try {
    new URL(trimmed);
  } catch {
    return { error: 'URL non valida' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { error } = await supabase.from('audio_attachments').insert({
    song_id: songId,
    kind: detectAudioKind(trimmed),
    url: trimmed,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/churches/[slug]/songs/${songId}`, 'page');
  return {};
}

export async function removeSongAudio(audioId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('audio_attachments').delete().eq('id', audioId);
  if (error) return { error: error.message };
  return {};
}

export async function deleteSong(
  churchSlug: string,
  songId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { count, error: countErr } = await supabase
    .from('set_items')
    .select('id', { count: 'exact', head: true })
    .eq('song_id', songId);
  if (countErr) return { error: countErr.message };
  if ((count ?? 0) > 0) {
    return {
      error: `Questa canzone è usata in ${count} set. Rimuovila dai set prima di eliminarla.`,
    };
  }

  const { error } = await supabase.from('songs').delete().eq('id', songId);
  if (error) {
    if (error.code === '23503') {
      return { error: 'Impossibile eliminare: la canzone ha riferimenti attivi.' };
    }
    return { error: error.message };
  }

  revalidatePath(`/churches/${churchSlug}/songs`);
  redirect(`/churches/${churchSlug}/songs`);
}

export async function saveSlideEdit(
  churchSlug: string,
  songId: string,
  variationId: string | null,
  body: string
): Promise<{ error?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: 'Il body non può essere vuoto' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  if (variationId) {
    const { error } = await supabase
      .from('song_variations')
      .update({ body_onsong: trimmed })
      .eq('id', variationId);
    if (error) return { error: error.message };
    revalidatePath(`/churches/${churchSlug}/songs/${songId}`);
    return {};
  }

  const { data: lastVersion } = await supabase
    .from('song_versions')
    .select('version_number, body_onsong')
    .eq('song_id', songId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastVersion?.body_onsong === trimmed) return {};

  const nextNumber = (lastVersion?.version_number ?? 0) + 1;
  const parsed = parseOnSong(trimmed);
  const tempo = parsed.meta.tempo ? parseInt(parsed.meta.tempo, 10) : null;

  const { data: version, error: versionErr } = await supabase
    .from('song_versions')
    .insert({
      song_id: songId,
      version_number: nextNumber,
      body_onsong: trimmed,
      notes: 'Modifica rapida da proiezione',
      created_by: user.id,
    })
    .select('id')
    .single();
  if (versionErr) return { error: versionErr.message };

  const { error: songErr } = await supabase
    .from('songs')
    .update({
      current_version_id: version.id,
      title: parsed.meta.title ?? undefined,
      artist: parsed.meta.artist ?? null,
      original_key: parsed.meta.key ?? null,
      default_tempo: Number.isFinite(tempo) ? tempo : null,
      time_signature: parsed.meta.time ?? null,
    })
    .eq('id', songId);
  if (songErr) return { error: songErr.message };

  revalidatePath(`/churches/${churchSlug}/songs/${songId}`);
  return {};
}

export async function bulkDeleteSongs(
  churchSlug: string,
  songIds: string[]
): Promise<{ error?: string; deleted?: number; skipped?: { id: string; title: string; setsCount: number }[] }> {
  if (songIds.length === 0) return { deleted: 0, skipped: [] };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: usageRows } = await supabase
    .from('set_items')
    .select('song_id')
    .in('song_id', songIds);
  const usage = new Map<string, number>();
  for (const r of usageRows ?? []) {
    usage.set(r.song_id, (usage.get(r.song_id) ?? 0) + 1);
  }
  const inUse = new Set(usage.keys());

  const deletable = songIds.filter((id) => !inUse.has(id));

  const skipped: { id: string; title: string; setsCount: number }[] = [];
  if (inUse.size > 0) {
    const { data: skippedRows } = await supabase
      .from('songs')
      .select('id, title')
      .in('id', Array.from(inUse));
    for (const r of skippedRows ?? []) {
      skipped.push({ id: r.id, title: r.title, setsCount: usage.get(r.id) ?? 0 });
    }
  }

  if (deletable.length > 0) {
    const { error } = await supabase.from('songs').delete().in('id', deletable);
    if (error) return { error: error.message };
  }

  revalidatePath(`/churches/${churchSlug}/songs`);
  return { deleted: deletable.length, skipped };
}

export async function setCurrentVersion(
  churchSlug: string,
  songId: string,
  versionId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: version } = await supabase
    .from('song_versions')
    .select('id, song_id, body_onsong')
    .eq('id', versionId)
    .maybeSingle();
  if (!version || version.song_id !== songId) return { error: 'Versione non valida' };

  const parsed = parseOnSong(version.body_onsong);
  const tempo = parsed.meta.tempo ? parseInt(parsed.meta.tempo, 10) : null;

  const { error } = await supabase
    .from('songs')
    .update({
      current_version_id: versionId,
      title: parsed.meta.title ?? undefined,
      artist: parsed.meta.artist ?? null,
      original_key: parsed.meta.key ?? null,
      default_tempo: Number.isFinite(tempo) ? tempo : null,
    })
    .eq('id', songId);
  if (error) return { error: error.message };

  revalidatePath(`/churches/${churchSlug}/songs/${songId}`);
  return {};
}
