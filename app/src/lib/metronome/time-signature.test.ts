import { describe, expect, it } from 'vitest';
import { metronomePattern, parseBeatsPerBar } from './time-signature';

describe('metronomePattern', () => {
  it('simple meters tick once per beat and accent only on the downbeat', () => {
    expect(metronomePattern('4/4')).toEqual({
      beatsPerBar: 4,
      subdivisionsPerBeat: 1,
      strongEvery: 4,
    });
    expect(metronomePattern('3/4')).toEqual({
      beatsPerBar: 3,
      subdivisionsPerBeat: 1,
      strongEvery: 3,
    });
    expect(metronomePattern('2/4')).toEqual({
      beatsPerBar: 2,
      subdivisionsPerBeat: 1,
      strongEvery: 2,
    });
    expect(metronomePattern('5/4')).toEqual({
      beatsPerBar: 5,
      subdivisionsPerBeat: 1,
      strongEvery: 5,
    });
    expect(metronomePattern('7/8')).toEqual({
      beatsPerBar: 7,
      subdivisionsPerBeat: 1,
      strongEvery: 7,
    });
  });

  it('compound meters split each quarter in two and accent every dotted beat', () => {
    // 6/8 at chart BPM 70 → ticks at 140, pattern *--*-- per bar of 6 ticks.
    expect(metronomePattern('6/8')).toEqual({
      beatsPerBar: 2,
      subdivisionsPerBeat: 2,
      strongEvery: 3,
    });
    expect(metronomePattern('9/8')).toEqual({
      beatsPerBar: 3,
      subdivisionsPerBeat: 2,
      strongEvery: 3,
    });
    expect(metronomePattern('12/8')).toEqual({
      beatsPerBar: 4,
      subdivisionsPerBeat: 2,
      strongEvery: 3,
    });
    expect(metronomePattern('6/16')).toEqual({
      beatsPerBar: 2,
      subdivisionsPerBeat: 2,
      strongEvery: 3,
    });
  });

  it('3/8 stays simple (one dotted-beat bar is too sparse to feel the pulse)', () => {
    expect(metronomePattern('3/8')).toEqual({
      beatsPerBar: 3,
      subdivisionsPerBeat: 1,
      strongEvery: 3,
    });
  });

  it('falls back to 4/4 for empty, malformed or out-of-range input', () => {
    const def = { beatsPerBar: 4, subdivisionsPerBeat: 1, strongEvery: 4 };
    expect(metronomePattern(null)).toEqual(def);
    expect(metronomePattern('')).toEqual(def);
    expect(metronomePattern('C')).toEqual(def);
    expect(metronomePattern('0/4')).toEqual(def);
    expect(metronomePattern('99/4')).toEqual(def);
  });
});

describe('parseBeatsPerBar', () => {
  it('returns the audible pulse count', () => {
    expect(parseBeatsPerBar('4/4')).toBe(4);
    expect(parseBeatsPerBar('6/8')).toBe(2);
    expect(parseBeatsPerBar('9/8')).toBe(3);
    expect(parseBeatsPerBar('12/8')).toBe(4);
    expect(parseBeatsPerBar(null)).toBe(4);
  });
});
