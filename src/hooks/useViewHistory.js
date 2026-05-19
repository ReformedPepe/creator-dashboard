// Hook loading view history for a video and computing trend direction
// Feature: sparkline-view-trends

import { useMemo } from 'react';
import { loadHistory } from '../utils/viewHistory';
import { calculateTrend } from '../utils/trendCalculator';

const MAX_DISPLAY_POINTS = 30;

/**
 * Hook ładujący historię wyświetleń dla filmu.
 * Zwraca max 30 najnowszych punktów (do wyświetlenia) oraz trend obliczony z pełnej historii.
 *
 * @param {string} videoId
 * @returns {{ dataPoints: Array<{timestamp: number, viewCount: number}>, trend: 'up'|'down'|'neutral' }}
 */
export function useViewHistory(videoId) {
  return useMemo(() => {
    if (!videoId) {
      return { dataPoints: [], trend: 'neutral' };
    }

    const fullHistory = loadHistory(videoId);

    // Trend is calculated from the full history
    const trend = calculateTrend(fullHistory);

    // Display at most 30 most recent points (slice from end)
    const dataPoints = fullHistory.length > MAX_DISPLAY_POINTS
      ? fullHistory.slice(-MAX_DISPLAY_POINTS)
      : fullHistory;

    return { dataPoints, trend };
  }, [videoId]);
}
