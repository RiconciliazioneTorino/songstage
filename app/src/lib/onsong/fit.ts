/**
 * Picking a text size that makes the longest line fit the screen.
 *
 * Hunting for that size with +/- is a poor job for a person: the answer
 * changes with every song and every screen, and on a phone the default is
 * often just barely too big — one line overflowing by a few pixels wraps the
 * whole song and makes it unreadable.
 */

export const FIT_MIN = 0.4;
export const FIT_MAX = 3;

export function computeFitScale({
  naturalWidth,
  available,
  currentScale,
  min = FIT_MIN,
  max = FIT_MAX,
}: {
  /** Width of the longest line as laid out now, unwrapped, in pixels. */
  naturalWidth: number;
  /** Width the text has to fit into, in pixels. */
  available: number;
  /** The scale `naturalWidth` was measured at. */
  currentScale: number;
  min?: number;
  max?: number;
}): number {
  // Nothing measurable yet (not laid out, hidden, empty song): changing the
  // size on a guess would only make things jump.
  if (!(naturalWidth > 0) || !(available > 0) || !(currentScale > 0)) {
    return currentScale;
  }

  // Measuring at the current scale and dividing it out means the result does
  // not depend on where we happen to be, so it converges in one step instead
  // of creeping toward the answer over several renders.
  const widthAtScaleOne = naturalWidth / currentScale;
  return Math.min(max, Math.max(min, available / widthAtScaleOne));
}
