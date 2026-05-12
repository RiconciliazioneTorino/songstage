'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

export async function createChurch(formData: FormData): Promise<{ error?: string }> {
  const name = String(formData.get('name') ?? '').trim();
  const rawSlug = String(formData.get('slug') ?? '').trim();
  if (!name) return { error: 'Il nome è obbligatorio' };

  const slug = slugify(rawSlug || name);
  if (!slug) return { error: 'Slug non valido' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: rows, error: rpcErr } = await supabase
    .rpc('create_church_with_admin', { p_name: name, p_slug: slug });

  if (rpcErr) {
    if (rpcErr.code === '23505') return { error: 'Esiste già una chiesa con questo slug' };
    return { error: rpcErr.message };
  }

  const church = Array.isArray(rows) ? rows[0] : rows;
  if (!church?.slug) return { error: 'Impossibile creare la chiesa' };

  revalidatePath('/dashboard');
  redirect(`/churches/${church.slug}`);
}

export async function addChurchMember(
  churchId: string,
  email: string,
  role: 'admin' | 'director' | 'musico' | 'lector'
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: target } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (!target) {
    return { error: 'Quell\'utente non si è ancora registrato. Chiedigli di accedere prima all\'app.' };
  }

  const { error } = await supabase
    .from('church_members')
    .insert({ church_id: churchId, user_id: target.id, role });

  if (error) {
    if (error.code === '23505') return { error: 'È già membro della chiesa' };
    return { error: error.message };
  }

  revalidatePath(`/churches/[slug]`, 'page');
  return {};
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
