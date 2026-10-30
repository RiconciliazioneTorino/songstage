import { describe, expect, it } from 'vitest';
import { matchesTitleOrArtist, parseSnippet, sortByRelevance } from './content-search';

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

  it('treats an escaped line break from an imported body as a break', () => {
    expect(parseSnippet('Verso:\\r G «Voglio» gridare')).toEqual([
      { text: 'Verso: G ', hit: false },
      { text: 'Voglio', hit: true },
      { text: ' gridare', hit: false },
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

describe('sortByRelevance', () => {
  const song = (id: string, title: string, artist: string | null = null) => ({ id, title, artist });
  const content = (ids: string[]) =>
    new Map(
      ids.map((id, order) => [
        id,
        { songId: id, snippet: '', source: 'version' as const, order },
      ])
    );

  it('puts the song the leader named above the ones that sing the same words', () => {
    const songs = [
      song('a', 'Così Così Buono'),
      song('b', 'Questa è la grazia Tua'),
      song('c', 'Desidero'),
    ];
    const sorted = sortByRelevance(songs, 'Questa è la grazia Tua', content(['a', 'c']));
    expect(sorted.map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('prefers exact, then prefix, then anywhere in the title', () => {
    const songs = [
      song('anywhere', 'La Tua grazia infinita'),
      song('exact', 'Grazia'),
      song('prefix', 'Grazia su grazia'),
    ];
    const sorted = sortByRelevance(songs, 'grazia', new Map());
    expect(sorted.map((s) => s.id)).toEqual(['exact', 'prefix', 'anywhere']);
  });

  it('ranks the artist above a text-only match', () => {
    const songs = [song('text', 'Nessun titolo'), song('artist', 'Altro', 'Elevation Worship')];
    const sorted = sortByRelevance(songs, 'elevation', content(['text']));
    expect(sorted.map((s) => s.id)).toEqual(['artist', 'text']);
  });

  it('keeps the ranked order Postgres returned among the text-only matches', () => {
    const songs = [song('c', 'C'), song('a', 'A'), song('b', 'B')];
    const sorted = sortByRelevance(songs, 'qualcosa', content(['b', 'a', 'c']));
    expect(sorted.map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('matches titles and artists without their accents', () => {
    expect(matchesTitleOrArtist(song('x', 'Questa è la grazia Tua'), 'questa e la grazia')).toBe(
      true
    );
    expect(matchesTitleOrArtist(song('x', 'Maestà'), 'maesta')).toBe(true);
    expect(matchesTitleOrArtist(song('x', 'Maestà'), 'gloria')).toBe(false);
  });

  it('leaves the list alone when nothing was typed', () => {
    const songs = [song('c', 'C'), song('a', 'A')];
    expect(sortByRelevance(songs, '  ', new Map())).toBe(songs);
  });
});
