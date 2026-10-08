'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/errors';
import type { TablesUpdate } from '@/lib/supabase/database.types';

async function getCurrentBody(songId: string): Promise<string> {
  const supabase = await createClient();
  const { data: song } = await supabase
    .from('songs')
    .select('current_version_id')
    .eq('id', songId)
    .maybeSingle();
  if (!song?.current_version_id) {
    const { data: latest } = await supabase
      .from('song_versions')
      .select('body_onsong')
      .eq('song_id', songId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    return latest?.body_onsong ?? '';
  }
  const { data: v } = await supabase
    .from('song_versions')
    .select('body_onsong')
    .eq('id', song.current_version_id)
    .maybeSingle();
  return v?.body_onsong ?? '';
}

export async function createUserVariation(
  churchSlug: string,
  songId: string,
  name?: string
): Promise<{ error?: string; variationId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const body = await getCurrentBody(songId);
  if (!body) return { error: 'La canzone non ha contenuto da copiare' };

  const { data, error } = await supabase
    .from('song_variations')
    .insert({
      song_id: songId,
      scope: 'user',
      scope_user_id: user.id,
      name: (name ?? '').trim() || 'Mia variante',
      body_onsong: body,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) return { error: friendlyError(error, 'Impossibile creare la variante.') };

  revalidatePath(`/churches/${churchSlug}/songs/${songId}`);
  return { variationId: data.id };
}

export async function createBandVariation(
  churchSlug: string,
  songId: string,
  bandId: string,
  name?: string
): Promise<{ error?: string; variationId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const body = await getCurrentBody(songId);
  if (!body) return { error: 'La canzone non ha contenuto da copiare' };

  const { data: band } = await supabase
    .from('bands')
    .select('id, name')
    .eq('id', bandId)
    .maybeSingle();
  if (!band) return { error: 'Gruppo non trovato' };

  const { data, error } = await supabase
    .from('song_variations')
    .insert({
      song_id: songId,
      scope: 'band',
      scope_band_id: bandId,
      name: (name ?? '').trim() || `Variante ${band.name}`,
      body_onsong: body,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) return { error: friendlyError(error, 'Impossibile creare la variante del gruppo.') };

  revalidatePath(`/churches/${churchSlug}/songs/${songId}`);
  return { variationId: data.id };
}

export async function updateVariation(
  variationId: string,
  patch: { body_onsong?: string; name?: string }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const clean: TablesUpdate<'song_variations'> = {};
  if (patch.body_onsong !== undefined) {
    if (!patch.body_onsong.trim()) return { error: 'Il body non può essere vuoto' };
    clean.body_onsong = patch.body_onsong;
  }
  if (patch.name !== undefined) clean.name = patch.name.trim() || 'Senza nome';

  const { error } = await supabase
    .from('song_variations')
    .update(clean)
    .eq('id', variationId);
  if (error) return { error: friendlyError(error, 'Impossibile salvare la variante.') };

  return {};
}

export async function deleteVariation(
  churchSlug: string,
  songId: string,
  variationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('set_items')
    .select('id', { count: 'exact', head: true })
    .eq('variation_id', variationId);
  if ((count ?? 0) > 0) {
    return {
      error: `Questa variante è usata in ${count} elementi di set. Rimuovila prima.`,
    };
  }

  const { error } = await supabase.from('song_variations').delete().eq('id', variationId);
  if (error) return { error: friendlyError(error, 'Impossibile eliminare la variante.') };

  revalidatePath(`/churches/${churchSlug}/songs/${songId}`);
  redirect(`/churches/${churchSlug}/songs/${songId}`);
}
