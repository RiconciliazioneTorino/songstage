/**
 * Extract chord-sheet-friendly plain text from a PDF, preserving column
 * alignment so chords stay above their lyrics.
 *
 * Strategy:
 *  1. For each page, pull text items with their X/Y transforms via pdf.js.
 *  2. Cluster items by Y (within a tolerance) to form lines.
 *  3. Within a line, lay them out on a monospace grid using the page's
 *     median glyph width, padding with spaces between items.
 *  4. Concatenate lines across pages. Our existing OnSong parser handles the
 *     chord-over-lyric merge on top of this plain text.
 */
export async function extractTextFromPdf(file: File | Blob): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist');
  // Next bundles this worker as a static asset and gives us its URL.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const allLines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>;
    if (items.length === 0) continue;

    // Median glyph width across items with content
    const widths: number[] = [];
    for (const it of items) {
      const n = it.str.length;
      if (n > 0 && it.width > 0) widths.push(it.width / n);
    }
    widths.sort((a, b) => a - b);
    const charW = widths.length > 0 ? widths[Math.floor(widths.length / 2)] : 6;

    // Group by Y (round to nearest value, tolerate 2 units jitter)
    const rows = new Map<number, typeof items>();
    for (const it of items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5] / 2) * 2;
      let bucket: typeof items | undefined;
      // Snap into a nearby existing bucket within ±2
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
      allLines.push(line.replace(/\s+$/, ''));
    }
    allLines.push(''); // blank between pages
  }

  // Collapse 3+ blank lines to 2
  return allLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
