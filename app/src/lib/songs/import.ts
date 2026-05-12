import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import { parseOnSong } from '@/lib/onsong';

export type ImportRow = {
  filename: string;
  title: string;
  artist: string | null;
  originalKey: string | null;
  tempo: number | null;
  body: string;
};

export type ImportResult = {
  rows: ImportRow[];
  skipped: { filename: string; reason: string }[];
};

function decode(buf: Buffer): string {
  // Try UTF-8 first with strict mode
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    if (!text.includes('�')) return text;
  } catch {
    /* fallthrough */
  }
  // Fallback: macroman is most common for OnSong/iPad backups
  try {
    const macroman = iconv.decode(buf, 'macroman');
    if (!macroman.includes('�')) return macroman;
    return macroman;
  } catch {
    /* fallthrough */
  }
  return iconv.decode(buf, 'latin1');
}

export function parseOnSongBackup(zipBuffer: Buffer): ImportResult {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const rows: ImportRow[] = [];
  const skipped: { filename: string; reason: string }[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;
    if (!name.toLowerCase().endsWith('.onsong')) continue;
    if (name.includes('welcome_to_onsong/') || name.includes('template_sample_song/')) continue;

    let body: string;
    try {
      body = decode(entry.getData());
    } catch (e) {
      skipped.push({ filename: name, reason: `decode error: ${(e as Error).message}` });
      continue;
    }

    const trimmed = body.trim();
    if (!trimmed) {
      skipped.push({ filename: name, reason: 'file vuoto' });
      continue;
    }

    const parsed = parseOnSong(body);
    const fallbackTitle = name.split('/').pop()!.replace(/\.onsong$/i, '');
    const title = parsed.meta.title?.trim() || fallbackTitle;

    if (parsed.lines.length === 0) {
      skipped.push({ filename: name, reason: 'nessun contenuto dopo gli header' });
      continue;
    }

    const tempoStr = parsed.meta.tempo;
    const tempoNum = tempoStr ? parseInt(tempoStr, 10) : NaN;

    rows.push({
      filename: name,
      title,
      artist: parsed.meta.artist?.trim() || null,
      originalKey: parsed.meta.key?.trim() || null,
      tempo: Number.isFinite(tempoNum) ? tempoNum : null,
      body,
    });
  }

  return { rows, skipped };
}
