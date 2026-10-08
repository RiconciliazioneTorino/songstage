import { describe, expect, it } from 'vitest';
import { buildFlow, detectGutter, medianCharWidth, sectionizeLines, type Item } from './import';

/** An item laid out at (x, y) with a monospace-ish width of 6 per glyph. */
function item(str: string, x: number, y: number, charW = 6): Item {
  return { str, transform: [1, 0, 0, 1, x, y], width: str.length * charW, height: 10 };
}

describe('medianCharWidth', () => {
  it('returns the median glyph width', () => {
    expect(medianCharWidth([item('abc', 0, 0, 6), item('de', 0, 0, 6), item('f', 0, 0, 10)])).toBe(6);
  });

  it('falls back when nothing measurable is present', () => {
    expect(medianCharWidth([])).toBe(6);
    expect(medianCharWidth([{ str: '', transform: [1, 0, 0, 1, 0, 0], width: 0, height: 0 }])).toBe(6);
  });
});

describe('detectGutter', () => {
  it('returns null when there is too little text to judge', () => {
    expect(detectGutter([item('ciao', 0, 100)], 600)).toBeNull();
  });

  it('returns null for a single-column page', () => {
    const items: Item[] = [];
    for (let i = 0; i < 30; i++) items.push(item('testo che attraversa', 20, 700 - i * 12));
    expect(detectGutter(items, 600)).toBeNull();
  });

  it('finds the gap between two columns', () => {
    const items: Item[] = [];
    for (let i = 0; i < 20; i++) {
      items.push(item('sinistra', 20, 700 - i * 12));
      items.push(item('destra', 340, 700 - i * 12));
    }
    const gutter = detectGutter(items, 600);
    expect(gutter).not.toBeNull();
    // Between the end of the left column and the start of the right one.
    expect(gutter!).toBeGreaterThan(20 + 8 * 6);
    expect(gutter!).toBeLessThan(340);
  });

  it('ignores a gap with content on only one side', () => {
    const items: Item[] = [];
    for (let i = 0; i < 25; i++) items.push(item('solo a sinistra', 10, 700 - i * 12));
    expect(detectGutter(items, 600)).toBeNull();
  });
});

describe('buildFlow', () => {
  it('orders rows top to bottom and columns left to right', () => {
    const lines = buildFlow(
      [item('mondo', 36, 700), item('ciao', 0, 700), item('seconda', 0, 688)],
      6
    );
    expect(lines[0]).toBe('ciao  mondo');
    expect(lines[1]).toBe('seconda');
  });

  it('pads so a chord lands over the right column of the lyric', () => {
    const chordRow = buildFlow([item('D', 0, 700), item('A', 30, 700)], 6);
    expect(chordRow[0]).toBe('D    A');
  });

  it('groups items a hair off the same baseline into one row', () => {
    const lines = buildFlow([item('ciao', 0, 700), item('mondo', 36, 701)], 6);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('ciao');
    expect(lines[0]).toContain('mondo');
  });

  it('inserts a blank line across a large vertical gap', () => {
    const lines = buildFlow([item('prima', 0, 700), item('dopo', 0, 640)], 6);
    expect(lines).toEqual(['prima', '', 'dopo']);
  });

  it('trims trailing whitespace', () => {
    expect(buildFlow([item('ciao', 0, 700)], 6)[0]).toBe('ciao');
  });
});

describe('sectionizeLines', () => {
  it('adds the colon a section header was typeset without', () => {
    expect(sectionizeLines(['Intro', 'Verse 2', 'Pre-chorus'])).toEqual([
      'Intro:',
      'Verse 2:',
      'Pre-chorus:',
    ]);
  });

  it('handles a leading number', () => {
    expect(sectionizeLines(['1 Verse', '2 Ritornello'])).toEqual(['1 Verse:', '2 Ritornello:']);
  });

  it('is case-insensitive', () => {
    expect(sectionizeLines(['CHORUS', 'ponte'])).toEqual(['CHORUS:', 'ponte:']);
  });

  it('leaves a header that already has its colon alone', () => {
    expect(sectionizeLines(['Intro:'])).toEqual(['Intro:']);
  });

  it('leaves ordinary lyrics alone', () => {
    const lyrics = ['Grande è il Suo nome', 'intro alla tua presenza', ''];
    expect(sectionizeLines(lyrics)).toEqual(lyrics);
  });
});
