import { describe, it, expect } from 'vitest';
import { calculatePercentChange, calculateTrend } from './trendCalculator.js';

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

  it('returns 0 when first viewCount is 0', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 0 },
      { timestamp: 2000, viewCount: 1000 },
    ];
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

  it('returns "up" when first viewCount is 0 and there are multiple non-zero points', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 0 },
      { timestamp: 2000, viewCount: 5000 },
      { timestamp: 3000, viewCount: 5500 },
    ];
    // first=0 → percentChange=0 → neutral (seed points should be cleaned up)
    expect(calculateTrend(dataPoints)).toBe('neutral');
  });

  it('returns "neutral" when first viewCount is 0 and only one real data point', () => {
    const dataPoints = [
      { timestamp: 1000, viewCount: 0 },
      { timestamp: 2000, viewCount: 5000 },
    ];
    expect(calculateTrend(dataPoints)).toBe('neutral');
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
