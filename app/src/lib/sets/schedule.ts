/**
 * Splitting a set list into what is still coming and what is already over.
 */

/**
 * Today where the church is, not where the server is. Vercel runs in UTC, so
 * for the first couple of hours of an Italian day the server's own date is
 * still yesterday's — and a set would stay in the wrong group.
 */
export function todayInRome(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is what event_date holds.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(now);
}

/**
 * A set is past only once its day is over: a service happening today is the
 * most relevant one there is, so it must not be filed away that morning.
 * Sets with no date are never past — there is nothing to compare.
 */
export function isPastEvent(eventDate: string | null, today: string): boolean {
  if (!eventDate) return false;
  return eventDate < today;
}

/**
 * The two groups read in opposite directions, because they answer opposite
 * questions: what is coming counts forward from today (the next service
 * first), while what is done counts backward (the one just sung first).
 *
 * Undated sets sort last among the upcoming — there is no date to be soon.
 */
export function splitByDate<T extends { event_date: string | null }>(
  rows: T[],
  today: string
): { current: T[]; past: T[] } {
  const current: T[] = [];
  const past: T[] = [];
  for (const row of rows) {
    (isPastEvent(row.event_date, today) ? past : current).push(row);
  }

  current.sort((a, b) => {
    if (a.event_date === b.event_date) return 0;
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return a.event_date < b.event_date ? -1 : 1;
  });
  past.sort((a, b) => ((a.event_date ?? '') > (b.event_date ?? '') ? -1 : 1));

  return { current, past };
}
