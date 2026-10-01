'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bulkDeleteSongs } from '@/lib/songs/actions';
import { createSetFromSongs } from '@/lib/sets/actions';

export type SongRow = {
  id: string;
  title: string;
  artist: string | null;
  original_key: string | null;
  default_tempo: number | null;
  time_signature: string | null;
};

export function SongsExplorer({
  slug,
  songs,
  canManage,
}: {
  slug: string;
  songs: SongRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [artist, setArtist] = useState('');
  const [key, setKey] = useState('');
  const [tempoMin, setTempoMin] = useState('');
  const [tempoMax, setTempoMax] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, startTransition] = useTransition();
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [banner, setBanner] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const artists = useMemo(() => {
    const s = new Set<string>();
    for (const song of songs) if (song.artist) s.add(song.artist);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [songs]);

  const keys = useMemo(() => {
    const s = new Set<string>();
    for (const song of songs) if (song.original_key) s.add(song.original_key);
    return Array.from(s).sort();
  }, [songs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = tempoMin ? parseInt(tempoMin, 10) : null;
    const max = tempoMax ? parseInt(tempoMax, 10) : null;
    return songs.filter((s) => {
      if (q && !s.title.toLowerCase().includes(q) && !(s.artist ?? '').toLowerCase().includes(q))
        return false;
      if (artist && s.artist !== artist) return false;
      if (key && s.original_key !== key) return false;
      if (min !== null && (s.default_tempo == null || s.default_tempo < min)) return false;
      if (max !== null && (s.default_tempo == null || s.default_tempo > max)) return false;
      return true;
    });
  }, [songs, query, artist, key, tempoMin, tempoMax]);

  const anyFilter = query || artist || key || tempoMin || tempoMax;
  const allFilteredIds = useMemo(() => filtered.map((s) => s.id), [filtered]);
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) allFilteredIds.forEach((id) => next.delete(id));
      else allFilteredIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function onDelete() {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Eliminare ${selected.size} canzon${selected.size === 1 ? 'e' : 'i'}?`
      )
    )
      return;
    startTransition(async () => {
      const ids = Array.from(selected);
      const res = await bulkDeleteSongs(slug, ids);
      if (res.error) {
        setBanner({ kind: 'error', text: res.error });
        return;
      }
      const msg: string[] = [];
      if (res.deleted) msg.push(`${res.deleted} eliminate`);
      if (res.skipped && res.skipped.length > 0) {
        msg.push(
          `${res.skipped.length} saltate perché usate nei set: ${res.skipped
            .map((s) => `${s.title} (${s.setsCount})`)
            .join(', ')}`
        );
      }
      setBanner({ kind: 'info', text: msg.join(' — ') || 'Fatto.' });
      clearSelection();
      router.refresh();
    });
  }

  function onCreateSet() {
    if (selected.size === 0) return;
    setNewSetName('');
    setSetModalOpen(true);
  }

  function submitCreateSet() {
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await createSetFromSongs(slug, newSetName, ids);
      if (res.error) {
        setBanner({ kind: 'error', text: res.error });
        return;
      }
      setSetModalOpen(false);
      clearSelection();
      if (res.setId) router.push(`/churches/${slug}/sets/${res.setId}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-panel p-3 space-y-2">
        <input
          type="text"
          placeholder="Cerca per titolo o artista…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="flex-1 min-w-[10rem] px-3 py-2 rounded-md bg-bg border border-border text-sm"
          >
            <option value="">Tutti gli artisti</option>
            {artists.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-28 px-3 py-2 rounded-md bg-bg border border-border text-sm"
          >
            <option value="">Tonalità</option>
            {keys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <input
              type="number"
              placeholder="BPM min"
              value={tempoMin}
              onChange={(e) => setTempoMin(e.target.value)}
              className="w-24 px-2 py-2 rounded-md bg-bg border border-border text-sm"
            />
            <span className="text-zinc-500 text-sm">–</span>
            <input
              type="number"
              placeholder="BPM max"
              value={tempoMax}
              onChange={(e) => setTempoMax(e.target.value)}
              className="w-24 px-2 py-2 rounded-md bg-bg border border-border text-sm"
            />
          </div>
          {anyFilter && (
            <button
              onClick={() => {
                setQuery('');
                setArtist('');
                setKey('');
                setTempoMin('');
                setTempoMax('');
              }}
              className="px-3 py-2 rounded-md border border-border text-sm text-zinc-400 hover:border-accent hover:text-white"
            >
              Pulisci
            </button>
          )}
        </div>
        <div className="text-xs text-zinc-500 flex items-center justify-between">
          <span>
            {filtered.length} di {songs.length} canzoni
          </span>
          {filtered.length > 0 && (
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
              />
              Seleziona tutte le filtrate
            </label>
          )}
        </div>
      </div>

      {banner && (
        <div
          className={`text-sm rounded-md border px-3 py-2 ${
            banner.kind === 'error'
              ? 'border-red-500/50 bg-red-950/40 text-red-200'
              : 'border-accent/50 bg-accent/10 text-accent'
          }`}
        >
          {banner.text}
          <button
            onClick={() => setBanner(null)}
            className="ml-2 text-zinc-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-zinc-500">
          Nessuna canzone trovata.
        </div>
      ) : (
        <div className="space-y-2 pb-24">
          {filtered.map((s) => {
            const checked = selected.has(s.id);
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 rounded-md border p-3 transition ${
                  checked
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-panel hover:border-accent'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s.id)}
                  className="flex-shrink-0"
                  aria-label={`Seleziona ${s.title}`}
                />
                <Link
                  href={`/churches/${slug}/songs/${s.id}`}
                  className="flex-1 min-w-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.title}</div>
                    {s.artist && (
                      <div className="text-xs text-zinc-500 truncate">{s.artist}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.default_tempo && (
                      <span className="text-xs text-zinc-400 font-mono">
                        {s.default_tempo} bpm
                      </span>
                    )}
                    {s.time_signature && (
                      <span className="text-xs text-zinc-400 font-mono">
                        {s.time_signature}
                      </span>
                    )}
                    {s.original_key && (
                      <span className="text-xs text-zinc-400 px-2 py-0.5 rounded bg-bg border border-border">
                        {s.original_key}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-panel p-3 flex items-center gap-3 z-40">
          <span className="text-sm text-zinc-300">
            {selected.size} selezionat{selected.size === 1 ? 'a' : 'e'}
          </span>
          <button
            onClick={clearSelection}
            className="text-xs text-zinc-400 hover:text-white"
          >
            Deseleziona
          </button>
          <span className="flex-1" />
          <button
            onClick={onCreateSet}
            disabled={busy}
            className="px-3 py-1.5 rounded-md border border-accent text-accent hover:bg-accent/10 text-sm disabled:opacity-50"
          >
            Crea set
          </button>
          {canManage && (
            <button
              onClick={onDelete}
              disabled={busy}
              className="px-3 py-1.5 rounded-md border border-red-500/60 text-red-400 hover:bg-red-500/10 text-sm disabled:opacity-50"
            >
              Elimina
            </button>
          )}
        </div>
      )}

      {setModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => !busy && setSetModalOpen(false)}
        >
          <div
            className="bg-panel border border-border rounded-lg w-full max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Nuovo set</h2>
            <p className="text-sm text-zinc-400">
              {selected.size} canzon{selected.size === 1 ? 'e' : 'i'} nel nuovo set.
            </p>
            <input
              autoFocus
              type="text"
              placeholder="Nome del set…"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSetName.trim()) submitCreateSet();
              }}
              className="w-full px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => !busy && setSetModalOpen(false)}
                className="px-3 py-1.5 rounded-md border border-border text-sm"
              >
                Annulla
              </button>
              <button
                onClick={submitCreateSet}
                disabled={busy || !newSetName.trim()}
                className="px-3 py-1.5 rounded-md bg-accent text-black text-sm disabled:opacity-50"
              >
                {busy ? 'Creazione…' : 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
