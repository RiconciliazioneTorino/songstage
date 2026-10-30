import { describe, expect, it } from 'vitest';
import { parseSnippet } from './content-search';

describe('parseSnippet', () => {
  it('picks out the marked hit', () => {
    expect(parseSnippet('amore non mi «lascera» mai')).toEqual([
      { text: 'amore non mi ', hit: false },
      { text: 'lascera', hit: true },
      { text: ' mai', hit: false },
    ]);
  });

  it('handles several hits', () => {
    const parts = parseSnippet('il tuo «amore» e la tua «grazia»');
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['amore', 'grazia']);
  });

  it('collapses the line breaks of an OnSong body', () => {
    expect(parseSnippet('tutto il «cuore»\n  G la mia anima')).toEqual([
      { text: 'tutto il ', hit: false },
      { text: 'cuore', hit: true },
      { text: ' G la mia anima', hit: false },
    ]);
  });

  it('is empty for a snippet with nothing to show', () => {
    expect(parseSnippet('')).toEqual([]);
    expect(parseSnippet('   \n ')).toEqual([]);
  });

  it('keeps unmarked text when the hit was not marked', () => {
    expect(parseSnippet('solo testo')).toEqual([{ text: 'solo testo', hit: false }]);
  });
});
