/**
 * Convert a time-signature string ("4/4", "6/8", …) to the number of audible
 * pulses the metronome should click per bar.
 *
 * Simple meters (anything that isn't compound): the numerator is the pulse
 * count — 4/4 → 4, 3/4 → 3, 2/2 → 2.
 *
 * Compound meters (6/8, 9/8, 12/8 — numerator ≥ 6 and divisible by 3,
 * denominator 8 or 16): the stored BPM refers to the dotted-beat pulse, so
 * audible pulses per bar = numerator / 3. 6/8 → 2, 9/8 → 3, 12/8 → 4.
 *
 * Falls back to 4 for empty / malformed input or numerators out of range.
 */
export function parseBeatsPerBar(sig: string | null | undefined): number {
  if (!sig) return 4;
  const m = sig.match(/^\s*(\d+)\s*\/\s*(\d+)/);
  if (!m) return 4;
  const num = parseInt(m[1], 10);
  const den = parseInt(m[2], 10);
  if (!(num >= 1 && num <= 32)) return 4;
  if ((den === 8 || den === 16) && num >= 6 && num % 3 === 0) {
    return num / 3;
  }
  return num;
}
