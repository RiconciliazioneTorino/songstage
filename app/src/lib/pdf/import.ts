/**
 * Extract chord-sheet-friendly plain text from a PDF, preserving column
 * alignment so chords stay above their lyrics.
 *
 * Strategy:
 *  1. For each page, pull text items with their X/Y transforms via pdf.js.
 *  2. Detect a vertical gutter (empty vertical band near the horizontal
 *     centre). If found, split items into left-column / right-column /
 *     full-width buckets and process each bucket as its own flow so the
 *     columns are not interleaved.
 *  3. Within each bucket, cluster items by Y, order by X, and lay them out
 *     on a monospace grid using the page's median glyph width.
 *  4. Concatenate across pages. The OnSong parser handles chord-over-lyric
 *     merging on top of the plain text.
 */

type Item = { str: string; transform: number[]; width: number; height: number };

function medianCharWidth(items: Item[]): number {
  const widths: number[] = [];
  for (const it of items) {
    const n = it.str.length;
    if (n > 0 && it.width > 0) widths.push(it.width / n);
  }
  if (widths.length === 0) return 6;
  widths.sort((a, b) => a - b);
  return widths[Math.floor(widths.length / 2)];
}

function detectGutter(items: Item[], pageWidth: number): number | null {
  if (items.length < 20) return null;
  const BANDS = 60;
  const bandW = pageWidth / BANDS;
  const occ = new Array(BANDS).fill(0);
  for (const it of items) {
    if (!it.str.trim()) continue;
    const x0 = it.transform[4];
    const x1 = x0 + (it.width || 1);
    const s = Math.max(0, Math.floor(x0 / bandW));
    const e = Math.min(BANDS - 1, Math.floor(x1 / bandW));
    for (let i = s; i <= e; i++) occ[i]++;
  }
  // Only consider gaps that fall within the middle 60% of the page
  const minIdx = Math.floor(BANDS * 0.2);
  const maxIdx = Math.floor(BANDS * 0.8);
  let bestStart = -1;
  let bestEnd = -1;
  let bestLen = 0;
  let i = minIdx;
  while (i <= maxIdx) {
    if (occ[i] === 0) {
      let j = i;
      while (j <= maxIdx && occ[j] === 0) j++;
      const len = j - i;
      if (len > bestLen) {
        bestLen = len;
        bestStart = i;
        bestEnd = j;
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  // Need a meaningful gap: at least ~4% of page width
  if (bestLen < Math.max(2, Math.floor(BANDS * 0.04))) return null;
  // And content on both sides
  const leftCount = occ.slice(0, bestStart).reduce((a, b) => a + b, 0);
  const rightCount = occ.slice(bestEnd).reduce((a, b) => a + b, 0);
  if (leftCount < 3 || rightCount < 3) return null;
  return ((bestStart + bestEnd) / 2) * bandW;
}

function buildFlow(items: Item[], charW: number): string[] {
  // Group items into rows by Y (±2 unit tolerance)
  const rows = new Map<number, Item[]>();
  for (const it of items) {
    if (!it.str) continue;
    const y = Math.round(it.transform[5] / 2) * 2;
    let bucket: Item[] | undefined;
    for (const key of rows.keys()) {
      if (Math.abs(key - y) <= 2) {
        bucket = rows.get(key);
        break;
      }
    }
    if (!bucket) {
      bucket = [];
      rows.set(y, bucket);
    }
    bucket.push(it);
  }

  const ySorted = Array.from(rows.keys()).sort((a, b) => b - a); // top-first
  const lines: string[] = [];
  let prevY: number | null = null;
  for (const y of ySorted) {
    const row = rows.get(y)!;
    row.sort((a, b) => a.transform[4] - b.transform[4]);
    let line = '';
    let col = 0;
    for (const it of row) {
      const target = Math.round(it.transform[4] / charW);
      while (col < target) {
        line += ' ';
        col++;
      }
      line += it.str;
      col += it.str.length;
    }
    // Insert a blank line when the vertical gap to the previous row is big
    if (prevY !== null && prevY - y > 24) lines.push('');
    lines.push(line.replace(/\s+$/, ''));
    prevY = y;
  }
  return lines;
}

const SECTION_RE = new RegExp(
  '^(' +
    [
      'intro', 'outro', 'bridge', 'ponte', 'coda', 'tag', 'interlude',
      'interludio', 'strumentale', 'instrumental', 'finale', 'ending',
      'turnaround', 'break', 'refrain', 'verse', 'verso', 'strofa',
      'chorus', 'coro', 'ritornello', 'pre-chorus', 'prechorus', 'pre-coro',
      'precoro', 'pre-ponte', 'preponte',
    ].join('|') +
    ')(?:\\s*\\d+)?$',
  'i'
);
const NUMBERED_SECTION_RE = new RegExp(
  '^\\d+\\s+(' +
    [
      'verse', 'verso', 'strofa', 'chorus', 'coro', 'ritornello', 'bridge',
      'ponte',
    ].join('|') +
    ')$',
  'i'
);

/**
 * Add a trailing ':' to lines that look like a section header but were
 * typeset without one in the source PDF (e.g. "Intro", "1 Verse",
 * "Pre-chorus"). Only applies when the whole trimmed line matches a known
 * section pattern — regular lyrics are left alone.
 */
function sectionizeLines(lines: string[]): string[] {
  return lines.map((line) => {
    const t = line.trim();
    if (!t || t.endsWith(':')) return line;
    if (SECTION_RE.test(t) || NUMBERED_SECTION_RE.test(t)) return line + ':';
    return line;
  });
}

export async function extractTextFromPdf(file: File | Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const allLines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    // getTextContent() interleaves TextItem with TextMarkedContent markers,
    // which carry no geometry — keep only the ones with actual text.
    const items: Item[] = content.items.flatMap((it) =>
      'str' in it && it.str != null ? [it] : []
    );
    if (items.length === 0) continue;

    const charW = medianCharWidth(items);
    const gutter = detectGutter(items, viewport.width);

    if (gutter === null) {
      allLines.push(...buildFlow(items, charW));
    } else {
      const left: Item[] = [];
      const right: Item[] = [];
      const full: Item[] = [];
      for (const it of items) {
        const x0 = it.transform[4];
        const x1 = x0 + (it.width || 0);
        if (x0 < gutter && x1 > gutter) full.push(it);
        else if (x1 <= gutter) left.push(it);
        else right.push(it);
      }
      if (full.length > 0) allLines.push(...buildFlow(full, charW));
      if (left.length > 0) {
        if (allLines.length > 0) allLines.push('');
        allLines.push(...buildFlow(left, charW));
      }
      if (right.length > 0) {
        if (allLines.length > 0) allLines.push('');
        allLines.push(...buildFlow(right, charW));
      }
    }
    allLines.push('');
  }

  const sectioned = sectionizeLines(allLines);
  return sectioned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
