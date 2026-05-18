'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseOnSong } from '@/lib/onsong';

export async function createCanonicalSong(
  formData: FormData
): Promise<{ error?: string }> {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return { error: 'Incolla il contenuto OnSong' };

  const titleOverride = String(formData.get('title') ?? '').trim();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const parsed = parseOnSong(body);
  const title = titleOverride || parsed.meta.title || 'Senza titolo';
  const tempo = parsed.meta.tempo ? parseInt(parsed.meta.tempo, 10) : null;

  const { data: song, error: songErr } = await supabase
    .from('songs')
    .insert({
      church_id: null,
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

  revalidatePath('/library');
  redirect(`/library/${song.id}`);
}

export async function updateCanonicalSong(
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

  revalidatePath(`/library/${songId}`);
  redirect(`/library/${songId}`);
}

export async function adoptCanonicalToChurch(
  canonicalSongId: string,
  churchSlug: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .maybeSingle();
  if (!church) return { error: 'Chiesa non trovata' };

  const { data: canonical } = await supabase
    .from('songs')
    .select('id, title, artist, original_key, default_tempo, time_signature, current_version_id, church_id')
    .eq('id', canonicalSongId)
    .maybeSingle();
  if (!canonical) return { error: 'Canzone canonica non trovata' };
  if (canonical.church_id !== null) return { error: 'Questa canzone non è canonica' };

  const { data: existing } = await supabase
    .from('songs')
    .select('id')
    .eq('church_id', church.id)
    .eq('parent_song_id', canonical.id)
    .maybeSingle();
  if (existing) {
    revalidatePath(`/churches/${churchSlug}/songs`);
    redirect(`/churches/${churchSlug}/songs/${existing.id}`);
  }

  let canonicalBody = '';
  if (canonical.current_version_id) {
    const { data: v } = await supabase
      .from('song_versions')
      .select('body_onsong')
      .eq('id', canonical.current_version_id)
      .maybeSingle();
    canonicalBody = v?.body_onsong ?? '';
  }

  const { data: clone, error: cloneErr } = await supabase
    .from('songs')
    .insert({
      church_id: church.id,
      title: canonical.title,
      artist: canonical.artist,
      original_key: canonical.original_key,
      default_tempo: canonical.default_tempo,
      time_signature: canonical.time_signature,
      parent_song_id: canonical.id,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (cloneErr || !clone) return { error: cloneErr?.message ?? 'Errore' };

  const { data: cloneVersion } = await supabase
    .from('song_versions')
    .insert({
      song_id: clone.id,
      version_number: 1,
      body_onsong: canonicalBody,
      notes: 'Adottata dalla libreria canonica',
      created_by: user.id,
    })
    .select('id')
    .single();
  if (cloneVersion) {
    await supabase
      .from('songs')
      .update({ current_version_id: cloneVersion.id })
      .eq('id', clone.id);
  }

  revalidatePath(`/churches/${churchSlug}/songs`);
  redirect(`/churches/${churchSlug}/songs/${clone.id}`);
}

export async function deleteCanonicalSong(songId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { count: childrenCount } = await supabase
    .from('songs')
    .select('id', { count: 'exact', head: true })
    .eq('parent_song_id', songId);
  if ((childrenCount ?? 0) > 0) {
    return {
      error: `Questa canzone canonica è stata adottata da ${childrenCount} chiese. Non si può eliminare.`,
    };
  }

  const { error } = await supabase.from('songs').delete().eq('id', songId);
  if (error) return { error: error.message };

  revalidatePath('/library');
  redirect('/library');
}
