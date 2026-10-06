'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/errors';
import { parseOnSong } from '@/lib/onsong';

export async function promoteSongToCanonical(
  sourceSongId: string
): Promise<{ error?: string; canonicalId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: me } = await supabase
    .from('users')
    .select('is_curator')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_curator) return { error: 'Solo un curatore può promuovere alla libreria canonica.' };

  const { data: source } = await supabase
    .from('songs')
    .select('id, title, artist, original_key, default_tempo, time_signature, current_version_id, parent_song_id, church_id')
    .eq('id', sourceSongId)
    .maybeSingle();
  if (!source) return { error: 'Canzone non trovata' };
  if (!source.church_id) return { error: 'Già nella libreria canonica' };
  if (source.parent_song_id) return { error: 'Questa canzone è già un adattamento di una canonica' };

  let body = '';
  if (source.current_version_id) {
    const { data: version } = await supabase
      .from('song_versions')
      .select('body_onsong')
      .eq('id', source.current_version_id)
      .maybeSingle();
    body = version?.body_onsong ?? '';
  } else {
    const { data: latest } = await supabase
      .from('song_versions')
      .select('body_onsong')
      .eq('song_id', sourceSongId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    body = latest?.body_onsong ?? '';
  }
  if (!body) return { error: 'La canzone sorgente non ha contenuto da copiare' };

  const { data: canonical, error: insErr } = await supabase
    .from('songs')
    .insert({
      church_id: null,
      title: source.title,
      artist: source.artist,
      original_key: source.original_key,
      default_tempo: source.default_tempo,
      time_signature: source.time_signature,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (insErr) return { error: friendlyError(insErr, 'Impossibile promuovere la canzone.') };

  const { data: version, error: vErr } = await supabase
    .from('song_versions')
    .insert({
      song_id: canonical.id,
      version_number: 1,
      body_onsong: body,
      notes: 'Promossa dalla canzone della chiesa',
      created_by: user.id,
    })
    .select('id')
    .single();
  if (vErr) return { error: friendlyError(vErr, 'Impossibile promuovere la canzone.') };

  await supabase
    .from('songs')
    .update({ current_version_id: version.id })
    .eq('id', canonical.id);

  // Link source → canonical so it's recognized as an adopted copy
  await supabase
    .from('songs')
    .update({ parent_song_id: canonical.id })
    .eq('id', sourceSongId);

  revalidatePath(`/library/${canonical.id}`);
  revalidatePath(`/churches/[slug]/songs/${sourceSongId}`, 'page');
  return { canonicalId: canonical.id };
}

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
  if (songErr) return { error: friendlyError(songErr, 'Impossibile creare la canzone canonica.') };

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
  if (versionErr) return { error: friendlyError(versionErr, 'Impossibile creare la canzone canonica.') };

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
  if (versionErr) return { error: friendlyError(versionErr, 'Impossibile salvare la canzone canonica.') };

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
  if (songErr) return { error: friendlyError(songErr, 'Impossibile salvare la canzone canonica.') };

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
  if (cloneErr || !clone) return { error: friendlyError(cloneErr, 'Impossibile adottare la canzone.') };

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
  if (error) return { error: friendlyError(error, 'Impossibile eliminare la canzone canonica.') };

  revalidatePath('/library');
  redirect('/library');
}
