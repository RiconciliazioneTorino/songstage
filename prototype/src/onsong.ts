export type SongMeta = {
  title?: string;
  artist?: string;
  key?: string;
  tempo?: string;
  time?: string;
  capo?: string;
  [k: string]: string | undefined;
};

export type Token =
  | { kind: 'chord'; value: string }
  | { kind: 'text'; value: string };

export type Line =
  | { kind: 'section'; label: string }
  | { kind: 'comment'; text: string }
  | { kind: 'blank' }
  | { kind: 'lyric'; tokens: Token[] };

export type Song = {
  meta: SongMeta;
  lines: Line[];
};

const HEADER_RE = /^([A-Za-z][A-Za-z _-]*):\s*(.+)$/;
const SECTION_LABELS = [
  'verse', 'chorus', 'bridge', 'intro', 'outro', 'pre-chorus',
  'prechorus', 'tag', 'interlude', 'instrumental', 'coda', 'refrain',
  'estrofa', 'coro', 'puente', 'introducción', 'final', 'estribillo',
];

function isSectionLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.endsWith(':')) return false;
  const label = trimmed.slice(0, -1).toLowerCase().replace(/\s*\d+$/, '').trim();
  return SECTION_LABELS.includes(label);
}

function tokenizeLyric(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let buf = '';
  while (i < line.length) {
    if (line[i] === '[') {
      const end = line.indexOf(']', i);
      if (end === -1) { buf += line[i]; i++; continue; }
      if (buf) { tokens.push({ kind: 'text', value: buf }); buf = ''; }
      tokens.push({ kind: 'chord', value: line.slice(i + 1, end) });
      i = end + 1;
    } else {
      buf += line[i];
      i++;
    }
  }
  if (buf) tokens.push({ kind: 'text', value: buf });
  return tokens;
}

export function parseOnSong(source: string): Song {
  const rawLines = source.replace(/\r\n/g, '\n').split('\n');
  const meta: SongMeta = {};
  const lines: Line[] = [];

  let inHeader = true;
  for (const raw of rawLines) {
    if (inHeader) {
      if (raw.trim() === '') { inHeader = false; continue; }
      const m = raw.match(HEADER_RE);
      if (m && !raw.includes('[')) {
        meta[m[1].toLowerCase()] = m[2].trim();
        continue;
      }
      inHeader = false;
    }

    if (raw.trim() === '') { lines.push({ kind: 'blank' }); continue; }
    if (isSectionLine(raw)) {
      lines.push({ kind: 'section', label: raw.trim().slice(0, -1) });
      continue;
    }
    if (raw.trim().startsWith('#')) {
      lines.push({ kind: 'comment', text: raw.trim().slice(1).trim() });
      continue;
    }
    lines.push({ kind: 'lyric', tokens: tokenizeLyric(raw) });
  }

  return { meta, lines };
}
