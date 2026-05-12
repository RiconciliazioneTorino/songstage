'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseOnSong, SongView } from '@/lib/onsong';
import { createClient } from '@/lib/supabase/client';
import type { Slide, ProjectionState } from '../master/master';

export function Projector({ setId, slides }: { setId: string; slides: Slide[] }) {
  const [state, setState] = useState<ProjectionState>({
    index: 0,
    transposeOverride: 0,
    fontScale: 1.4,
    showChords: true,
  });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`set:${setId}:projection`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      setState(payload as ProjectionState);
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        channel.send({ type: 'broadcast', event: 'request_state', payload: {} });
      } else {
        setConnected(false);
      }
    });
    return () => {
      channel.unsubscribe();
    };
  }, [setId]);

  const slide = slides[state.index];
  const song = useMemo(() => (slide ? parseOnSong(slide.body) : null), [slide]);
  const totalSemitones = (slide?.transpose ?? 0) + state.transposeOverride;

  if (!slide) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-400">Nessuna canzone nel set.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-12">
      {!connected && (
        <div className="fixed top-2 right-2 text-xs text-zinc-500 px-2 py-1 rounded bg-panel border border-border">
          Connessione…
        </div>
      )}
      {song && (
        <SongView
          song={song}
          semitones={totalSemitones}
          fontScale={state.fontScale * 1.4}
          showChords={state.showChords}
        />
      )}
    </main>
  );
}
