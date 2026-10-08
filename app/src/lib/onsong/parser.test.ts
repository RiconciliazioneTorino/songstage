import { describe, expect, it } from 'vitest';
import { parseOnSong, type Line, type Token } from './parser';

/** The chord/lyric pairs of the nth lyric line, as a readable shape. */
function lyricLines(lines: Line[]): Token[][] {
  return lines.filter((l): l is Extract<Line, { kind: 'lyric' }> => l.kind === 'lyric').map((l) => l.tokens);
}
function chordsOf(tokens: Token[]): string[] {
  return tokens.filter((t) => t.kind === 'chord').map((t) => t.value);
}
function textOf(tokens: Token[]): string {
  return tokens.filter((t) => t.kind === 'text').map((t) => t.value).join('');
}

describe('metadata', () => {
  it('reads an explicit header block', () => {
    const song = parseOnSong(['Title: Grande è il Suo nome', 'Artist: Anon', 'Key: D', 'Tempo: 72', 'Time: 3/4', '', 'ciao'].join('\n'));
    expect(song.meta).toMatchObject({
      title: 'Grande è il Suo nome',
      artist: 'Anon',
      key: 'D',
      tempo: '72',
      time: '3/4',
    });
  });

  it('unwraps the bracketed key OnSong writes', () => {
    expect(parseOnSong('Key: [Dm]\n\nciao').meta.key).toBe('Dm');
  });

  it('strips the BPM suffix from tempo', () => {
    expect(parseOnSong('Tempo: 70 BPM\n\nciao').meta.tempo).toBe('70');
    expect(parseOnSong('Tempo: 70bpm\n\nciao').meta.tempo).toBe('70');
  });

  it('maps byline onto artist', () => {
    expect(parseOnSong('Title: X\nByline: Tizio\n\nciao').meta.artist).toBe('Tizio');
  });

  it('takes a bare first line as title and a bare second as artist', () => {
    const song = parseOnSong('Grande è il Suo nome\nAnon\n\nciao');
    expect(song.meta.title).toBe('Grande è il Suo nome');
    expect(song.meta.artist).toBe('Anon');
  });

  it('does not steal a section header as the artist', () => {
    const song = parseOnSong('Il mio canto\nVerse 1:\nciao');
    expect(song.meta.title).toBe('Il mio canto');
    expect(song.meta.artist).toBeUndefined();
    expect(song.lines[0]).toEqual({ kind: 'section', label: 'Verse 1' });
  });

  it('does not treat a chord line as the title', () => {
    const song = parseOnSong('[D]Ciao mondo');
    expect(song.meta.title).toBeUndefined();
    expect(chordsOf(lyricLines(song.lines)[0])).toEqual(['D']);
  });

  it('keeps the first value when a header repeats', () => {
    expect(parseOnSong('Key: D\nKey: E\n\nciao').meta.key).toBe('D');
  });

  it('ignores an unknown header and treats it as body', () => {
    const song = parseOnSong('Title: X\nRandomThing: nope\n\nciao');
    expect(song.meta.randomthing).toBeUndefined();
  });
});

describe('line kinds', () => {
  it('recognises section headers in several languages', () => {
    for (const label of ['Verse 1', 'Chorus', 'Ritornello', 'Puente', 'Pre-Chorus']) {
      const song = parseOnSong(`Title: X\n\n${label}:\nciao`);
      expect(song.lines.find((l) => l.kind === 'section')).toEqual({ kind: 'section', label });
    }
  });

  it('does not treat a random line ending in a colon as a section', () => {
    const song = parseOnSong('Title: X\n\nDisse così:\nciao');
    expect(song.lines.some((l) => l.kind === 'section')).toBe(false);
  });

  it('reads # as a comment', () => {
    const song = parseOnSong('Title: X\n\n# nota per il gruppo');
    expect(song.lines).toContainEqual({ kind: 'comment', text: 'nota per il gruppo' });
  });

  it('keeps blank lines as structure', () => {
    const song = parseOnSong('Title: X\n\nuno\n\ndue');
    expect(song.lines.filter((l) => l.kind === 'blank').length).toBeGreaterThan(0);
  });
});

describe('inline chords', () => {
  it('splits chords from the lyric that follows them', () => {
    const [tokens] = lyricLines(parseOnSong('[D]Grande è il [A]Suo nome').lines);
    expect(chordsOf(tokens)).toEqual(['D', 'A']);
    expect(textOf(tokens)).toBe('Grande è il Suo nome');
  });

  it('keeps leading text before the first chord', () => {
    const [tokens] = lyricLines(parseOnSong('Grande [D]è').lines);
    expect(tokens[0]).toEqual({ kind: 'text', value: 'Grande ' });
  });

  it('leaves an unclosed bracket as literal text', () => {
    const [tokens] = lyricLines(parseOnSong('ciao [D mondo').lines);
    expect(chordsOf(tokens)).toEqual([]);
    expect(textOf(tokens)).toBe('ciao [D mondo');
  });
});

describe('chord-over-lyric sheets', () => {
  it('merges a bare chord line into the lyric below it', () => {
    const song = parseOnSong(['Title: X', '', 'D       A', 'Grande è il Suo'].join('\n'));
    const [tokens] = lyricLines(song.lines);
    expect(chordsOf(tokens)).toEqual(['D', 'A']);
    expect(textOf(tokens)).toBe('Grande è il Suo');
  });

  it('aligns each chord over the column it sat on', () => {
    //         0123456789
    const song = parseOnSong(['Title: X', '', 'D    A', 'ciao mondo'].join('\n'));
    const [tokens] = lyricLines(song.lines);
    // 'D' at col 0 -> before 'ciao', 'A' at col 5 -> before 'mondo'
    expect(tokens).toEqual([
      { kind: 'chord', value: 'D' },
      { kind: 'text', value: 'ciao ' },
      { kind: 'chord', value: 'A' },
      { kind: 'text', value: 'mondo' },
    ]);
  });

  it('does not merge a chord line into a following section header', () => {
    const song = parseOnSong(['Title: X', '', 'D  A', 'Chorus:', 'ciao'].join('\n'));
    expect(song.lines.some((l) => l.kind === 'section' && l.label === 'Chorus')).toBe(true);
  });

  it('does not merge two consecutive chord lines', () => {
    const song = parseOnSong(['Title: X', '', 'D  A', 'G  Em'].join('\n'));
    const lines = lyricLines(song.lines);
    expect(lines).toHaveLength(2);
    expect(chordsOf(lines[0])).toEqual([]);
  });

  it('handles a line of bracketed chords with no lyric under it', () => {
    const song = parseOnSong(['Title: X', '', '[D]    [Em]   [A]'].join('\n'));
    const [tokens] = lyricLines(song.lines);
    expect(chordsOf(tokens)).toEqual(['D', 'Em', 'A']);
  });

  it('does not mistake a lyric line for chords', () => {
    const song = parseOnSong(['Title: X', '', 'Ciao a tutti', 'come va'].join('\n'));
    expect(lyricLines(song.lines)).toHaveLength(2);
  });
});

describe('robustness', () => {
  it('handles CRLF input', () => {
    const song = parseOnSong('Title: X\r\nKey: D\r\n\r\n[D]ciao');
    expect(song.meta.key).toBe('D');
    expect(chordsOf(lyricLines(song.lines)[0])).toEqual(['D']);
  });

  it('handles an empty document', () => {
    const song = parseOnSong('');
    expect(song.meta).toEqual({});
    expect(song.lines.every((l) => l.kind === 'blank')).toBe(true);
  });
});
