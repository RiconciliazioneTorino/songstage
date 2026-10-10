'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Per-device volume popover for the live set views. Takes current values
 * (0..100) and reports changes via callbacks. Persistence lives in the parent
 * so master and viewer can share the same localStorage keys.
 *
 * Opens inline next to the trigger button. Clicking outside closes.
 */
export function MixerButton({
  metronomeVolume,
  onMetronomeVolumeChange,
  ytVolume,
  onYtVolumeChange,
  metronomeAvailable,
  ytAvailable,
  showMetronome = true,
  showYoutube = true,
}: {
  metronomeVolume: number;
  onMetronomeVolumeChange: (v: number) => void;
  ytVolume: number;
  onYtVolumeChange: (v: number) => void;
  metronomeAvailable: boolean;
  ytAvailable: boolean;
  showMetronome?: boolean;
  showYoutube?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (e.target instanceof Node && wrapRef.current.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`h-9 px-2 rounded-full border text-lg leading-none flex items-center justify-center ${
          open
            ? 'border-accent text-accent'
            : 'border-border text-zinc-500 hover:border-accent'
        }`}
        title="Volume"
        aria-expanded={open}
        aria-label="Volume"
      >
        🎛
      </button>
      {open && (
        <div
          className="absolute right-0 bottom-full mb-2 w-60 rounded-md border border-border bg-panel shadow-2xl p-3 space-y-3 z-30"
          role="dialog"
          aria-label="Volume"
        >
          {showMetronome && (
            <VolumeRow
              label="Metronomo"
              value={metronomeVolume}
              onChange={onMetronomeVolumeChange}
              dim={!metronomeAvailable}
            />
          )}
          {showYoutube && (
            <VolumeRow
              label="YouTube"
              value={ytVolume}
              onChange={onYtVolumeChange}
              dim={!ytAvailable}
            />
          )}
        </div>
      )}
    </div>
  );
}

function VolumeRow({
  label,
  value,
  onChange,
  dim,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  dim: boolean;
}) {
  return (
    <div className={dim ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between text-xs text-zinc-300 mb-1">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-zinc-500">
          {Math.round(value)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-accent"
        aria-label={`Volume ${label}`}
      />
    </div>
  );
}
