'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addSongToSet, moveSetItem, removeSetItem, updateSetItem } from '@/lib/sets/actions';

type Song = { id: string; title: string; artist: string | null; original_key: string | null };
type Variation = {
  id: string;
  name: string;
  scope: 'church' | 'band' | 'user';
  band?: { name: string } | null;
};
type Item = {
  id: string;
  position: number;
  transpose_semitones: number;
  capo: number;
  variation_id: string | null;
  performance_notes: string | null;
  song: Song;
  availableVariations: Variation[];
};

export function SetEditor({
  setId,
  items: initialItems,
  availableSongs,
}: {
  setId: string;
  items: Item[];
  availableSongs: Song[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  const inSet = new Set(initialItems.map((i) => i.song.id));
  const filtered = availableSongs
    .filter((s) => !inSet.has(s.id))
    .filter((s) => s.title.toLowerCase().includes(pickerQuery.toLowerCase()));

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-panel p-2">
        {initialItems.length === 0 ? (
          <div className="p-4 text-center text-sm text-zinc-500">Nessuna canzone ancora.</div>
        ) : (
          <ol className="divide-y divide-border">
            {initialItems.map((item, idx) => (
              <li key={item.id} className="py-2 px-2 flex items-center gap-3">
                <span className="text-zinc-500 text-sm w-6 text-right">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.song.title}</div>
                  <div className="text-xs text-zinc-500 truncate">
                    {item.song.original_key ? `Orig: ${item.song.original_key}` : ''}
                    {item.song.artist ? ` · ${item.song.artist}` : ''}
                  </div>
                </div>
                <VariationPicker
                  itemId={item.id}
                  current={item.variation_id}
                  variations={item.availableVariations}
                  onChange={refresh}
                />
                <TransposeControl
                  itemId={item.id}
                  value={item.transpose_semitones}
                  onChange={refresh}
                />
                <div className="flex gap-1">
                  <button
                    title="Su"
                    disabled={idx === 0}
                    onClick={async () => {
                      await moveSetItem(item.id, 'up');
                      refresh();
                    }}
                    className="px-2 py-1 rounded border border-border hover:border-accent text-xs disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    title="Giù"
                    disabled={idx === initialItems.length - 1}
                    onClick={async () => {
                      await moveSetItem(item.id, 'down');
                      refresh();
                    }}
                    className="px-2 py-1 rounded border border-border hover:border-accent text-xs disabled:opacity-30"
                  >
                    ▼
                  </button>
                  <button
                    title="Rimuovi"
                    onClick={async () => {
                      await removeSetItem(item.id);
                      refresh();
                    }}
                    className="px-2 py-1 rounded border border-border hover:border-red-500 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {!pickerOpen ? (
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full px-3 py-2 rounded-md border border-dashed border-border hover:border-accent text-sm text-zinc-400 hover:text-accent"
        >
          + Aggiungi canzone
        </button>
      ) : (
        <div className="rounded-md border border-border bg-panel p-3 space-y-2">
          <div className="flex gap-2">
            <input
              autoFocus
              placeholder="Cerca canzone…"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
            />
            <button
              onClick={() => setPickerOpen(false)}
              className="px-3 py-2 rounded-md border border-border text-sm"
            >
              Chiudi
            </button>
          </div>
          <div className="max-h-64 overflow-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-sm text-zinc-500">Nessun risultato.</div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={async () => {
                    await addSongToSet(setId, s.id);
                    setPickerQuery('');
                    refresh();
                  }}
                  className="w-full text-left px-2 py-2 hover:bg-bg flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm">{s.title}</div>
                    {s.artist && <div className="text-xs text-zinc-500">{s.artist}</div>}
                  </div>
                  {s.original_key && (
                    <span className="text-xs text-zinc-400 px-2 py-0.5 rounded bg-bg border border-border">
                      {s.original_key}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VariationPicker({
  itemId,
  current,
  variations,
  onChange,
}: {
  itemId: string;
  current: string | null;
  variations: Variation[];
  onChange: () => void;
}) {
  const [local, setLocal] = useState<string>(current ?? '');
  useEffect(() => setLocal(current ?? ''), [current]);
  if (variations.length === 0) return null;

  return (
    <select
      value={local}
      onChange={async (e) => {
        const val = e.target.value;
        setLocal(val);
        await updateSetItem(itemId, { variation_id: val || null });
        onChange();
      }}
      className="text-xs px-1 py-0.5 rounded bg-bg border border-border max-w-[8rem]"
      title="Versione usata nel set"
    >
      <option value="">Base</option>
      {variations.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
          {v.scope === 'band' && v.band ? ` (${v.band.name})` : ''}
          {v.scope === 'user' ? ' (personale)' : ''}
        </option>
      ))}
    </select>
  );
}

function TransposeControl({
  itemId,
  value,
  onChange,
}: {
  itemId: string;
  value: number;
  onChange: () => void;
}) {
  const [v, setV] = useState(value);

  async function update(next: number) {
    setV(next);
    await updateSetItem(itemId, { transpose_semitones: next });
    onChange();
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => update(v - 1)}
        className="w-6 h-6 rounded border border-border hover:border-accent text-xs"
      >
        −
      </button>
      <span className="text-xs w-8 text-center text-zinc-300">
        {v >= 0 ? '+' : ''}
        {v}
      </span>
      <button
        onClick={() => update(v + 1)}
        className="w-6 h-6 rounded border border-border hover:border-accent text-xs"
      >
        +
      </button>
    </div>
  );
}
