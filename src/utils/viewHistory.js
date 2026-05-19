// History Store — persists view count snapshots in localStorage
// Feature: sparkline-view-trends

const HISTORY_PREFIX = 'creator-dashboard-view-history-';
const MAX_POINTS = 50;

/**
 * Zapisuje snapshot viewCount dla jednego filmu.
 * Pomija duplikaty (identyczny viewCount jak ostatni punkt).
 * Wymusza limit 50 punktów (najstarsze usuwane).
 * @param {string} videoId - ID filmu (YouTube videoId lub TikTok id)
 * @param {number} viewCount - aktualna liczba wyświetleń
 * @returns {boolean} true jeśli zapis się powiódł
 */
export function saveSnapshot(videoId, viewCount) {
  const history = loadHistory(videoId);

  // Skip duplicate — same viewCount as last recorded point
  if (history.length > 0 && history[history.length - 1].viewCount === viewCount) {
    return true;
  }

  const dataPoint = {
    timestamp: Date.now(),
    viewCount,
  };

  history.push(dataPoint);

  // Enforce 50-point cap — remove oldest entries
  while (history.length > MAX_POINTS) {
    history.shift();
  }

  return trySave(videoId, history, 0);
}

/**
 * Zapisuje snapshoty dla tablicy filmów (batch).
 * Zapisuje tylko prawdziwe odczyty z API (viewCount + Date.now()).
 * @param {Array<{id: string, viewCount: number}>} videos
 */
export function saveSnapshots(videos) {
  if (!Array.isArray(videos)) return;
  for (const video of videos) {
    if (video && video.id != null && video.viewCount != null) {
      saveSnapshot(String(video.id), video.viewCount);
    }
  }
}

/**
 * Usuwa seed pointy (viewCount === 0) ze wszystkich historii w localStorage.
 * Wywoływane raz przy starcie aplikacji.
 */
export function cleanupSeedPoints() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(HISTORY_PREFIX)) continue;
      
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const history = JSON.parse(raw);
        if (!Array.isArray(history)) continue;
        
        const cleaned = history.filter(dp => dp.viewCount > 0);
        if (cleaned.length !== history.length) {
          if (cleaned.length === 0) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, JSON.stringify(cleaned));
          }
        }
      } catch (e) {
        // Skip corrupted entries
      }
    }
  } catch (e) {
    console.warn('[viewHistory] Failed to cleanup seed points:', e);
  }
}

/**
 * Ładuje historię wyświetleń dla filmu.
 * @param {string} videoId
 * @returns {Array<{timestamp: number, viewCount: number}>} posortowane chronologicznie
 */
export function loadHistory(videoId) {
  try {
    const raw = localStorage.getItem(HISTORY_PREFIX + videoId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Sort chronologically (oldest first)
    return parsed.sort((a, b) => a.timestamp - b.timestamp);
  } catch (e) {
    console.warn(`[viewHistory] Failed to parse history for ${videoId}:`, e);
    return [];
  }
}

/**
 * Usuwa historię dla listy filmów (przy usuwaniu kanału).
 * @param {string[]} videoIds
 */
export function removeHistories(videoIds) {
  if (!Array.isArray(videoIds)) return;
  for (const videoId of videoIds) {
    try {
      localStorage.removeItem(HISTORY_PREFIX + videoId);
    } catch (e) {
      console.warn(`[viewHistory] Failed to remove history for ${videoId}:`, e);
    }
  }
}

/**
 * Obsługa QuotaExceededError — usuwa 25% najstarszych punktów ze wszystkich historii.
 * @returns {boolean} true jeśli udało się zwolnić miejsce
 */
export function pruneOldestEntries() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(HISTORY_PREFIX)) {
        keys.push(key);
      }
    }

    if (keys.length === 0) return false;

    let prunedAny = false;

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const history = JSON.parse(raw);
        if (!Array.isArray(history) || history.length === 0) continue;

        const removeCount = Math.floor(history.length * 0.25);
        if (removeCount === 0) continue;

        // Sort chronologically and remove oldest entries
        history.sort((a, b) => a.timestamp - b.timestamp);
        const pruned = history.slice(removeCount);
        localStorage.setItem(key, JSON.stringify(pruned));
        prunedAny = true;
      } catch (e) {
        console.warn(`[viewHistory] Failed to prune ${key}:`, e);
      }
    }

    return prunedAny;
  } catch (e) {
    console.warn('[viewHistory] Failed to prune oldest entries:', e);
    return false;
  }
}

/**
 * Próbuje zapisać historię do localStorage z obsługą QuotaExceededError.
 * Retry max 3 razy z pruningiem.
 * @param {string} videoId
 * @param {Array} history
 * @param {number} attempt - numer próby (0-based)
 * @returns {boolean} true jeśli zapis się powiódł
 */
function trySave(videoId, history, attempt) {
  const MAX_RETRIES = 3;
  try {
    localStorage.setItem(HISTORY_PREFIX + videoId, JSON.stringify(history));
    return true;
  } catch (e) {
    if (e && e.name === 'QuotaExceededError' && attempt < MAX_RETRIES) {
      const freed = pruneOldestEntries();
      if (freed) {
        return trySave(videoId, history, attempt + 1);
      }
    }
    console.warn(`[viewHistory] Failed to save history for ${videoId}:`, e);
    return false;
  }
}

// Exported for testing
export { HISTORY_PREFIX, MAX_POINTS };
