'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { extractTextFromPdf } from '@/lib/pdf/import';
import { parseOnSong, SongView } from '@/lib/onsong';
import { createSong } from '@/lib/songs/actions';

export function PdfImportForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [extracting, setExtracting] = useState(false);
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  async function onFile(file: File) {
    setError(null);
    setExtracting(true);
    try {
      const text = await extractTextFromPdf(file);
      if (!text.trim()) {
        setError(
          'Il PDF non contiene testo estraibile. Potrebbe essere scansionato (serve OCR).'
        );
        return;
      }
      setBody(text);
      // Guess title from first non-empty line
      const first = text.split('\n').find((l) => l.trim());
      if (first && !title) setTitle(first.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante l\'estrazione');
    } finally {
      setExtracting(false);
    }
  }

  const parsed = body ? parseOnSong(body) : null;

  function save() {
    const fd = new FormData();
    fd.set('body', body);
    if (title.trim()) fd.set('title', title.trim());
    startSave(async () => {
      const res = await createSong(slug, fd);
      if (res?.error) setError(res.error);
      else router.push(`/churches/${slug}/songs`);
    });
  }

  if (!body) {
    return (
      <div className="space-y-4">
        <label
          className={`block w-full border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${
            extracting
              ? 'border-accent/50 text-accent'
              : 'border-border text-zinc-400 hover:border-accent hover:text-accent'
          }`}
        >
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={extracting}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="hidden"
          />
          {extracting ? 'Estrazione in corso…' : 'Clicca per selezionare un PDF'}
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-zinc-400 block mb-1">Titolo</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titolo canzone"
          className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-zinc-400 flex items-center justify-between mb-1">
            <span>Testo estratto (modificabile)</span>
            <button
              type="button"
              onClick={() => {
                setBody('');
                setTitle('');
                setError(null);
              }}
              className="text-xs text-zinc-500 hover:text-white"
            >
              Ricomincia
            </button>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={24}
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none font-mono text-sm whitespace-pre"
          />
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Anteprima</label>
          <div className="rounded-md bg-panel border border-border p-4 max-h-[36rem] overflow-auto">
            {parsed && <SongView song={parsed} semitones={0} fontScale={0.9} />}
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Rivedi il testo: aggiungi header come <code>Key: C</code>,{' '}
        <code>Tempo: 90</code>, <code>Time: 4/4</code>, e marca sezioni con{' '}
        <code>Coro:</code>, <code>Verso 1:</code>, ecc.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || !body.trim()}
          className="px-4 py-2 rounded-full border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {saving ? 'Salvataggio…' : 'Crea canzone'}
        </button>
        {error && <p className="text-sm text-red-400 self-center">{error}</p>}
      </div>
    </div>
  );
}
