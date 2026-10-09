import { describe, expect, it } from 'vitest';
import { parseBeatsPerBar } from './time-signature';

describe('parseBeatsPerBar', () => {
  it('simple meters return the numerator', () => {
    expect(parseBeatsPerBar('4/4')).toBe(4);
    expect(parseBeatsPerBar('3/4')).toBe(3);
    expect(parseBeatsPerBar('2/4')).toBe(2);
    expect(parseBeatsPerBar('2/2')).toBe(2);
    expect(parseBeatsPerBar('5/4')).toBe(5);
    expect(parseBeatsPerBar('7/8')).toBe(7);
  });

  it('compound meters collapse to the dotted-beat pulse', () => {
    expect(parseBeatsPerBar('6/8')).toBe(2);
    expect(parseBeatsPerBar('9/8')).toBe(3);
    expect(parseBeatsPerBar('12/8')).toBe(4);
    expect(parseBeatsPerBar('6/16')).toBe(2);
    expect(parseBeatsPerBar('12/16')).toBe(4);
  });

  it('3/8 stays simple (one dotted-beat bar is too sparse to feel the pulse)', () => {
    expect(parseBeatsPerBar('3/8')).toBe(3);
  });

  it('tolerates whitespace', () => {
    expect(parseBeatsPerBar(' 6 / 8 ')).toBe(2);
  });

  it('falls back to 4 on empty, malformed or out-of-range input', () => {
    expect(parseBeatsPerBar(null)).toBe(4);
    expect(parseBeatsPerBar(undefined)).toBe(4);
    expect(parseBeatsPerBar('')).toBe(4);
    expect(parseBeatsPerBar('C')).toBe(4);
    expect(parseBeatsPerBar('abc')).toBe(4);
    expect(parseBeatsPerBar('0/4')).toBe(4);
    expect(parseBeatsPerBar('99/4')).toBe(4);
  });
});
