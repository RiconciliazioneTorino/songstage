'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { addSongToSet, removeSetItem, reorderSetItems, updateSetItem } from '@/lib/sets/actions';

type Song = {
  id: string;
  title: string;
  artist: string | null;
  original_key: string | null;
  isCanonical?: boolean;
};
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
  isCanonical: boolean;
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
  // Drag-and-drop reorders optimistically, so the list order lives in state
  // and re-syncs whenever the server sends a fresh set.
  const [items, setItems] = useState(initialItems);
  const [reorderError, setReorderError] = useState<string | null>(null);
  useEffect(() => setItems(initialItems), [initialItems]);

  const sensors = useSensors(
    // A small distance threshold keeps taps on the per-row controls from
    // starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from === -1 || to === -1) return;

    const previous = items;
    const next = arrayMove(items, from, to);
    setItems(next);
    setReorderError(null);

    const { error } = await reorderSetItems(
      setId,
      next.map((i) => i.id)
    );
    if (error) {
      setItems(previous);
      setReorderError(error);
      return;
    }
    refresh();
  }

  const inSet = new Set(items.map((i) => i.song.id));
  const query = pickerQuery.trim().toLowerCase();
  const filtered = availableSongs
    .filter((s) => !inSet.has(s.id))
    .filter(
      (s) =>
        !query ||
        s.title.toLowerCase().includes(query) ||
        (s.artist ?? '').toLowerCase().includes(query)
    );

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      {reorderError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {reorderError}
        </div>
      )}

      <div className="rounded-md border border-border bg-panel p-2">
        {items.length === 0 ? (
          <div className="p-4 text-center text-sm text-zinc-500">Nessuna canzone ancora.</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ol className="divide-y divide-border">
                {items.map((item, idx) => (
                  <SortableRow key={item.id} item={item} index={idx} onChange={refresh} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {!pickerOpen ? (
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full px-3 py-2 rounded-full border border-dashed border-border hover:border-accent text-sm text-zinc-400 hover:text-accent"
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
              className="px-3 py-2 rounded-full border border-border text-sm"
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
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {s.isCanonical && (
                      <span
                        title="Dalla libreria canonica"
                        className="text-[10px] uppercase tracking-wide text-zinc-400 px-2 py-0.5 rounded-full bg-bg border border-border"
                      >
                        Canonica
                      </span>
                    )}
                    {s.original_key && (
                      <span className="text-xs text-zinc-400 px-2 py-0.5 rounded-full bg-bg border border-border">
                        {s.original_key}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableRow({
  item,
  index,
  onChange,
}: {
  item: Item;
  index: number;
  onChange: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`py-2 px-2 flex items-center gap-3 bg-panel ${
        isDragging ? 'relative z-10 opacity-80 shadow-lg' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        title="Trascina per riordinare"
        aria-label={`Riordina ${item.song.title}`}
        className="px-1 text-zinc-500 hover:text-accent cursor-grab active:cursor-grabbing touch-none text-sm leading-none"
      >
        ⠿
      </button>
      <span className="text-zinc-500 text-sm w-6 text-right">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.song.title}</div>
        <div className="text-xs text-zinc-500 truncate">
          {item.song.original_key ? `Orig: ${item.song.original_key}` : ''}
          {item.song.artist ? ` · ${item.song.artist}` : ''}
          {item.isCanonical ? ' · canonica' : ''}
        </div>
      </div>
      <VariationPicker
        itemId={item.id}
        current={item.variation_id}
        variations={item.availableVariations}
        onChange={onChange}
      />
      <TransposeControl itemId={item.id} value={item.transpose_semitones} onChange={onChange} />
      <button
        title="Rimuovi"
        onClick={async () => {
          await removeSetItem(item.id);
          onChange();
        }}
        className="px-2 py-1 rounded-full border border-border hover:border-red-500 text-xs"
      >
        ✕
      </button>
    </li>
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
        className="w-6 h-6 rounded-full border border-border hover:border-accent text-xs"
      >
        −
      </button>
      <span className="text-xs w-8 text-center text-zinc-300">
        {v >= 0 ? '+' : ''}
        {v}
      </span>
      <button
        onClick={() => update(v + 1)}
        className="w-6 h-6 rounded-full border border-border hover:border-accent text-xs"
      >
        +
      </button>
    </div>
  );
}
