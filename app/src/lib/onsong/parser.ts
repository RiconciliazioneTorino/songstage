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

const KNOWN_HEADERS = new Set([
  'title', 'artist', 'byline', 'subtitle', 'composer', 'copyright',
  'key', 'tempo', 'time', 'capo', 'duration', 'ccli', 'topic', 'flow',
  'keywords', 'number', 'language', 'translator',
]);

const SECTION_LABELS = [
  'verse', 'chorus', 'bridge', 'intro', 'outro', 'pre-chorus',
  'prechorus', 'tag', 'interlude', 'instrumental', 'coda', 'refrain',
  'estrofa', 'coro', 'puente', 'introducción', 'final', 'estribillo',
  'verso', 'ponte', 'strumentale', 'ritornello', 'finale',
  'preestribillo', 'pre-coro', 'precoro',
];

function unwrapBrackets(value: string): string {
  const trimmed = value.trim();
  const m = trimmed.match(/^\[([^\]]+)\]$/);
  return m ? m[1].trim() : trimmed;
}

const CHORD_TOKEN_RE = /^[A-G][#b]?[majinsudgM°ø+\-#b\d]*(?:\/[A-G][#b]?)?$/;

function isChordToken(t: string): boolean {
  if (!t) return false;
  if (t.length > 12) return false;
  return CHORD_TOKEN_RE.test(t);
}

function isChordOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.includes('[')) return false;
  if (trimmed.endsWith(':')) return false;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;
  return tokens.every(isChordToken);
}

// Line consisting of only bracketed chord tokens and whitespace,
// e.g. "[D]       [Em]       [A]   [D]"
function isBracketedChordOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.includes('[')) return false;
  const stripped = trimmed.replace(/\[([^\]]+)\]/g, (_, c) =>
    isChordToken(c.trim()) ? '' : c
  );
  return stripped.trim() === '';
}

// Positions of chords in a chord line. For inline-bracketed chord lines,
// the position is the column of '['; for bare chord lines, the column of the token.
function extractChordPositions(chordLine: string): { col: number; chord: string }[] {
  const positions: { col: number; chord: string }[] = [];
  if (chordLine.includes('[')) {
    const re = /\[([^\]]+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chordLine)) !== null) {
      positions.push({ col: m.index, chord: m[1].trim() });
    }
    return positions;
  }
  let col = 0;
  while (col < chordLine.length) {
    if (/\s/.test(chordLine[col])) { col++; continue; }
    let end = col;
    while (end < chordLine.length && !/\s/.test(chordLine[end])) end++;
    positions.push({ col, chord: chordLine.slice(col, end) });
    col = end;
  }
  return positions;
}

function mergeChordOverLyric(chordLine: string, lyricLine: string): string {
  const positions = extractChordPositions(chordLine);

  let out = '';
  let lyricPos = 0;
  for (const { col, chord } of positions) {
    while (lyricPos < col) {
      out += lyricPos < lyricLine.length ? lyricLine[lyricPos] : ' ';
      lyricPos++;
    }
    out += `[${chord}]`;
  }
  out += lyricLine.slice(lyricPos);
  return out;
}

function normalizeChordLines(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const curIsChord = isChordOnlyLine(cur) || isBracketedChordOnlyLine(cur);
    if (curIsChord) {
      const next = lines[i + 1];
      const nextIsChord = next !== undefined
        && (isChordOnlyLine(next) || isBracketedChordOnlyLine(next));
      if (
        next !== undefined &&
        next.trim() &&
        !nextIsChord &&
        !isSectionLine(next) &&
        !next.trim().startsWith('#')
      ) {
        out.push(mergeChordOverLyric(cur, next));
        i++;
        continue;
      }
    }
    out.push(cur);
  }
  return out;
}

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

  let i = 0;

  // OnSong native: optional bare title on line 1, optional bare byline on line 2
  // Heuristic: a line is a "bare header" if it has no '[' brackets, no ':', and is not a known header pattern.
  if (i < rawLines.length) {
    const first = rawLines[i].trim();
    if (first && !first.includes('[') && !HEADER_RE.test(first)) {
      meta.title = first;
      i++;
      const second = rawLines[i]?.trim();
      if (second && !second.includes('[') && !HEADER_RE.test(second) && !isSectionLine(rawLines[i])) {
        meta.artist = second;
        i++;
      }
    }
  }

  // Header block: consume lines that match `Key: value` until first blank or non-header line.
  while (i < rawLines.length) {
    const raw = rawLines[i];
    const trimmed = raw.trim();
    if (trimmed === '') { i++; break; }

    const m = trimmed.match(HEADER_RE);
    if (m && KNOWN_HEADERS.has(m[1].toLowerCase().trim())) {
      const headerKey = m[1].toLowerCase().trim();
      let value = m[2].trim();
      // OnSong wraps Key in brackets: `Key: [Dm]`
      if (headerKey === 'key') value = unwrapBrackets(value);
      // Tempo may have suffix like "70 BPM"
      if (headerKey === 'tempo') value = value.replace(/\s*bpm\s*$/i, '').trim();
      // Map byline → artist for compatibility
      const targetKey = headerKey === 'byline' ? 'artist' : headerKey;
      if (meta[targetKey] === undefined) meta[targetKey] = value;
      i++;
      continue;
    }
    break;
  }

  // Body — normalize chord-over-lyric pairs into inline format before tokenizing
  const bodyLines = normalizeChordLines(rawLines.slice(i));
  for (const raw of bodyLines) {
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
