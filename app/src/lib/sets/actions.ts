'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/errors';
import type { TablesUpdate } from '@/lib/supabase/database.types';

export async function createSet(
  churchSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const name = String(formData.get('name') ?? '').trim();
  const event_date = String(formData.get('event_date') ?? '').trim() || null;
  const event_type = String(formData.get('event_type') ?? '').trim() || null;
  if (!name) return { error: 'Il nome è obbligatorio' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .maybeSingle();
  if (!church) return { error: 'Chiesa non trovata' };

  const { data: set, error } = await supabase
    .from('sets')
    .insert({
      church_id: church.id,
      name,
      event_date,
      event_type,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) return { error: friendlyError(error, 'Impossibile creare il set.') };

  revalidatePath(`/churches/${churchSlug}/sets`);
  redirect(`/churches/${churchSlug}/sets/${set.id}`);
}

export async function createSetFromSongs(
  churchSlug: string,
  name: string,
  songIds: string[]
): Promise<{ error?: string; setId?: string }> {
  const cleanName = name.trim();
  if (!cleanName) return { error: 'Il nome è obbligatorio' };
  if (songIds.length === 0) return { error: 'Seleziona almeno una canzone' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .maybeSingle();
  if (!church) return { error: 'Chiesa non trovata' };

  const { data: set, error: setErr } = await supabase
    .from('sets')
    .insert({ church_id: church.id, name: cleanName, created_by: user.id })
    .select('id')
    .single();
  if (setErr) return { error: friendlyError(setErr, 'Impossibile creare il set.') };

  const rows = songIds.map((songId, i) => ({
    set_id: set.id,
    song_id: songId,
    position: i + 1,
  }));
  const { error: itemsErr } = await supabase.from('set_items').insert(rows);
  if (itemsErr) return { error: friendlyError(itemsErr, 'Impossibile creare il set.') };

  revalidatePath(`/churches/${churchSlug}/sets`);
  return { setId: set.id };
}

export async function addSongToSet(
  setId: string,
  songId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: maxRow } = await supabase
    .from('set_items')
    .select('position')
    .eq('set_id', setId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? 0) + 1;

  // Pre-select the most specific variation the user has visible:
  // user > band (most recent) > base
  let variationId: string | null = null;

  const { data: userVar } = await supabase
    .from('song_variations')
    .select('id')
    .eq('song_id', songId)
    .eq('scope', 'user')
    .eq('scope_user_id', user.id)
    .maybeSingle();
  if (userVar) {
    variationId = userVar.id;
  } else {
    const { data: bandVars } = await supabase
      .from('song_variations')
      .select('id, scope_band_id, created_at')
      .eq('song_id', songId)
      .eq('scope', 'band')
      .order('created_at', { ascending: false });
    if ((bandVars ?? []).length > 0) {
      const { data: myBands } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', user.id);
      const myBandIds = new Set((myBands ?? []).map((b) => b.band_id));
      const match = (bandVars ?? []).find(
        (v) => v.scope_band_id !== null && myBandIds.has(v.scope_band_id)
      );
      variationId = match?.id ?? null;
    }
  }

  const { error } = await supabase
    .from('set_items')
    .insert({
      set_id: setId,
      song_id: songId,
      position: nextPosition,
      variation_id: variationId,
    });
  if (error) return { error: friendlyError(error, 'Impossibile aggiungere la canzone al set.') };

  revalidatePath(`/churches/[slug]/sets/${setId}`, 'page');
  return {};
}

export async function removeSetItem(itemId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from('set_items')
    .select('set_id')
    .eq('id', itemId)
    .maybeSingle();
  const { error } = await supabase.from('set_items').delete().eq('id', itemId);
  if (error) return { error: friendlyError(error, 'Impossibile rimuovere la canzone dal set.') };
  if (item) revalidatePath(`/churches/[slug]/sets/${item.set_id}`, 'page');
  return {};
}

export async function reorderSetItems(
  setId: string,
  itemIds: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // Renumbering runs in a single RPC: set_items has a non-deferrable
  // unique (set_id, position), so a partial renumber from here would either
  // collide or leave the set half-sorted.
  const { error } = await supabase.rpc('reorder_set_items', {
    p_set_id: setId,
    p_item_ids: itemIds,
  });
  if (error) return { error: friendlyError(error, 'Impossibile riordinare il set.') };

  revalidatePath(`/churches/[slug]/sets/${setId}`, 'page');
  return {};
}

export async function updateSet(
  setId: string,
  patch: { name?: string; event_date?: string | null; event_type?: string | null; notes?: string | null }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const cleanPatch: TablesUpdate<'sets'> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: 'Il nome è obbligatorio' };
    cleanPatch.name = trimmed;
  }
  if (patch.event_date !== undefined) cleanPatch.event_date = patch.event_date || null;
  if (patch.event_type !== undefined) cleanPatch.event_type = patch.event_type?.trim() || null;
  if (patch.notes !== undefined) cleanPatch.notes = patch.notes?.trim() || null;

  const { error } = await supabase.from('sets').update(cleanPatch).eq('id', setId);
  if (error) return { error: friendlyError(error, 'Impossibile salvare il set.') };

  revalidatePath(`/churches/[slug]/sets/${setId}`, 'page');
  return {};
}

