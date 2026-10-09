import { describe, expect, it } from 'vitest';
import { metronomePattern, parseBeatsPerBar } from './time-signature';

describe('metronomePattern', () => {
  it('simple meters click once per beat with no subdivision', () => {
    expect(metronomePattern('4/4')).toEqual({ beatsPerBar: 4, subdivisionsPerBeat: 1 });
    expect(metronomePattern('3/4')).toEqual({ beatsPerBar: 3, subdivisionsPerBeat: 1 });
    expect(metronomePattern('2/4')).toEqual({ beatsPerBar: 2, subdivisionsPerBeat: 1 });
    expect(metronomePattern('2/2')).toEqual({ beatsPerBar: 2, subdivisionsPerBeat: 1 });
    expect(metronomePattern('5/4')).toEqual({ beatsPerBar: 5, subdivisionsPerBeat: 1 });
    expect(metronomePattern('7/8')).toEqual({ beatsPerBar: 7, subdivisionsPerBeat: 1 });
  });

  it('compound meters divide each pulse into three subdivisions', () => {
    expect(metronomePattern('6/8')).toEqual({ beatsPerBar: 2, subdivisionsPerBeat: 3 });
    expect(metronomePattern('9/8')).toEqual({ beatsPerBar: 3, subdivisionsPerBeat: 3 });
    expect(metronomePattern('12/8')).toEqual({ beatsPerBar: 4, subdivisionsPerBeat: 3 });
    expect(metronomePattern('6/16')).toEqual({ beatsPerBar: 2, subdivisionsPerBeat: 3 });
    expect(metronomePattern('12/16')).toEqual({ beatsPerBar: 4, subdivisionsPerBeat: 3 });
  });

  it('3/8 stays simple (one dotted-beat bar would be too sparse)', () => {
    expect(metronomePattern('3/8')).toEqual({ beatsPerBar: 3, subdivisionsPerBeat: 1 });
  });

  it('tolerates whitespace', () => {
    expect(metronomePattern(' 6 / 8 ')).toEqual({ beatsPerBar: 2, subdivisionsPerBeat: 3 });
  });

  it('falls back to 4/4-simple on empty, malformed or out-of-range input', () => {
    expect(metronomePattern(null)).toEqual({ beatsPerBar: 4, subdivisionsPerBeat: 1 });
    expect(metronomePattern(undefined)).toEqual({ beatsPerBar: 4, subdivisionsPerBeat: 1 });
    expect(metronomePattern('')).toEqual({ beatsPerBar: 4, subdivisionsPerBeat: 1 });
    expect(metronomePattern('C')).toEqual({ beatsPerBar: 4, subdivisionsPerBeat: 1 });
    expect(metronomePattern('0/4')).toEqual({ beatsPerBar: 4, subdivisionsPerBeat: 1 });
    expect(metronomePattern('99/4')).toEqual({ beatsPerBar: 4, subdivisionsPerBeat: 1 });
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
