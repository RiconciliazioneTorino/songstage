import { describe, expect, it } from 'vitest';
import { computeFitScale, FIT_MAX, FIT_MIN } from './fit';

describe('computeFitScale', () => {
  it('shrinks until the longest line fits', () => {
    // The real case: 348px of text in 343px of screen.
    expect(
      computeFitScale({ naturalWidth: 348, available: 343, currentScale: 1 })
    ).toBeCloseTo(343 / 348);
  });

  it('grows to use the full width when there is room', () => {
    expect(computeFitScale({ naturalWidth: 200, available: 400, currentScale: 1 })).toBe(2);
  });

  it('gives the same answer whatever scale it measured at', () => {
    // Measured at 2x, a line is twice as wide; the fit must not change.
    const atOne = computeFitScale({ naturalWidth: 300, available: 400, currentScale: 1 });
    const atTwo = computeFitScale({ naturalWidth: 600, available: 400, currentScale: 2 });
    expect(atTwo).toBeCloseTo(atOne);
  });

  it('converges in one step', () => {
    const first = computeFitScale({ naturalWidth: 500, available: 300, currentScale: 1 });
    // Re-measuring at the new scale must return that same scale, or the text
    // would resize on every render.
    const second = computeFitScale({
      naturalWidth: 500 * first,
      available: 300,
      currentScale: first,
    });
    expect(second).toBeCloseTo(first);
  });

  it('clamps instead of returning something unreadable', () => {
    expect(computeFitScale({ naturalWidth: 10000, available: 100, currentScale: 1 })).toBe(FIT_MIN);
    expect(computeFitScale({ naturalWidth: 10, available: 10000, currentScale: 1 })).toBe(FIT_MAX);
  });

  it('holds the current scale when there is nothing to measure', () => {
    expect(computeFitScale({ naturalWidth: 0, available: 343, currentScale: 1.3 })).toBe(1.3);
    expect(computeFitScale({ naturalWidth: 348, available: 0, currentScale: 1.3 })).toBe(1.3);
  });
});