export async function deleteSet(
  churchSlug: string,
  setId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('sets').delete().eq('id', setId);
  if (error) return { error: friendlyError(error, 'Impossibile eliminare il set.') };

  revalidatePath(`/churches/${churchSlug}/sets`);
  redirect(`/churches/${churchSlug}/sets`);
}

export async function shareSet(
  setId: string,
  email: string,
  permission: 'read' | 'read_write'
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const trimmed = email.trim().toLowerCase();
  // Resolved server-side (see 0008_tighten_visibility.sql): reading `users` by
  // email from here would let anyone probe which addresses are registered.
  const { data: targetId } = await supabase.rpc('find_shareable_user', {
    p_set_id: setId,
    p_email: trimmed,
  });
  if (!targetId) {
    return {
      error:
        'Nessun utente con questa email tra i membri delle tue chiese. Invitalo prima alla chiesa.',
    };
  }
  if (targetId === user.id) return { error: 'Non puoi condividere il set con te stesso' };

  const { error } = await supabase
    .from('set_shares')
    .upsert({ set_id: setId, user_id: targetId, permission });
  if (error) return { error: friendlyError(error, 'Impossibile condividere il set.') };

  revalidatePath(`/churches/[slug]/sets/${setId}`, 'page');
  return {};
}

export async function unshareSet(
  setId: string,
  userId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('set_shares')
    .delete()
    .eq('set_id', setId)
    .eq('user_id', userId);
  if (error) return { error: friendlyError(error, 'Impossibile rimuovere la condivisione.') };
  revalidatePath(`/churches/[slug]/sets/${setId}`, 'page');
  return {};
}

export async function shareSetWithBand(
  setId: string,
  bandId: string,
  permission: 'read' | 'read_write'
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('set_band_shares')
    .upsert({ set_id: setId, band_id: bandId, permission });
  if (error) return { error: friendlyError(error, 'Impossibile condividere il set con il gruppo.') };
  revalidatePath(`/churches/[slug]/sets/${setId}`, 'page');
  return {};
}

export async function unshareSetWithBand(
  setId: string,
  bandId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('set_band_shares')
    .delete()
    .eq('set_id', setId)
    .eq('band_id', bandId);
  if (error) return { error: friendlyError(error, 'Impossibile rimuovere la condivisione.') };
  revalidatePath(`/churches/[slug]/sets/${setId}`, 'page');
  return {};
}

export async function heartbeatSetMaster(setId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('heartbeat_set_master', { p_set_id: setId });
}

export async function releaseSetMaster(setId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('release_set_master', { p_set_id: setId });
}

export async function updateSetItem(
  itemId: string,
  patch: {
    transpose_semitones?: number;
    capo?: number;
    performance_notes?: string | null;
    variation_id?: string | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from('set_items')
    .update(patch)
    .eq('id', itemId)
    .select('set_id')
    .maybeSingle();
  if (error) return { error: friendlyError(error, 'Impossibile salvare la modifica.') };
  if (item) revalidatePath(`/churches/[slug]/sets/${item.set_id}`, 'page');
  return {};
}
