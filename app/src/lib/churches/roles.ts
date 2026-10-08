import type { Enums } from '@/lib/supabase/database.types';

export type ChurchRole = Enums<'church_role'>;

/**
 * The enum values are stored in English-ish shorthand ('musico', 'lector');
 * the interface is Italian. Everything user-facing goes through here so the
 * raw value never reaches a screen.
 */
export const ROLE_LABEL: Record<ChurchRole, string> = {
  admin: 'Admin',
  director: 'Direttore',
  musico: 'Musicista',
  lector: 'Lettore',
};

/** Most to least privileged — the order selects should offer. */
export const ROLES: ChurchRole[] = ['admin', 'director', 'musico', 'lector'];

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABEL[role as ChurchRole] ?? role;
}
