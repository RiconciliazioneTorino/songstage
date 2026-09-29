'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseOnSong, SongView } from '@/lib/onsong';
import { createClient } from '@/lib/supabase/client';
import { saveSlideEdit } from '@/lib/songs/actions';
import { addSongToSet, updateSetItem } from '@/lib/sets/actions';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type Slide = {
  itemId: string;
  songId: string;
  variationId: string | null;
  title: string;
  artist: string | null;
  originalKey: string | null;
  transpose: number;
  body: string;
};

export type ProjectionState = {
  index: number;
  transposeOverride: number;
  fontScale: number;
  showChords: boolean;
  scrollFraction: number;
};

export type AvailableSong = {
  id: string;
  title: string;
  artist: string | null;
  original_key: string | null;
};

export function Master({
  setId,
  setName,
  slug,
  slides,
  availableSongs,
}: {
  setId: string;
  setName: string;
  slug: string;
  slides: Slide[];
  availableSongs: AvailableSong[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [slidesLocal, setSlidesLocal] = useState(slides);
  const [fontScale, setFontScale] = useState(1);
  const [showChords, setShowChords] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [addingSongId, setAddingSongId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollFractionRef = useRef(0);
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const initialTransposeRef = useRef<Record<string, number>>(
    Object.fromEntries(slides.map((s) => [s.itemId, s.transpose]))
  );

  useEffect(() => setSlidesLocal(slides), [slides]);

  const currentSlide = slidesLocal[index];
  const transposeOverride = currentSlide
    ? currentSlide.transpose - (initialTransposeRef.current[currentSlide.itemId] ?? 0)
    : 0;

  function persistTranspose(itemId: string, value: number) {
    if (saveTimers.current[itemId]) clearTimeout(saveTimers.current[itemId]);
    saveTimers.current[itemId] = setTimeout(() => {
      updateSetItem(itemId, { transpose_semitones: value });
    }, 400);
  }

  function bumpTranspose(delta: number) {
    setSlidesLocal((prev) => {
      const s = prev[index];
      if (!s) return prev;
      const value = s.transpose + delta;
      persistTranspose(s.itemId, value);
      const next = prev.slice();
      next[index] = { ...s, transpose: value };
      return next;
    });
  }

  function resetTranspose() {
    setSlidesLocal((prev) => {
      const s = prev[index];
      if (!s) return prev;
      if (s.transpose === 0) return prev;
      persistTranspose(s.itemId, 0);
      const next = prev.slice();
      next[index] = { ...s, transpose: 0 };
      return next;
    });
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`set:${setId}:projection`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channel.on('broadcast', { event: 'request_state' }, () => {
      channel.send({
        type: 'broadcast',
        event: 'state',
        payload: {
          index,
          transposeOverride,
          fontScale,
          showChords,
          scrollFraction: scrollFractionRef.current,
        },
      });
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    scrollFractionRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    ch.send({
      type: 'broadcast',
      event: 'state',
      payload: { index, transposeOverride, fontScale, showChords, scrollFraction: 0 },
    });
  }, [index, transposeOverride, fontScale, showChords]);

  function onContentScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const frac = max > 0 ? el.scrollTop / max : 0;
    scrollFractionRef.current = frac;
    if (scrollThrottleRef.current) return;
    scrollThrottleRef.current = setTimeout(() => {
      scrollThrottleRef.current = null;
      const ch = channelRef.current;
      if (!ch) return;
      ch.send({
        type: 'broadcast',
        event: 'state',
        payload: {
          index,
          transposeOverride,
          fontScale,
          showChords,
          scrollFraction: scrollFractionRef.current,
        },
      });
    }, 60);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      const nav = ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', '+', '=', '-', '_', '0'];
      if (!nav.includes(e.key)) return;
      e.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body) active.blur();
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setIndex((i) => Math.min(slidesLocal.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === '+' || e.key === '=') {
        bumpTranspose(1);
      } else if (e.key === '-' || e.key === '_') {
        bumpTranspose(-1);
      } else if (e.key === '0') {
        resetTranspose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slidesLocal.length, index, editing]);

  const canPrev = index > 0;
  const canNext = index < slidesLocal.length - 1;
  const goPrev = () => canPrev && setIndex((i) => Math.max(0, i - 1));
  const goNext = () => canNext && setIndex((i) => Math.min(slidesLocal.length - 1, i + 1));

  const filteredSongs = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return availableSongs;
    return availableSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.artist ?? '').toLowerCase().includes(q)
    );
  }, [availableSongs, pickerQuery]);

  const slide = currentSlide;
  const song = useMemo(() => (slide ? parseOnSong(slide.body) : null), [slide]);
  const totalSemitones = slide?.transpose ?? 0;

  const projectorUrl = `/churches/${slug}/sets/${setId}/projector`;

  if (!slide) {
    return (
      <main className="min-h-screen p-8 max-w-2xl mx-auto">
        <p className="text-zinc-400">Questo set non ha canzoni.</p>
        <Link href={`/churches/${slug}/sets/${setId}`} className="text-accent">
          ← Torna al set
        </Link>
      </main>
    );
  }

  return (
    <main className="h-dvh flex flex-col">
      <div className="border-b border-border bg-panel p-3 flex flex-wrap gap-3 items-center">
        <Link
          href={`/churches/${slug}/sets/${setId}`}
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← {setName}
        </Link>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="px-2 py-1 rounded border border-border hover:border-accent text-sm"
          aria-label={sidebarOpen ? 'Nascondi scaletta' : 'Mostra scaletta'}
          title={sidebarOpen ? 'Nascondi scaletta' : 'Mostra scaletta'}
        >
          ☰
        </button>

        <div className="flex items-center gap-1">
          <button
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="px-3 py-1 rounded border border-border hover:border-accent disabled:opacity-30 text-sm"
          >
            ◀
          </button>
          <span className="text-xs text-zinc-400 px-2 min-w-[3.5rem] text-center">
            {index + 1} / {slidesLocal.length}
          </span>
          <button
            disabled={index === slidesLocal.length - 1}
            onClick={() => setIndex((i) => Math.min(slidesLocal.length - 1, i + 1))}
            className="px-3 py-1 rounded border border-border hover:border-accent disabled:opacity-30 text-sm"
          >
            ▶
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-400 px-1">Trasposizione</span>
          <button
            onClick={() => bumpTranspose(-1)}
            className="px-2 py-1 rounded border border-border hover:border-accent text-sm"
          >
            −
          </button>
          <span className="text-xs px-2 py-1 rounded bg-bg border border-border min-w-[3rem] text-center">
            {totalSemitones >= 0 ? '+' : ''}
            {totalSemitones}
          </span>
          <button
            onClick={() => bumpTranspose(1)}
            className="px-2 py-1 rounded border border-border hover:border-accent text-sm"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setFontScale((f) => Math.max(0.6, f - 0.1))}
            className="px-2 py-1 rounded border border-border hover:border-accent text-sm"
          >
            A−
          </button>
          <button
            onClick={() => setFontScale((f) => Math.min(3, f + 0.1))}
            className="px-2 py-1 rounded border border-border hover:border-accent text-sm"
          >
            A+
          </button>
        </div>

        <label className="flex items-center gap-1 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={showChords}
            onChange={(e) => setShowChords(e.target.checked)}
          />
          accordi
        </label>

        <span className="flex-1" />

        <button
          onClick={() => {
            setPickerQuery('');
            setPickerOpen(true);
          }}
          className="px-3 py-1 rounded border border-border hover:border-accent text-sm"
        >
          + Aggiungi
        </button>

        <button
          onClick={() => {
            setEditBody(slide.body);
            setEditError(null);
            setEditing(true);
          }}
          className="px-3 py-1 rounded border border-border hover:border-accent text-sm"
        >
          Modifica testo
        </button>

        <a
          href={projectorUrl}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1 rounded border border-accent text-accent hover:bg-accent/10 text-sm"
        >
          Apri proiettore ↗
        </a>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <aside className="w-56 border-r border-border bg-panel/50 overflow-auto flex-shrink-0">
            <ol className="p-2 text-sm">
              {slidesLocal.map((s, i) => (
                <li key={s.itemId}>
                  <button
                    onClick={() => setIndex(i)}
                    className={`w-full text-left px-2 py-2 rounded flex items-baseline gap-2 hover:bg-bg ${
                      i === index ? 'bg-bg border-l-2 border-accent' : ''
                    }`}
                  >
                    <span className="text-xs text-zinc-500 min-w-[1.5rem]">
                      {i + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`truncate ${
                          i === index ? 'text-white' : 'text-zinc-300'
                        }`}
                      >
                        {s.title}
                      </div>
                      {s.artist && (
                        <div className="text-xs text-zinc-500 truncate">
                          {s.artist}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        )}

        <div className="flex-1 relative group">
          <div
            ref={scrollRef}
            onScroll={onContentScroll}
            className="absolute inset-0 overflow-auto"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('a, button, input, select, textarea')) return;
              const sel = window.getSelection();
              if (sel && sel.toString().length > 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const zone = Math.min(rect.width * 0.22, 160);
              if (x < zone) goPrev();
              else if (x > rect.width - zone) goNext();
            }}
          >
            <div className="max-w-3xl mx-auto w-full p-8 px-16 md:px-20">
              {song && (
                <SongView
                  song={song}
                  semitones={totalSemitones}
                  fontScale={fontScale}
                  showChords={showChords}
                />
              )}
            </div>
          </div>

          <div
            aria-hidden
            className={`pointer-events-none absolute left-0 top-0 bottom-0 flex items-center justify-start pl-3 md:pl-6 text-4xl md:text-5xl text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity ${canPrev ? '' : 'invisible'}`}
            style={{ width: 'min(22%, 160px)' }}
          >
            ‹
          </div>
          <div
            aria-hidden
            className={`pointer-events-none absolute right-0 top-0 bottom-0 flex items-center justify-end pr-3 md:pr-6 text-4xl md:text-5xl text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity ${canNext ? '' : 'invisible'}`}
            style={{ width: 'min(22%, 160px)' }}
          >
            ›
          </div>
        </div>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => !saving && setEditing(false)}
        >
          <div
            className="bg-panel border border-border rounded-lg w-full max-w-4xl h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-border flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{slide.title}</div>
                <div className="text-xs text-zinc-500">
                  {slide.variationId ? 'Modifica variante' : 'Nuova versione della canzone'}
                </div>
              </div>
              <button
                onClick={() => !saving && setEditing(false)}
                className="text-zinc-400 hover:text-white text-xl leading-none px-2"
                aria-label="Chiudi"
              >
                ×
              </button>
            </div>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="flex-1 w-full p-4 bg-bg text-sm font-mono resize-none focus:outline-none"
              spellCheck={false}
            />
            {editError && (
              <div className="px-4 py-2 text-sm text-red-400 border-t border-border">
                {editError}
              </div>
            )}
            <div className="p-3 border-t border-border flex items-center gap-2 justify-end">
              <button
                onClick={() => !saving && setEditing(false)}
                disabled={saving}
                className="px-3 py-1.5 rounded border border-border hover:border-accent text-sm disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  setEditError(null);
                  startSave(async () => {
                    const res = await saveSlideEdit(
                      slug,
                      slide.songId,
                      slide.variationId,
                      editBody
                    );
                    if (res.error) {
                      setEditError(res.error);
                      return;
                    }
                    setSlidesLocal((prev) => {
                      const next = prev.slice();
                      next[index] = { ...next[index], body: editBody };
                      return next;
                    });
                    setEditing(false);
                    router.refresh();
                  });
                }}
                disabled={saving || !editBody.trim()}
                className="px-3 py-1.5 rounded bg-accent text-black text-sm disabled:opacity-50"
              >
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => !addingSongId && setPickerOpen(false)}
        >
          <div
            className="bg-panel border border-border rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-border flex items-center gap-2">
              <input
                autoFocus
                placeholder="Cerca canzone…"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md bg-bg border border-border focus:border-accent outline-none text-sm"
              />
              <button
                onClick={() => !addingSongId && setPickerOpen(false)}
                className="text-zinc-400 hover:text-white text-xl leading-none px-2"
                aria-label="Chiudi"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-border">
              {filteredSongs.length === 0 ? (
                <div className="p-6 text-center text-sm text-zinc-500">
                  Nessun risultato.
                </div>
              ) : (
                filteredSongs.map((s) => (
                  <button
                    key={s.id}
                    disabled={!!addingSongId}
                    onClick={async () => {
                      setAddingSongId(s.id);
                      const res = await addSongToSet(setId, s.id);
                      setAddingSongId(null);
                      if (res?.error) {
                        alert(res.error);
                        return;
                      }
                      setPickerOpen(false);
                      setPickerQuery('');
                      router.refresh();
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-bg flex items-center justify-between disabled:opacity-50"
                  >
                    <div>
                      <div className="text-sm">{s.title}</div>
                      {s.artist && (
                        <div className="text-xs text-zinc-500">{s.artist}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.original_key && (
                        <span className="text-xs text-zinc-400 px-2 py-0.5 rounded bg-bg border border-border">
                          {s.original_key}
                        </span>
                      )}
                      {addingSongId === s.id && (
                        <span className="text-xs text-accent">…</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
