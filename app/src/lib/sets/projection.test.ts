import { describe, expect, it } from 'vitest';
import { applyOrder, resolveIncomingIndex } from './projection';

const slides = [{ itemId: 'a' }, { itemId: 'b' }, { itemId: 'c' }];

describe('resolveIncomingIndex', () => {
  it('follows the song by id, not by position', () => {
    // Leader is on 'c'; this client has it third.
    expect(resolveIncomingIndex({ itemId: 'c', index: 0 }, slides, 0)).toBe(2);
  });

  it('ignores a stale index when the id is known', () => {
    // The regression this exists for: leader says "index 0" but means 'c'.
    expect(resolveIncomingIndex({ itemId: 'c', index: 0 }, slides, 1)).toBe(2);
  });

  it('reports -1 for a song this client does not have', () => {
    expect(resolveIncomingIndex({ itemId: 'zzz', index: 1 }, slides, 0)).toBe(-1);
  });

  it('falls back to the index for a leader that sends no id', () => {
    expect(resolveIncomingIndex({ itemId: null, index: 1 }, slides, 0)).toBe(1);
  });

  it('holds position when a legacy index is out of range', () => {
    expect(resolveIncomingIndex({ itemId: null, index: 9 }, slides, 2)).toBe(2);
  });
});

describe('applyOrder', () => {
  it('reorders to match the leader', () => {
    expect(applyOrder(slides, ['c', 'a', 'b']).map((s) => s.itemId)).toEqual(['c', 'a', 'b']);
  });

  it('keeps slides the leader did not mention instead of dropping them', () => {
    expect(applyOrder(slides, ['c', 'a']).map((s) => s.itemId)).toEqual(['c', 'a', 'b']);
  });

  it('ignores ids this client does not have', () => {
    expect(applyOrder(slides, ['c', 'zzz', 'a', 'b']).map((s) => s.itemId)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('preserves the slide objects themselves', () => {
    const rich = [
      { itemId: 'a', title: 'Adorerò' },
      { itemId: 'b', title: 'Alla Croce' },
    ];
    expect(applyOrder(rich, ['b', 'a'])[0]).toEqual({ itemId: 'b', title: 'Alla Croce' });
  });
});
