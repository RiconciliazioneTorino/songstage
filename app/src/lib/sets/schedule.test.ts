import { describe, expect, it } from 'vitest';
import { isPastEvent, splitByDate, todayInRome } from './schedule';

describe('isPastEvent', () => {
  it('counts yesterday as past', () => {
    expect(isPastEvent('2026-10-08', '2026-10-09')).toBe(true);
  });

  it("does not file away today's service", () => {
    // The one happening today is the most relevant set there is.
    expect(isPastEvent('2026-10-09', '2026-10-09')).toBe(false);
  });

  it('keeps future dates current', () => {
    expect(isPastEvent('2026-10-16', '2026-10-09')).toBe(false);
  });

  it('never treats an undated set as past', () => {
    expect(isPastEvent(null, '2026-10-09')).toBe(false);
  });

  it('compares across year and month boundaries', () => {
    expect(isPastEvent('2025-12-31', '2026-01-01')).toBe(true);
    expect(isPastEvent('2026-01-01', '2025-12-31')).toBe(false);
    expect(isPastEvent('2026-09-30', '2026-10-01')).toBe(true);
  });
});

describe('todayInRome', () => {
  it('uses the date in Rome, not the server-s UTC date', () => {
    // 23:30 UTC on the 8th is already 01:30 on the 9th in Rome.
    expect(todayInRome(new Date('2026-10-08T23:30:00Z'))).toBe('2026-10-09');
  });

  it('is still the previous day early in the UTC morning', () => {
    // 00:30 UTC on the 9th is 02:30 on the 9th in Rome — same day.
    expect(todayInRome(new Date('2026-10-09T00:30:00Z'))).toBe('2026-10-09');
  });

  it('formats as the same YYYY-MM-DD shape event_date uses', () => {
    expect(todayInRome(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });
});

describe('splitByDate', () => {
  it('puts the next service first and the most recent past one first', () => {
    const rows = [
      { event_date: '2026-10-16' },
      { event_date: '2026-10-11' },
      { event_date: '2026-10-02' },
      { event_date: '2026-10-04' },
      { event_date: null },
    ];
    const { current, past } = splitByDate(rows, '2026-10-09');
    expect(current.map((r) => r.event_date)).toEqual(['2026-10-11', '2026-10-16', null]);
    expect(past.map((r) => r.event_date)).toEqual(['2026-10-04', '2026-10-02']);
  });

  it('sorts regardless of the order it was handed', () => {
    const rows = [
      { event_date: '2026-10-02' },
      { event_date: '2026-10-16' },
      { event_date: '2026-10-04' },
      { event_date: '2026-10-11' },
    ];
    const { current, past } = splitByDate(rows, '2026-10-09');
    expect(current.map((r) => r.event_date)).toEqual(['2026-10-11', '2026-10-16']);
    expect(past.map((r) => r.event_date)).toEqual(['2026-10-04', '2026-10-02']);
  });

  it('keeps undated sets last among the upcoming', () => {
    const rows = [{ event_date: null }, { event_date: '2026-10-11' }, { event_date: null }];
    const { current } = splitByDate(rows, '2026-10-09');
    expect(current.map((r) => r.event_date)).toEqual(['2026-10-11', null, null]);
  });

  it('keeps several sets sharing a date together', () => {
    const rows = [{ event_date: '2026-10-04' }, { event_date: '2026-10-04' }];
    expect(splitByDate(rows, '2026-10-09').past).toHaveLength(2);
  });

  it('handles a list that is entirely past', () => {
    const { current, past } = splitByDate([{ event_date: '2020-01-01' }], '2026-10-09');
    expect(current).toEqual([]);
    expect(past).toHaveLength(1);
  });
});
