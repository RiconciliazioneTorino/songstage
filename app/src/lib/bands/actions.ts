'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/errors';

export async function createBand(
  churchSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const name = String(formData.get('name') ?? '').trim();
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

  const { error } = await supabase
    .from('bands')
    .insert({ church_id: church.id, name });
  if (error) return { error: friendlyError(error, 'Impossibile creare il gruppo.') };

  revalidatePath(`/churches/${churchSlug}`);
  return {};
}

export async function deleteBand(
  churchSlug: string,
  bandId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('bands').delete().eq('id', bandId);
  if (error) return { error: friendlyError(error, 'Impossibile eliminare il gruppo.') };

  revalidatePath(`/churches/${churchSlug}`);
  redirect(`/churches/${churchSlug}`);
}

export async function addBandMember(
  bandId: string,
  userId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('band_members')
    .insert({ band_id: bandId, user_id: userId });
  if (error) {
    if (error.code === '23505') return { error: 'È già membro del gruppo' };
    return { error: friendlyError(error, 'Impossibile aggiungere il membro al gruppo.') };
  }
  revalidatePath(`/churches/[slug]/bands/${bandId}`, 'page');
  return {};
}

export async function removeBandMember(
  bandId: string,
  userId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('band_members')
    .delete()
    .eq('band_id', bandId)
    .eq('user_id', userId);
  if (error) return { error: friendlyError(error, 'Impossibile rimuovere il membro dal gruppo.') };
  revalidatePath(`/churches/[slug]/bands/${bandId}`, 'page');
  return {};
}
