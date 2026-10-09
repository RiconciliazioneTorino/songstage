/**
 * How a time signature maps to metronome ticks.
 *
 * `beatsPerBar` is the chart's audible pulse count: 4 for 4/4, 3 for 3/4,
 * 2 for 6/8 (the two dotted-quarter pulses), 3 for 9/8, 4 for 12/8.
 *
 * `subdivisionsPerBeat` tells the scheduler how many ticks it should play
 * between pulses. Simple meters use 1 — only the pulse clicks. Compound
 * meters use 3, so 6/8 plays as *--*-- with the subdivision audible.
 *
 * The scheduler combines these with the stored BPM: tick rate =
 * bpm × subdivisionsPerBeat, ticks per bar = beatsPerBar × subdivisionsPerBeat,
 * accent every subdivisionsPerBeat ticks.
 */
export type MetronomePattern = {
  beatsPerBar: number;
  subdivisionsPerBeat: number;
};

const DEFAULT: MetronomePattern = { beatsPerBar: 4, subdivisionsPerBeat: 1 };

export function metronomePattern(
  sig: string | null | undefined
): MetronomePattern {
  const parsed = parseSig(sig);
  if (!parsed) return DEFAULT;
  const { num, den } = parsed;
  if ((den === 8 || den === 16) && num >= 6 && num % 3 === 0) {
    return { beatsPerBar: num / 3, subdivisionsPerBeat: 3 };
  }
  return { beatsPerBar: num, subdivisionsPerBeat: 1 };
}

/** Audible pulses per bar (for the UI tempo display). */
export function parseBeatsPerBar(sig: string | null | undefined): number {
  return metronomePattern(sig).beatsPerBar;
}

function parseSig(
  sig: string | null | undefined
): { num: number; den: number } | null {
  if (!sig) return null;
  const m = sig.match(/^\s*(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  const den = parseInt(m[2], 10);
  if (!(num >= 1 && num <= 32)) return null;
  if (!(den >= 1 && den <= 32)) return null;
  return { num, den };
}
