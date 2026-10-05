'use client';

import { useMemo, useState } from 'react';
import { updateSong } from '@/lib/songs/actions';
import { transposeChord, transposeKey } from '@/lib/onsong/transpose';
import { parseOnSong, SongView } from '@/lib/onsong';

function transposeOnSongBody(body: string, semitones: number): string {
  if (semitones === 0) return body;
  const parsed = parseOnSong(body);
  const targetKey = parsed.meta.key
    ? transposeKey(parsed.meta.key, semitones)
    : 'C';
  // Transpose all [chord] tokens
  let out = body.replace(/\[([^\]]+)\]/g, (_m, chord: string) => {
    const trimmed = chord.trim();
    if (!trimmed) return `[${chord}]`;
    return `[${transposeChord(trimmed, semitones, targetKey)}]`;
  });
  // Update `Key:` header line if present
  out = out.replace(
    /^(\s*Key\s*:\s*)(\[?)([A-G][#b]?m?(?:aj|in)?)(\]?)(\s*)$/im,
    (_m, prefix: string, lb: string, key: string, rb: string, suffix: string) => {
      const newKey = transposeKey(key, semitones);
      return `${prefix}${lb}${newKey}${rb}${suffix}`;
    }
  );
  return out;
}

export function EditSongForm({
  slug,
  songId,
  initialBody,
}: {
  slug: string;
  songId: string;
  initialBody: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [keyShift, setKeyShift] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const parsed = useMemo(() => parseOnSong(body), [body]);
  const currentKey = parsed.meta.key ?? '?';
  const originalKey = useMemo(() => {
    // Recompute what the key was BEFORE the accumulated shift
    if (!parsed.meta.key || keyShift === 0) return parsed.meta.key ?? null;
    return transposeKey(parsed.meta.key, -keyShift);
  }, [parsed.meta.key, keyShift]);

  function applyTranspose(delta: number) {
    setBody((prev) => transposeOnSongBody(prev, delta));
    setKeyShift((s) => s + delta);
  }

  async function action(formData: FormData) {
    formData.set('body', body);
    formData.set('keyShift', String(keyShift));
    setPending(true);
    setError(null);
    const result = await updateSong(slug, songId, formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <>
    <form action={action} className="space-y-4" data-no-print>
      <div className="rounded-md border border-border bg-panel p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-zinc-400">Tonalità base:</span>
          <span className="text-sm font-mono px-2 py-0.5 rounded bg-bg border border-border">
            {currentKey}
          </span>
          {keyShift !== 0 && originalKey && (
            <span className="text-xs text-zinc-500">
              (era {originalKey}, spostata di {keyShift > 0 ? '+' : ''}
              {keyShift})
            </span>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => applyTranspose(-1)}
            className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent text-xl leading-none flex items-center justify-center"
            title="Abbassa di un semitono"
          >
            ♭
          </button>
          <button
            type="button"
            onClick={() => applyTranspose(1)}
            className="min-w-[2.25rem] h-9 rounded border border-border hover:border-accent text-xl leading-none flex items-center justify-center"
            title="Alza di un semitono"
          >
            ♯
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className={`h-9 px-3 rounded border text-sm flex items-center justify-center ${
              previewOpen
                ? 'border-accent text-accent'
                : 'border-border text-zinc-400 hover:border-accent hover:text-white'
            }`}
            title={previewOpen ? 'Nascondi anteprima' : 'Mostra anteprima'}
            aria-pressed={previewOpen}
          >
            {previewOpen ? 'Nascondi anteprima' : 'Anteprima'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3 rounded border border-border hover:border-accent text-sm flex items-center justify-center"
            title="Esporta in PDF (fondo bianco, acordi rossi, sezioni verdi)"
          >
            PDF
          </button>
        </div>
        {keyShift !== 0 && (
          <p className="text-xs text-yellow-300/90">
            ⚠ Stai cambiando la tonalità della <b>versione base</b>. I set che
            usano questa canzone verranno compensati automaticamente per
            mantenere la loro tonalità finale.
          </p>
        )}
      </div>

      <div className={previewOpen ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">OnSong body</label>
          <textarea
            name="body"
            required
            rows={24}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none font-mono text-sm"
          />
        </div>
        {previewOpen && (
          <div>
            <label className="text-sm text-zinc-400 block mb-1">Anteprima</label>
            <div className="rounded-md bg-panel border border-border p-4 max-h-[36rem] overflow-auto">
              <SongView song={parsed} semitones={0} fontScale={0.9} />
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="text-sm text-zinc-400 block mb-1">Note di versione (opzionale)</label>
        <input
          name="notes"
          placeholder="Es: nuovo arrangiamento del ponte, fix testo v.2…"
          className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? 'Salvataggio…' : 'Salva come nuova versione'}
        </button>
        {error && <p className="text-sm text-red-400 self-center">{error}</p>}
      </div>
    </form>
    <div className="print-only" aria-hidden>
      <SongView song={parsed} semitones={0} fontScale={1} showChords />
    </div>
    </>
  );
}
