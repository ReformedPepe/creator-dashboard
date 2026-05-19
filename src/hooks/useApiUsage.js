import { useState, useEffect, useCallback } from 'react';
import { getUsageData } from '../utils/apiTracker';

/**
 * Hook providing reactive API usage data.
 * Listens to 'tiktok-api-usage-updated' custom event for live updates.
 * @returns {{ remaining: number | null, limit: number, loading: boolean }}
 */
export function useApiUsage() {
  const [remaining, setRemaining] = useState(null);
  const [limit, setLimit] = useState(300);
  const [loading, setLoading] = useState(true);

  const readData = useCallback(() => {
    const data = getUsageData();
    if (data) {
      setRemaining(data.remaining);
      setLimit(data.limit);
    } else {
      setRemaining(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    readData();
    window.addEventListener('tiktok-api-usage-updated', readData);
    return () => window.removeEventListener('tiktok-api-usage-updated', readData);
  }, [readData]);

  return { remaining, limit, loading };
}
