import type { Song } from './onsong';
import { transposeChord, transposeKey } from './transpose';

export type RenderOptions = {
  semitones: number;
  fontScale: number;
  showChords: boolean;
};

export function renderSong(song: Song, opts: RenderOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'song';
  root.style.fontSize = `${opts.fontScale}em`;

  const head = document.createElement('header');
  head.className = 'song-head';
  const titleEl = document.createElement('h1');
  titleEl.textContent = song.meta.title ?? 'Untitled';
  head.appendChild(titleEl);

  const metaParts: string[] = [];
  if (song.meta.artist) metaParts.push(song.meta.artist);
  const targetKey = song.meta.key ? transposeKey(song.meta.key, opts.semitones) : '';
  if (targetKey) {
    metaParts.push(
      song.meta.key && opts.semitones !== 0
        ? `Key: ${targetKey} (orig ${song.meta.key})`
        : `Key: ${targetKey}`
    );
  }
  if (song.meta.tempo) metaParts.push(`${song.meta.tempo} bpm`);
  if (metaParts.length) {
    const sub = document.createElement('div');
    sub.className = 'song-meta';
    sub.textContent = metaParts.join(' · ');
    head.appendChild(sub);
  }
  root.appendChild(head);

  const body = document.createElement('div');
  body.className = 'song-body';
  if (!opts.showChords) body.classList.add('no-chords');

  for (const line of song.lines) {
    if (line.kind === 'blank') {
      const sp = document.createElement('div');
      sp.className = 'line blank';
      body.appendChild(sp);
      continue;
    }
    if (line.kind === 'section') {
      const sec = document.createElement('div');
      sec.className = 'line section';
      sec.textContent = line.label;
      body.appendChild(sec);
      continue;
    }
    if (line.kind === 'comment') {
      const c = document.createElement('div');
      c.className = 'line comment';
      c.textContent = line.text;
      body.appendChild(c);
      continue;
    }

    const lineEl = document.createElement('div');
    lineEl.className = 'line lyric';

    const tokens = line.tokens;
    let i = 0;
    if (tokens.length === 0) {
      lineEl.appendChild(document.createElement('br'));
      body.appendChild(lineEl);
      continue;
    }

    if (tokens[0].kind === 'text' && tokens[0].value.length > 0) {
      const pair = document.createElement('span');
      pair.className = 'pair';
      const chord = document.createElement('span');
      chord.className = 'chord empty';
      chord.innerHTML = '&nbsp;';
      const lyric = document.createElement('span');
      lyric.className = 'lyric';
      lyric.textContent = tokens[0].value;
      pair.appendChild(chord);
      pair.appendChild(lyric);
      lineEl.appendChild(pair);
      i = 1;
    }

    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok.kind === 'chord') {
        const next = tokens[i + 1];
        const lyricText = next && next.kind === 'text' ? next.value : ' ';
        const pair = document.createElement('span');
        pair.className = 'pair';
        const chord = document.createElement('span');
        chord.className = 'chord';
        chord.textContent = transposeChord(tok.value, opts.semitones, targetKey || song.meta.key || 'C');
        const lyric = document.createElement('span');
        lyric.className = 'lyric';
        lyric.textContent = lyricText;
        pair.appendChild(chord);
        pair.appendChild(lyric);
        lineEl.appendChild(pair);
        i += next && next.kind === 'text' ? 2 : 1;
      } else {
        const pair = document.createElement('span');
        pair.className = 'pair';
        const chord = document.createElement('span');
        chord.className = 'chord empty';
        chord.innerHTML = '&nbsp;';
        const lyric = document.createElement('span');
        lyric.className = 'lyric';
        lyric.textContent = tok.value;
        pair.appendChild(chord);
        pair.appendChild(lyric);
        lineEl.appendChild(pair);
        i++;
      }
    }

    body.appendChild(lineEl);
  }

  root.appendChild(body);
  return root;
}
