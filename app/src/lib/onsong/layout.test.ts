import { describe, expect, it } from 'vitest';
import { groupIntoWords, type Pair } from './layout';

/** "G:Ado|—:rerò" — chord before a slash, pairs separated by |. */
function show(words: Pair[][]): string[] {
  return words.map((w) => w.map((p) => `${p.chord ?? '—'}:${p.lyric}`).join('|'));
}

describe('groupIntoWords', () => {
  it('keeps a word split by a mid-word chord in one unbreakable unit', () => {
    // The regression this exists for: "Ad[G]orerò" must not wrap into
    // "Ad" / "orerò" on a narrow screen.
    const pairs: Pair[] = [
      { chord: null, lyric: 'Ad' },
      { chord: 'G', lyric: 'orerò, ' },
      { chord: null, lyric: 'con' },
    ];
    expect(show(groupIntoWords(pairs))).toEqual(['—:Ad|G:orerò, ', '—:con']);
  });

  it('breaks a multi-word pair into separate words', () => {
    const pairs: Pair[] = [{ chord: 'C', lyric: 'con la forza' }];
    expect(show(groupIntoWords(pairs))).toEqual(['C:con ', '—:la ', '—:forza']);
  });

  it('gives the chord to the first segment only', () => {
    const [first, second] = groupIntoWords([{ chord: 'G', lyric: 'uno due' }]);
    expect(first[0].chord).toBe('G');
    expect(second[0].chord).toBeNull();
  });

  it('keeps the trailing space on the word it follows', () => {
    // The space has to survive, or words run together on screen.
    const words = groupIntoWords([{ chord: null, lyric: 'la forza' }]);
    expect(words[0][0].lyric).toBe('la ');
  });

  it('leaves a bare chord as its own unit', () => {
    const pairs: Pair[] = [
      { chord: null, lyric: 'ho ' },
      { chord: 'Am7', lyric: ' ' },
      { chord: 'D11', lyric: ' ' },
    ];
    expect(show(groupIntoWords(pairs))).toEqual(['—:ho ', 'Am7: ', 'D11: ']);
  });

  it('handles an instrumental line of nothing but chords', () => {
    const pairs: Pair[] = [
      { chord: 'G', lyric: ' ' },
      { chord: 'F', lyric: ' ' },
    ];
    expect(groupIntoWords(pairs)).toHaveLength(2);
  });

  it('returns nothing for an empty line', () => {
    expect(groupIntoWords([])).toEqual([]);
  });

  it('preserves the full text of the line', () => {
    const pairs: Pair[] = [
      { chord: null, lyric: "M'inch" },
      { chord: 'G', lyric: 'inerò, perch' },
      { chord: 'F', lyric: 'é sei Re' },
    ];
    const text = groupIntoWords(pairs)
      .flat()
      .map((p) => p.lyric)
      .join('');
    expect(text).toBe("M'inchinerò, perché sei Re");
  });
});
