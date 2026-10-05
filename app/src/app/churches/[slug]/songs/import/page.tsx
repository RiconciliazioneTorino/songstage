'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

type ImportSummary = {
  imported: number;
  failedCount: number;
  skippedCount: number;
  failed: { title: string; error: string }[];
  skipped: { filename: string; reason: string }[];
};

export default function ImportPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setPending(true);
    setError(null);
    setResult(null);

    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/churches/${params.slug}/songs/import`, {
      method: 'POST',
      body: fd,
    });
    setPending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Error ${res.status}`);
      return;
    }
    const body: ImportSummary = await res.json();
    setResult(body);
    router.refresh();
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <Link
        href={`/churches/${params.slug}/songs`}
        className="text-sm text-zinc-400 hover:text-white"
      >
        ← Canzoni
      </Link>
      <h1 className="text-3xl font-bold mt-4 mb-2">Importa backup OnSong</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Carica lo zip di backup dell&apos;app OnSong per iPad. Trova tutti i file <code>.onsong</code>{' '}
        all&apos;interno e crea una canzone per ognuno.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="file"
          accept=".zip,application/zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-border file:bg-panel file:text-zinc-200 hover:file:border-accent"
        />
        {file && (
          <div className="text-xs text-zinc-500">
            {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
          </div>
        )}
        <button
          type="submit"
          disabled={!file || pending}
          className="px-4 py-2 rounded-full border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? 'Importazione…' : 'Importa'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      {result && (
        <div className="mt-8 space-y-4">
          <div className="rounded-md border border-accent/40 bg-accent/5 p-4">
            <div className="text-2xl font-bold text-accent">{result.imported}</div>
            <div className="text-sm text-zinc-300">canzoni importate</div>
            {(result.failedCount > 0 || result.skippedCount > 0) && (
              <div className="text-xs text-zinc-400 mt-1">
                {result.failedCount} con errore · {result.skippedCount} saltate
              </div>
            )}
          </div>

          {result.failed.length > 0 && (
            <details className="rounded-md border border-border bg-panel p-3">
              <summary className="cursor-pointer text-sm text-zinc-300">
                Errori ({result.failed.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                {result.failed.map((f, i) => (
                  <li key={i}>
                    <span className="text-red-400">{f.title}</span>: {f.error}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {result.skipped.length > 0 && (
            <details className="rounded-md border border-border bg-panel p-3">
              <summary className="cursor-pointer text-sm text-zinc-300">
                Saltate ({result.skipped.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    <span className="text-zinc-500">{s.filename}</span>: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <Link
            href={`/churches/${params.slug}/songs`}
            className="inline-block text-sm text-accent hover:underline"
          >
            Vedi canzoni →
          </Link>
        </div>
      )}
    </main>
  );
}
