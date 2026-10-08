import type { Song, Token } from './parser';
import { groupIntoWords, type Pair } from './layout';
import { transposeChord, transposeKey } from './transpose';

export type SongViewProps = {
  song: Song;
  semitones: number;
  fontScale?: number;
  showChords?: boolean;
};

export function SongView({ song, semitones, fontScale = 1, showChords = true }: SongViewProps) {
  const targetKey = song.meta.key ? transposeKey(song.meta.key, semitones) : 'C';
  const metaParts: string[] = [];
  if (song.meta.artist) metaParts.push(song.meta.artist);
  if (song.meta.key) {
    metaParts.push(
      semitones !== 0 ? `Key: ${targetKey} (orig ${song.meta.key})` : `Key: ${targetKey}`
    );
  }
  if (song.meta.tempo) metaParts.push(`${song.meta.tempo} bpm`);
  if (song.meta.time) metaParts.push(song.meta.time);

  return (
    <div style={{ fontSize: `${fontScale}em` }}>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{song.meta.title ?? 'Senza titolo'}</h1>
        {metaParts.length > 0 && (
          <p className="text-sm text-zinc-400 mt-1">{metaParts.join(' · ')}</p>
        )}
      </header>
      <div className={showChords ? '' : 'no-chords'}>
        {song.lines.map((line, i) => {
          if (line.kind === 'blank') return <div key={i} className="h-4" />;
          if (line.kind === 'section') {
            return (
              <div key={i} className="section-label mt-4 mb-1">
                {line.label}
              </div>
            );
          }
          if (line.kind === 'comment') {
            return (
              <div key={i} className="text-zinc-500 italic text-sm">
                {line.text}
              </div>
            );
          }
          return (
            <LyricLine key={i} tokens={line.tokens} semitones={semitones} targetKey={targetKey} />
          );
        })}
      </div>
    </div>
  );
}

function LyricLine({
  tokens,
  semitones,
  targetKey,
}: {
  tokens: Token[];
  semitones: number;
  targetKey: string;
}) {
  if (tokens.length === 0) return <div className="song-line">&nbsp;</div>;

  const pairs: Pair[] = [];
  let i = 0;
  if (tokens[0].kind === 'text' && tokens[0].value.length > 0) {
    pairs.push({ chord: null, lyric: tokens[0].value });
    i = 1;
  }
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.kind === 'chord') {
      const next = tokens[i + 1];
      const lyric = next && next.kind === 'text' ? next.value : ' ';
      pairs.push({ chord: tok.value, lyric });
      i += next && next.kind === 'text' ? 2 : 1;
    } else {
      pairs.push({ chord: null, lyric: tok.value });
      i++;
    }
  }

  // Wrapping happens between words, never inside one — see layout.ts.
  const words = groupIntoWords(pairs);

  return (
    <div className="song-line mb-1">
      {words.map((word, wi) => (
        <span key={wi} className="word">
          {word.map((p, idx) => {
            const chordOnly = !!p.chord && !/\S/.test(p.lyric);
            return (
              <span key={idx} className={`pair${chordOnly ? ' chord-only' : ''}`}>
                <span className={`chord${p.chord ? '' : ' empty'}`}>
                  {p.chord ? transposeChord(p.chord, semitones, targetKey) : ' '}
                </span>
                <span className="lyric">{p.lyric}</span>
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}
