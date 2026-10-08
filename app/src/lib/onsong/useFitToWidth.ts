'use client';

import { useCallback, useEffect, useRef } from 'react';
import { computeFitScale } from './fit';

/**
 * Measures the longest line and reports the scale that makes it fit.
 *
 * Re-measures when the song changes, when the container resizes (rotation,
 * a sidebar opening, the window) and when fitting is switched on.
 */
export function useFitToWidth({
  enabled,
  currentScale,
  onFit,
  deps,
}: {
  enabled: boolean;
  currentScale: number;
  onFit: (scale: number) => void;
  /** Changing this re-measures — pass whatever identifies the current song. */
  deps: unknown;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Read through refs so measuring never needs to re-register the observer.
  const scaleRef = useRef(currentScale);
  const onFitRef = useRef(onFit);
  useEffect(() => {
    scaleRef.current = currentScale;
    onFitRef.current = onFit;
  }, [currentScale, onFit]);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // A line is a wrapping flexbox, so its own width is the container's, not
    // the width the text would take unwrapped. Summing the words gives that.
    let widest = 0;
    for (const line of el.querySelectorAll('.song-line')) {
      let width = 0;
      for (const word of line.querySelectorAll(':scope > .word')) {
        width += word.getBoundingClientRect().width;
      }
      widest = Math.max(widest, width);
    }

    const style = getComputedStyle(el);
    const available =
      el.clientWidth -
      Number.parseFloat(style.paddingLeft) -
      Number.parseFloat(style.paddingRight);

    const next = computeFitScale({
      naturalWidth: widest,
      available,
      currentScale: scaleRef.current,
    });
    // Ignore sub-pixel churn, which would otherwise loop against the observer.
    if (Math.abs(next - scaleRef.current) > 0.005) onFitRef.current(next);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, measure, deps]);

  return containerRef;
}
