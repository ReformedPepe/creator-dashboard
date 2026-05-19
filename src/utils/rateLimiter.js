// TikTok rate limiter — max one fetch per 60 minutes, persisted in localStorage

const TIKTOK_LAST_REFRESH_KEY = 'creator-dashboard-tiktok-last-refresh';
const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Returns true if 60+ minutes have passed since the last TikTok fetch,
 * or if no valid timestamp exists in localStorage.
 * Invalid/corrupted values also return true (allow fetch).
 */
export function canRefreshTikTok() {
  try {
    const raw = localStorage.getItem(TIKTOK_LAST_REFRESH_KEY);
    if (raw === null) return true;

    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp) || timestamp < 0) return true;

    const elapsed = Date.now() - timestamp;
    return elapsed >= COOLDOWN_MS;
  } catch {
    return true;
  }
}

/**
 * Saves the current time as the TikTok last refresh timestamp.
 */
export function markTikTokRefreshed() {
  try {
    localStorage.setItem(TIKTOK_LAST_REFRESH_KEY, String(Date.now()));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Returns remaining minutes until next allowed TikTok refresh.
 * Returns 0 if ready to refresh. Uses Math.ceil for remaining minutes.
 */
export function getTikTokCooldownMinutes() {
  try {
    const raw = localStorage.getItem(TIKTOK_LAST_REFRESH_KEY);
    if (raw === null) return 0;

    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp) || timestamp < 0) return 0;

    const elapsed = Date.now() - timestamp;
    if (elapsed >= COOLDOWN_MS) return 0;

    const remainingMs = COOLDOWN_MS - elapsed;
    return Math.ceil(remainingMs / (60 * 1000));
  } catch {
    return 0;
  }
}
