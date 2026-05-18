'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
  if (error) return { error: error.message };

  revalidatePath(`/churches/${churchSlug}/sets`);
  redirect(`/churches/${churchSlug}/sets/${set.id}`);
}

export async function addSongToSet(
  setId: string,
  songId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from('set_items')
    .select('position')
    .eq('set_id', setId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? 0) + 1;

  const { error } = await supabase
    .from('set_items')
    .insert({ set_id: setId, song_id: songId, position: nextPosition });
  if (error) return { error: error.message };

  revalidatePath(`/churches/[slug]/sets/${setId}`, 'page');
  return {};
}

export async function removeSetItem(itemId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('set_items').delete().eq('id', itemId);
  if (error) return { error: error.message };
  return {};
}

export async function moveSetItem(
  itemId: string,
  direction: 'up' | 'down'
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from('set_items')
    .select('id, set_id, position')
    .eq('id', itemId)
    .maybeSingle();
  if (!item) return { error: 'Elemento non trovato' };

  const query = supabase
    .from('set_items')
    .select('id, position')
    .eq('set_id', item.set_id)
    .limit(1);

  const { data: neighbor } =
    direction === 'up'
      ? await query.lt('position', item.position).order('position', { ascending: false }).maybeSingle()
      : await query.gt('position', item.position).order('position', { ascending: true }).maybeSingle();

  if (!neighbor) return {};

  // Two-step swap to avoid violating the (set_id, position) unique constraint
  const tmp = -Math.abs(item.position) - 1;
  await supabase.from('set_items').update({ position: tmp }).eq('id', item.id);
  await supabase.from('set_items').update({ position: item.position }).eq('id', neighbor.id);
  await supabase.from('set_items').update({ position: neighbor.position }).eq('id', item.id);

  return {};
}

export async function updateSet(
  setId: string,
  patch: { name?: string; event_date?: string | null; event_type?: string | null; notes?: string | null }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const cleanPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: 'Il nome è obbligatorio' };
    cleanPatch.name = trimmed;
  }
  if (patch.event_date !== undefined) cleanPatch.event_date = patch.event_date || null;
  if (patch.event_type !== undefined) cleanPatch.event_type = patch.event_type?.trim() || null;
  if (patch.notes !== undefined) cleanPatch.notes = patch.notes?.trim() || null;

  const { error } = await supabase.from('sets').update(cleanPatch).eq('id', setId);
  if (error) return { error: error.message };

  revalidatePath(`/churches/[slug]/sets/${setId}`, 'page');
  return {};
}

export async function deleteSet(
  churchSlug: string,
  setId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('sets').delete().eq('id', setId);
  if (error) return { error: error.message };

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
  const { data: target } = await supabase
    .from('users')
    .select('id')
    .eq('email', trimmed)
    .maybeSingle();
  if (!target) {
    return { error: 'Quell\'utente non si è ancora registrato. Chiedigli di accedere prima all\'app.' };
  }
  if (target.id === user.id) return { error: 'Non puoi condividere il set con te stesso' };

  const { error } = await supabase
    .from('set_shares')
    .upsert({ set_id: setId, user_id: target.id, permission });
  if (error) return { error: error.message };

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
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
  revalidatePath(`/churches/[slug]/sets/${setId}`, 'page');
  return {};
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
  const { error } = await supabase.from('set_items').update(patch).eq('id', itemId);
  if (error) return { error: error.message };
  return {};
}
