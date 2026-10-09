/**
 * Convert a time signature into the three numbers the scheduler needs to
 * tick a chart at its stored BPM.
 *
 * The chart BPM is always the **quarter-note rate** — the way worship sheets
 * mean it. 6/8 at 70 BPM means ♩ = 70, which gives a 2.57-second bar with
 * eighth-note ticks at 140 and accents on each dotted-beat (`*--*--`).
 *
 * - `beatsPerBar` — pulses the listener feels per bar (4 for 4/4, 3 for 3/4,
 *   2 for 6/8, 3 for 9/8, 4 for 12/8). Kept for UI only.
 * - `subdivisionsPerBeat` — ticks per quarter-note. 1 for simple meters, 2
 *   for compound (so each quarter splits into two eighths and the dotted-
 *   beat subdivision is audible).
 * - `strongEvery` — accent spacing in ticks. Simple meters accent once per
 *   bar (`strongEvery = beatsPerBar × subdivisionsPerBeat`). Compound meters
 *   accent every dotted-beat, which is 3 eighth-ticks.
 */
export type MetronomePattern = {
  beatsPerBar: number;
  subdivisionsPerBeat: number;
  strongEvery: number;
};

const DEFAULT: MetronomePattern = {
  beatsPerBar: 4,
  subdivisionsPerBeat: 1,
  strongEvery: 4,
};

export function metronomePattern(
  sig: string | null | undefined
): MetronomePattern {
  const parsed = parseSig(sig);
  if (!parsed) return DEFAULT;
  const { num, den } = parsed;
  if ((den === 8 || den === 16) && num >= 6 && num % 3 === 0) {
    return {
      beatsPerBar: num / 3,
      subdivisionsPerBeat: 2,
      strongEvery: 3,
    };
  }
  return {
    beatsPerBar: num,
    subdivisionsPerBeat: 1,
    strongEvery: num,
  };
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
