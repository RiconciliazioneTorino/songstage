import { describe, expect, it } from 'vitest';
import { transposeChord, transposeKey } from './transpose';

describe('transposeChord', () => {
  it('leaves the chord untouched at zero semitones', () => {
    expect(transposeChord('F#m7', 0, 'C')).toBe('F#m7');
  });

  it('keeps the quality suffix', () => {
    expect(transposeChord('Dm7', 2, 'C')).toBe('Em7');
    expect(transposeChord('Gsus4', 2, 'C')).toBe('Asus4');
    expect(transposeChord('Cmaj7', 1, 'C')).toBe('C#maj7');
  });

  it('wraps around the octave in both directions', () => {
    expect(transposeChord('B', 1, 'C')).toBe('C');
    expect(transposeChord('C', -1, 'C')).toBe('B');
    expect(transposeChord('C', 12, 'C')).toBe('C');
    expect(transposeChord('C', -13, 'C')).toBe('B');
  });

  it('transposes the bass of a slash chord too', () => {
    expect(transposeChord('D/F#', 2, 'C')).toBe('E/G#');
  });

  it('keeps an unparseable bass verbatim', () => {
    expect(transposeChord('D/X', 2, 'C')).toBe('E/X');
  });

  it('spells with flats when the target key is a flat key', () => {
    expect(transposeChord('A', 1, 'Bb')).toBe('Bb');
    expect(transposeChord('A', 1, 'C')).toBe('A#');
  });

  it('accepts enharmonic input spellings', () => {
    expect(transposeChord('Db', 1, 'C')).toBe('D');
    expect(transposeChord('B#', 1, 'C')).toBe('C#');
  });

  it('returns the input unchanged when there is no note to parse', () => {
    expect(transposeChord('N.C.', 2, 'C')).toBe('N.C.');
    expect(transposeChord('%', 2, 'C')).toBe('%');
    expect(transposeChord('   ', 2, 'C')).toBe('   ');
  });
});

describe('transposeKey', () => {
  it('keeps the minor marker', () => {
    expect(transposeKey('Am', 2, )).toBe('Bm');
    expect(transposeKey('Dm', 2)).toBe('Em');
  });

  it('transposes a major key', () => {
    expect(transposeKey('C', 2)).toBe('D');
    expect(transposeKey('G', 5)).toBe('C');
  });

  it('passes through an empty or unparseable key', () => {
    expect(transposeKey('', 2)).toBe('');
    expect(transposeKey('H', 2)).toBe('H');
  });

  it('round-trips over a full octave', () => {
    for (const key of ['C', 'F#', 'Bb', 'Am', 'Ebm']) {
      expect(transposeKey(transposeKey(key, 5), 7)).toBe(transposeKey(key, 12));
    }
  });
});
