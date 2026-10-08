/**
 * Keeping followers in sync with the leader's running order.
 *
 * Both live here rather than in the projection components so they can be
 * tested without pulling a React route in.
 */

export type ProjectionState = {
  /**
   * Which song the leader is on. `itemId` is authoritative; `index` is only a
   * fallback for clients that loaded before itemId was broadcast, and for a
   * follower whose slide list predates a song the leader just added. Position
   * alone is not enough: reordering or adding a song shifts every index after
   * it, and the follower would silently land on the wrong song.
   */
  itemId: string | null;
  index: number;
  /**
   * Absolute semitones for the slide the leader is on — not a delta against
   * the stored value. A follower that loaded the set after the leader had
   * already transposed would otherwise add the shift twice.
   */
  transpose: number;
  fontScale: number;
  showChords: boolean;
  scrollFraction: number;
};

/**
 * Where the leader is, translated into this client's own slide list.
 *
 * Returns -1 when the leader is on a song this client has never seen (added
 * mid-service, most likely): the caller refetches rather than guessing, since
 * following the raw index would land on whatever song now sits in that slot.
 */
export function resolveIncomingIndex(
  p: Pick<ProjectionState, 'itemId' | 'index'>,
  slides: { itemId: string }[],
  current: number
): number {
  if (p.itemId) {
    const found = slides.findIndex((s) => s.itemId === p.itemId);
    return found !== -1 ? found : -1;
  }
  // A leader running a build from before itemId was broadcast: index is all
  // there is, so trust it as long as it is in range.
  if (p.index >= 0 && p.index < slides.length) return p.index;
  return current;
}

/**
 * Apply a leader's new running order to a slide list. Slides the leader didn't
 * mention (one this client has but the leader doesn't, or vice versa) keep
 * their relative order at the end rather than vanishing from the screen.
 */
export function applyOrder<T extends { itemId: string }>(slides: T[], itemIds: string[]): T[] {
  const byId = new Map(slides.map((s) => [s.itemId, s]));
  const ordered = itemIds.map((id) => byId.get(id)).filter((s): s is T => s !== undefined);
  const seen = new Set(ordered.map((s) => s.itemId));
  return [...ordered, ...slides.filter((s) => !seen.has(s.itemId))];
}
