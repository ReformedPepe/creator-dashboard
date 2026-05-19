// TikTok API usage tracker for Creator Stats Dashboard

const STORAGE_KEY = 'creator-dashboard-tiktok-api-usage';
const DEFAULT_LIMIT = 300;

/**
 * Returns current usage data from localStorage.
 * Handles monthly reset if stored month/year differs from current.
 * Returns null if localStorage is unavailable or data is corrupted.
 * @returns {{ remaining: number, limit: number, month: number, year: number } | null}
 */
export function getUsageData() {
  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      // No data yet — initialize with defaults
      const initial = {
        remaining: DEFAULT_LIMIT,
        limit: DEFAULT_LIMIT,
        month: currentMonth,
        year: currentYear,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const data = JSON.parse(raw);

    // Monthly reset: if stored period differs from current
    if (data.month !== currentMonth || data.year !== currentYear) {
      const reset = {
        remaining: DEFAULT_LIMIT,
        limit: data.limit || DEFAULT_LIMIT,
        month: currentMonth,
        year: currentYear,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reset));
      return reset;
    }

    return data;
  } catch (e) {
    console.error('Błąd odczytu danych o zużyciu API z localStorage:', e);
    return null;
  }
}

/**
 * Decrements remaining by 1, clamped at 0.
 * Used internally when rate-limit headers are missing from the response.
 */
export function decrementUsage() {
  try {
    const data = getUsageData();
    if (!data) return;

    data.remaining = Math.max(data.remaining - 1, 0);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Błąd dekrementacji zużycia API:', e);
  }
}

/**
 * Reads rate-limit headers from an axios response and updates localStorage.
 * If headers are missing, decrements remaining by 1.
 * Dispatches 'tiktok-api-usage-updated' event after update.
 * @param {import('axios').AxiosResponse} axiosResponse
 */
export function trackApiUsage(axiosResponse) {
  try {
    const headers = axiosResponse?.headers;
    const remainingHeader = headers?.['x-ratelimit-requests-remaining'];
    const limitHeader = headers?.['x-ratelimit-requests-limit'];

    if (remainingHeader != null && limitHeader != null) {
      const remaining = parseInt(remainingHeader, 10);
      const limit = parseInt(limitHeader, 10);

      if (!isNaN(remaining) && !isNaN(limit)) {
        const now = new Date();
        const data = {
          remaining,
          limit,
          month: now.getMonth(),
          year: now.getFullYear(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        // Headers present but not valid numbers — fall back to decrement
        decrementUsage();
      }
    } else {
      // Headers missing — fall back to decrement
      decrementUsage();
    }
  } catch (e) {
    console.error('Błąd śledzenia zużycia API TikTok:', e);
  }

  // Always dispatch event so UI updates, even if localStorage failed
  try {
    window.dispatchEvent(new CustomEvent('tiktok-api-usage-updated'));
  } catch (e) {
    console.error('Błąd wysyłania zdarzenia aktualizacji zużycia API:', e);
  }
}
