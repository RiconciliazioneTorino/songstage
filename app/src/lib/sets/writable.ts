/**
 * Which sets a user may add a song to.
 *
 * The rule is the one `set_items_write` enforces in the database
 * (`set_owner_or_church_lead or can_write_set_shared`), restated here so a
 * page can offer a list of sets without asking the server set by set. RLS
 * still has the final word on the insert — this only decides what to show.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isPastEvent, splitByDate, todayInRome } from './schedule';

export type WritableSet = {
  id: string;
  name: string;
  event_date: string | null;
  event_type: string | null;
  /** The song this list was built for is already in it. */
  alreadyHasSong: boolean;
};

export type SetAccess = {
  id: string;
  name: string;
  event_date: string | null;
  event_type: string | null;
  created_by: string | null;
};

/**
 * The writable half of the sets the caller can see, still upcoming, nearest
 * service first — the pure core, so the rule can be tested without a database.
 *
 * `isChurchLead` short-circuits everything: an admin or director of the church
 * may write every set of that church, whoever created it.
 */
export function selectWritableSets({
  sets,
  userId,
  isChurchLead,
  readWriteSetIds,
  songSetIds,
  today = todayInRome(),
}: {
  sets: SetAccess[];
  userId: string;
  isChurchLead: boolean;
  /** Sets shared with the user, or with a band of theirs, as `read_write`. */
  readWriteSetIds: Set<string>;
  /** Sets that already contain the song being offered. */
  songSetIds: Set<string>;
  today?: string;
}): WritableSet[] {
  const writable = sets.filter(
    (s) =>
      !isPastEvent(s.event_date, today) &&
      (isChurchLead || s.created_by === userId || readWriteSetIds.has(s.id))
  );
  // Same ordering as the sets page: the next service first, undated last.
  const { current } = splitByDate(writable, today);
  return current.map((s) => ({
    id: s.id,
    name: s.name,
    event_date: s.event_date,
    event_type: s.event_type,
    alreadyHasSong: songSetIds.has(s.id),
  }));
}

/**
 * Reads the pieces `selectWritableSets` needs. Four small queries rather than
 * two round trips per set, and each is already narrowed by RLS.
 */
export async function writableSetsForSong(
  supabase: SupabaseClient<Database>,
  { churchId, userId, songId }: { churchId: string; userId: string; songId: string }
): Promise<WritableSet[]> {
  const { data: sets } = await supabase
    .from('sets')
    .select('id, name, event_date, event_type, created_by')
    .eq('church_id', churchId);
  if (!sets || sets.length === 0) return [];

  const setIds = sets.map((s) => s.id);
  const [membershipRes, sharesRes, bandSharesRes, itemsRes] = await Promise.all([
    supabase
      .from('church_members')
      .select('role')
      .eq('church_id', churchId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('set_shares')
      .select('set_id')
      .eq('user_id', userId)
      .eq('permission', 'read_write')
      .in('set_id', setIds),
    // RLS on set_band_shares already limits these to bands the user is in (or
    // sets they lead), so no band filter is needed here.
    supabase
      .from('set_band_shares')
      .select('set_id, band_id')
      .eq('permission', 'read_write')
      .in('set_id', setIds),
    supabase.from('set_items').select('set_id').eq('song_id', songId).in('set_id', setIds),
  ]);

  const role = membershipRes.data?.role;
  const isChurchLead = role === 'admin' || role === 'director';

  const readWriteSetIds = new Set((sharesRes.data ?? []).map((r) => r.set_id));
  if ((bandSharesRes.data ?? []).length > 0) {
    const { data: myBands } = await supabase
      .from('band_members')
      .select('band_id')
      .eq('user_id', userId);
    const myBandIds = new Set((myBands ?? []).map((b) => b.band_id));
    for (const row of bandSharesRes.data ?? []) {
      if (myBandIds.has(row.band_id)) readWriteSetIds.add(row.set_id);
    }
  }

  return selectWritableSets({
    sets,
    userId,
    isChurchLead,
    readWriteSetIds,
    songSetIds: new Set((itemsRes.data ?? []).map((r) => r.set_id)),
  });
}
