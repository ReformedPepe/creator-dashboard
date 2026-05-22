import { describe, it, expect } from 'vitest';
import { calculatePercentChange, calculateTrend, filterZeroSnapshots } from './trendCalculator.js';

describe('filterZeroSnapshots', () => {
  it('removes points with viewCount === 0', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 0 },
      { timestamp: 2000, viewCount: 500 },
      { timestamp: 3000, viewCount: 1000 },
    ];
    expect(filterZeroSnapshots(dataPoints)).toEqual([
      { timestamp: 2000, viewCount: 500 },
      { timestamp: 3000, viewCount: 1000 },
    ]);
  });

  it('removes points with viewCount === null', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: null },
      { timestamp: 2000, viewCount: 100 },
    ];
    expect(filterZeroSnapshots(dataPoints)).toEqual([
      { timestamp: 2000, viewCount: 100 },
    ]);
  });

  it('removes points with viewCount === undefined', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: undefined },
      { timestamp: 2000, viewCount: 200 },
    ];
    expect(filterZeroSnapshots(dataPoints)).toEqual([
      { timestamp: 2000, viewCount: 200 },
    ]);
  });

  it('keeps all points when none are zero', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 100 },
      { timestamp: 2000, viewCount: 200 },
    ];
    expect(filterZeroSnapshots(dataPoints)).toEqual(dataPoints);
  });

  it('returns empty array when all points are zero', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 0 },
      { timestamp: 2000, viewCount: 0 },
    ];
    expect(filterZeroSnapshots(dataPoints)).toEqual([]);
  });

  it('returns empty array for non-array input', () => {
    expect(filterZeroSnapshots(null)).toEqual([]);
    expect(filterZeroSnapshots(undefined)).toEqual([]);
  });

  it('removes multiple leading zeros', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 0 },
      { timestamp: 2000, viewCount: 0 },
      { timestamp: 3000, viewCount: 0 },
      { timestamp: 4000, viewCount: 500 },
      { timestamp: 5000, viewCount: 1600 },
    ];
    expect(filterZeroSnapshots(dataPoints)).toEqual([
      { timestamp: 4000, viewCount: 500 },
      { timestamp: 5000, viewCount: 1600 },
    ]);
  });
});

describe('calculatePercentChange', () => {
  it('returns positive percent change for increasing views', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 100 },
      { timestamp: 2000, viewCount: 150 },
    ];
    expect(calculatePercentChange(dataPoints)).toBe(50);
  });

  it('returns negative percent change for decreasing views', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 200 },
      { timestamp: 2000, viewCount: 100 },
    ];
    expect(calculatePercentChange(dataPoints)).toBe(-50);
  });

  it('returns 0 for identical values', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 500 },
      { timestamp: 2000, viewCount: 500 },
    ];
    expect(calculatePercentChange(dataPoints)).toBe(0);
  });

  it('returns 0 when first viewCount is 0 (expects pre-filtered data)', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 0 },
      { timestamp: 2000, viewCount: 1000 },
    ];
    // Function expects filtered data; if zeros slip through, returns 0 safely
    expect(calculatePercentChange(dataPoints)).toBe(0);
  });

  it('returns 0 when both first and last viewCount are 0', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 0 },
      { timestamp: 2000, viewCount: 0 },
    ];
    expect(calculatePercentChange(dataPoints)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(calculatePercentChange([])).toBe(0);
  });

  it('returns 0 for single data point', () => {
    const dataPoints = [{ timestamp: 1000, viewCount: 100 }];
    expect(calculatePercentChange(dataPoints)).toBe(0);
  });

  it('uses first and last elements of the array', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 100 },
      { timestamp: 2000, viewCount: 9999 },
      { timestamp: 3000, viewCount: 200 },
    ];
    // Formula: ((200 - 100) / 100) * 100 = 100
    expect(calculatePercentChange(dataPoints)).toBe(100);
  });

  it('handles exactly 1% increase', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 100 },
      { timestamp: 2000, viewCount: 101 },
    ];
    expect(calculatePercentChange(dataPoints)).toBe(1);
  });

  it('handles exactly -1% decrease', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 100 },
      { timestamp: 2000, viewCount: 99 },
    ];
    expect(calculatePercentChange(dataPoints)).toBe(-1);
  });

  it('works correctly with pre-filtered data (0→500→1600 becomes 500→1600)', () => {
    // Simulates the real flow: filterZeroSnapshots removes the 0, then calculatePercentChange runs
    const raw = [
      { timestamp: 1000, viewCount: 0 },
      { timestamp: 2000, viewCount: 500 },
      { timestamp: 3000, viewCount: 1600 },
    ];
    const filtered = filterZeroSnapshots(raw);
    // (1600 - 500) / 500 * 100 = 220%
    expect(calculatePercentChange(filtered)).toBeCloseTo(220);
  });
});

describe('calculateTrend', () => {
  it('returns "up" for percent change >= 1%', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 100 },
      { timestamp: 2000, viewCount: 110 },
    ];
    expect(calculateTrend(dataPoints)).toBe('up');
  });

  it('returns "down" for percent change <= -1%', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 100 },
      { timestamp: 2000, viewCount: 90 },
    ];
    expect(calculateTrend(dataPoints)).toBe('down');
  });

  it('returns "neutral" for percent change between -1% and 1%', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 1000 },
      { timestamp: 2000, viewCount: 1005 },
    ];
    // 0.5% change → neutral
    expect(calculateTrend(dataPoints)).toBe('neutral');
  });

  it('returns "neutral" for empty array', () => {
    expect(calculateTrend([])).toBe('neutral');
  });

  it('returns "neutral" for single data point', () => {
    const dataPoints = [{ timestamp: 1000, viewCount: 100 }];
    expect(calculateTrend(dataPoints)).toBe('neutral');
  });

  it('returns "neutral" when first viewCount is 0 (unfiltered edge case)', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 0 },
      { timestamp: 2000, viewCount: 5000 },
      { timestamp: 3000, viewCount: 5500 },
    ];
    // first=0 → percentChange=0 → neutral (data should be pre-filtered in practice)
    expect(calculateTrend(dataPoints)).toBe('neutral');
  });

  it('returns "up" when filtered data shows growth', () => {
    const raw = [
      { timestamp: 1000, viewCount: 0 },
      { timestamp: 2000, viewCount: 500 },
      { timestamp: 3000, viewCount: 1600 },
    ];
    const filtered = filterZeroSnapshots(raw);
    // (1600 - 500) / 500 * 100 = 220% → up
    expect(calculateTrend(filtered)).toBe('up');
  });

  it('returns "up" at exactly 1% boundary', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 100 },
      { timestamp: 2000, viewCount: 101 },
    ];
    expect(calculateTrend(dataPoints)).toBe('up');
  });

  it('returns "down" at exactly -1% boundary', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 100 },
      { timestamp: 2000, viewCount: 99 },
    ];
    expect(calculateTrend(dataPoints)).toBe('down');
  });

  it('returns "neutral" for identical values', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 500 },
      { timestamp: 2000, viewCount: 500 },
    ];
    expect(calculateTrend(dataPoints)).toBe('neutral');
  });

  it('returns "neutral" for just under 1% increase', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 10000 },
      { timestamp: 2000, viewCount: 10099 },
    ];
    // 0.99% → neutral
    expect(calculateTrend(dataPoints)).toBe('neutral');
  });

  it('returns "neutral" for just above -1% decrease', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 10000 },
      { timestamp: 2000, viewCount: 9901 },
    ];
    // -0.99% → neutral
    expect(calculateTrend(dataPoints)).toBe('neutral');
  });
});
