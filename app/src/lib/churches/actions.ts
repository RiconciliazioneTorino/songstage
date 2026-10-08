'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/errors';
import { escapeHtml, sendMail } from '@/lib/email/resend';

const ROLE_LABEL: Record<'admin' | 'director' | 'musico' | 'lector', string> = {
  admin: 'Admin',
  director: 'Direttore',
  musico: 'Musicista',
  lector: 'Lettore',
};

async function baseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  try {
    const h = await headers();
    const host = h.get('host');
    const proto = h.get('x-forwarded-proto') ?? 'https';
    if (host) return `${proto}://${host}`;
  } catch {}
  return 'https://songstage.riconciliazionetorino.net';
}

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
    return { error: friendlyError(rpcErr, 'Impossibile creare la chiesa.') };
  }

  const church = Array.isArray(rows) ? rows[0] : rows;
  if (!church?.slug) return { error: 'Impossibile creare la chiesa' };

  revalidatePath('/dashboard');
  redirect(`/churches/${church.slug}`);
}

type Role = 'admin' | 'director' | 'musico' | 'lector';

export async function addChurchMember(
  churchId: string,
  userId: string,
  role: Role
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { error } = await supabase
    .from('church_members')
    .insert({ church_id: churchId, user_id: userId, role });

  if (error) {
    if (error.code === '23505') return { error: 'È già membro della chiesa' };
    return { error: friendlyError(error, 'Impossibile aggiungere il membro.') };
  }

  revalidatePath(`/churches/[slug]`, 'page');
  return {};
}

export async function searchUsersForChurch(
  churchId: string,
  query: string
): Promise<{ error?: string; users?: { id: string; email: string; display_name: string | null }[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_users_for_church', {
    p_church_id: churchId,
    p_query: query,
  });
  if (error) return { error: friendlyError(error, 'Ricerca non disponibile.') };
  return { users: data ?? [] };
}

export async function inviteChurchMember(
  churchId: string,
  email: string,
  role: Role
): Promise<{
  error?: string;
  added?: boolean;
  invited?: boolean;
  /** False when the invitation row exists but the email never went out. */
  emailSent?: boolean;
  emailError?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) return { error: 'Email non valida' };

  // One definer call decides between "already registered → add now" and "leave
  // an invitation", so we never have to read the users table from here.
  const { data: outcome, error: rpcErr } = await supabase.rpc('invite_church_member', {
    p_church_id: churchId,
    p_email: cleanEmail,
    p_role: role,
  });
  if (rpcErr) {
    if (rpcErr.code === '23505') return { error: 'È già membro della chiesa' };
    if (rpcErr.code === '22023') return { error: 'Email non valida' };
    return { error: friendlyError(rpcErr, 'Impossibile invitare questa persona.') };
  }

  const result = (Array.isArray(outcome) ? outcome[0] : outcome) as
    | { added: boolean; invited: boolean }
    | null;

  if (result?.added) {
    revalidatePath(`/churches/[slug]`, 'page');
    return { added: true };
  }

  const [churchRes, inviterRes] = await Promise.all([
    supabase.from('churches').select('name, slug').eq('id', churchId).maybeSingle(),
    supabase.from('users').select('display_name, email').eq('id', user.id).maybeSingle(),
  ]);
  const church = churchRes.data;
  const inviter = inviterRes.data;

  const url = `${await baseUrl()}/login?email=${encodeURIComponent(cleanEmail)}`;
  const churchName = church?.name ?? 'una chiesa';
  const inviterName = inviter?.display_name || inviter?.email || 'un amministratore';
  const roleLabel = ROLE_LABEL[role];

  // Display names, church names and the address are user input: escape them
  // before they reach the email body.
  const safeChurch = escapeHtml(churchName);
  const safeInviter = escapeHtml(inviterName);
  const safeEmail = escapeHtml(cleanEmail);
  const safeUrl = escapeHtml(url);

  const mail = await sendMail({
    to: cleanEmail,
    subject: `Sei stato invitato a ${churchName} su SongStage`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px;">
        <h2 style="margin-bottom: 8px;">Sei stato invitato a <b>${safeChurch}</b></h2>
        <p style="color:#444; margin: 0 0 16px;">
          ${safeInviter} ti ha invitato come <b>${roleLabel}</b> su SongStage,
          l'app che usiamo per gestire i canti e le scalette delle riunioni.
        </p>
        <p style="margin: 16px 0;">
          <a href="${safeUrl}" style="display:inline-block; padding:10px 16px; background:#4ade80; color:#0f0f10; text-decoration:none; border-radius:6px; font-weight:600;">
            Accedi con ${safeEmail}
          </a>
        </p>
        <p style="color:#888; font-size:12px;">
          Usa questo indirizzo email per accedere: ${safeEmail}.
          Al primo accesso verrai aggiunto automaticamente a ${safeChurch}.
        </p>
        <p style="color:#888; font-size:12px;">
          Se non aspettavi questo invito, puoi ignorare questa email.
        </p>
      </div>
    `,
  });

  revalidatePath(`/churches/[slug]`, 'page');
  // The invitation row is valid either way — it's consumed at first login — so
  // we keep it and tell the admin the email didn't make it.
  if (mail.error) {
    return { invited: true, emailSent: false, emailError: mail.error };
  }
  return { invited: true, emailSent: true };
}

export async function updateChurchMemberRole(
  churchId: string,
  userId: string,
  newRole: Role
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: target } = await supabase
    .from('church_members')
    .select('role')
    .eq('church_id', churchId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!target) return { error: 'Membro non trovato' };
  if (target.role === newRole) return {};

  if (target.role === 'admin' && newRole !== 'admin') {
    const { count } = await supabase
      .from('church_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('role', 'admin');
    if ((count ?? 0) <= 1) {
      return { error: 'Non puoi togliere il ruolo di admin all\'ultimo admin.' };
    }
  }

  const { error } = await supabase
    .from('church_members')
    .update({ role: newRole })
    .eq('church_id', churchId)
    .eq('user_id', userId);
  if (error) return { error: friendlyError(error, 'Impossibile cambiare il ruolo.') };

  revalidatePath(`/churches/[slug]`, 'page');
  return {};
}

export async function removeChurchMember(
  churchId: string,
  userId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };

  const { data: target } = await supabase
    .from('church_members')
    .select('role')
    .eq('church_id', churchId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!target) return { error: 'Membro non trovato' };

  if (target.role === 'admin') {
    const { count } = await supabase
      .from('church_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('role', 'admin');
    if ((count ?? 0) <= 1) {
      return { error: 'Non puoi rimuovere l\'ultimo admin della chiesa.' };
    }
  }

  const { error } = await supabase
    .from('church_members')
    .delete()
    .eq('church_id', churchId)
    .eq('user_id', userId);
  if (error) return { error: friendlyError(error, 'Impossibile rimuovere il membro.') };

  revalidatePath(`/churches/[slug]`, 'page');
  return {};
}

export async function cancelChurchInvitation(
  invitationId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('church_invitations').delete().eq('id', invitationId);
  if (error) return { error: friendlyError(error, 'Impossibile annullare questo invito.') };
  revalidatePath(`/churches/[slug]`, 'page');
  return {};
}

export async function updateDisplayName(name: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato' };
  const clean = name.trim().slice(0, 60);
  if (!clean) return { error: 'Il nome non può essere vuoto' };
  const { error } = await supabase
    .from('users')
    .update({ display_name: clean })
    .eq('id', user.id);
  if (error) return { error: friendlyError(error, 'Impossibile salvare il nome.') };
  revalidatePath('/dashboard');
  return {};
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
