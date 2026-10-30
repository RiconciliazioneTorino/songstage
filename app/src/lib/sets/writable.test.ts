import { describe, expect, it } from 'vitest';
import { selectWritableSets, type SetAccess } from './writable';

const TODAY = '2026-10-30';

const set = (id: string, event_date: string | null, created_by: string | null = 'other'): SetAccess => ({
  id,
  name: `Set ${id}`,
  event_date,
  event_type: null,
  created_by,
});

const base = {
  userId: 'me',
  isChurchLead: false,
  readWriteSetIds: new Set<string>(),
  songSetIds: new Set<string>(),
  today: TODAY,
};

describe('selectWritableSets', () => {
  it('leaves out the sets whose day is over, and keeps the one happening today', () => {
    const sets = [set('yesterday', '2026-10-29'), set('today', TODAY), set('soon', '2026-11-02')];
    const ids = selectWritableSets({ ...base, sets, isChurchLead: true }).map((s) => s.id);
    expect(ids).toEqual(['today', 'soon']);
  });

  it('orders by the next service first, undated last', () => {
    const sets = [set('later', '2026-12-01'), set('undated', null), set('next', '2026-11-01')];
    const ids = selectWritableSets({ ...base, sets, isChurchLead: true }).map((s) => s.id);
    expect(ids).toEqual(['next', 'later', 'undated']);
  });

  it('gives a church lead every set of the church', () => {
    const sets = [set('theirs', '2026-11-01', 'someone-else')];
    expect(selectWritableSets({ ...base, sets, isChurchLead: true })).toHaveLength(1);
  });

  it('gives a plain member only their own sets and the ones shared read_write', () => {
    const sets = [
      set('mine', '2026-11-01', 'me'),
      set('shared', '2026-11-02', 'someone-else'),
      set('readonly', '2026-11-03', 'someone-else'),
    ];
    const ids = selectWritableSets({
      ...base,
      sets,
      readWriteSetIds: new Set(['shared']),
    }).map((s) => s.id);
    expect(ids).toEqual(['mine', 'shared']);
  });

  it('flags the sets that already contain the song', () => {
    const sets = [set('a', '2026-11-01'), set('b', '2026-11-02')];
    const rows = selectWritableSets({
      ...base,
      sets,
      isChurchLead: true,
      songSetIds: new Set(['b']),
    });
    expect(rows.map((s) => s.alreadyHasSong)).toEqual([false, true]);
  });
});
