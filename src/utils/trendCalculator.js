// Trend Calculator — computes trend direction from view history data points
// Feature: sparkline-view-trends

/**
 * Oblicza procent zmiany między pierwszym (najstarszym) a ostatnim (najnowszym) punktem.
 * Formula: ((last_viewCount - first_viewCount) / first_viewCount) * 100
 * Handles division by zero: returns 0 when first_viewCount === 0.
 *
 * @param {Array<{timestamp: number, viewCount: number}>} dataPoints - posortowane chronologicznie
 * @returns {number} procent zmiany (np. 5.2 oznacza +5.2%)
 */
export function calculatePercentChange(dataPoints) {
  if (!Array.isArray(dataPoints) || dataPoints.length < 2) {
    return 0;
  }

  const first = dataPoints[0].viewCount;
  const last = dataPoints[dataPoints.length - 1].viewCount;

  if (first === 0) {
    return 0;
  }

  return ((last - first) / first) * 100;
}

/**
 * Oblicza kierunek trendu na podstawie serii danych.
 * - percentChange >= 1 → 'up'
 * - percentChange <= -1 → 'down'
 * - -1 < percentChange < 1 → 'neutral'
 * - Less than 2 data points → 'neutral'
 *
 * @param {Array<{timestamp: number, viewCount: number}>} dataPoints - posortowane chronologicznie
 * @returns {'up' | 'down' | 'neutral'} kierunek trendu
 */
export function calculateTrend(dataPoints) {
  if (!Array.isArray(dataPoints) || dataPoints.length < 2) {
    return 'neutral';
  }

  const percentChange = calculatePercentChange(dataPoints);

  if (percentChange >= 1) {
    return 'up';
  }
  if (percentChange <= -1) {
    return 'down';
  }
  return 'neutral';
}
