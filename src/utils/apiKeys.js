// Key Resolution Service for Creator Stats Dashboard
// Resolves API keys with priority: localStorage > import.meta.env > ''

import axios from 'axios';

const YT_STORAGE_KEY = 'creator-dashboard-youtube-api-key';
const TT_STORAGE_KEY = 'creator-dashboard-tiktok-api-key';

/**
 * Returns the active YouTube API key.
 * Priority: localStorage > import.meta.env.VITE_YOUTUBE_API_KEY > ''
 */
export function getYouTubeApiKey() {
  try {
    const stored = localStorage.getItem(YT_STORAGE_KEY);
    if (stored) return stored;
  } catch (e) {
    console.error('Błąd odczytu klucza YouTube z localStorage:', e);
  }
  return import.meta.env.VITE_YOUTUBE_API_KEY || '';
}

/**
 * Returns the active TikTok RapidAPI key.
 * Priority: localStorage > import.meta.env.VITE_TIKTOK_RAPIDAPI_KEY > ''
 */
export function getTikTokApiKey() {
  try {
    const stored = localStorage.getItem(TT_STORAGE_KEY);
    if (stored) return stored;
  } catch (e) {
    console.error('Błąd odczytu klucza TikTok z localStorage:', e);
  }
  return import.meta.env.VITE_TIKTOK_RAPIDAPI_KEY || '';
}

/**
 * Saves YouTube API key to localStorage.
 * If key is empty/whitespace, removes the entry.
 */
export function saveYouTubeApiKey(key) {
  try {
    if (key && key.trim().length > 0) {
      localStorage.setItem(YT_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(YT_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Błąd zapisu klucza YouTube do localStorage:', e);
  }
}

/**
 * Saves TikTok API key to localStorage.
 * If key is empty/whitespace, removes the entry.
 */
export function saveTikTokApiKey(key) {
  try {
    if (key && key.trim().length > 0) {
      localStorage.setItem(TT_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(TT_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Błąd zapisu klucza TikTok do localStorage:', e);
  }
}

/**
 * Reads YouTube key from localStorage only (for pre-filling form).
 * Returns '' if not stored.
 */
export function getStoredYouTubeKey() {
  try {
    return localStorage.getItem(YT_STORAGE_KEY) || '';
  } catch (e) {
    console.error('Błąd odczytu klucza YouTube z localStorage:', e);
    return '';
  }
}

/**
 * Reads TikTok key from localStorage only (for pre-filling form).
 * Returns '' if not stored.
 */
export function getStoredTikTokKey() {
  try {
    return localStorage.getItem(TT_STORAGE_KEY) || '';
  } catch (e) {
    console.error('Błąd odczytu klucza TikTok z localStorage:', e);
    return '';
  }
}

// --- Key Validation ---

/**
 * Validates a YouTube Data API v3 key by making a lightweight request.
 * Endpoint: GET youtube/v3/videos?part=id&chart=mostPopular&maxResults=1&key=KEY
 * Timeout: 10 seconds via AbortController
 * @param {string} key — YouTube API key to validate
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
export async function validateYouTubeKey(key) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await axios.get(
      'https://www.googleapis.com/youtube/v3/videos',
      {
        params: {
          part: 'id',
          chart: 'mostPopular',
          maxResults: 1,
          key: key,
        },
        signal: controller.signal,
      }
    );

    if (response.status === 200) {
      return { valid: true };
    }

    return {
      valid: false,
      error: 'Klucz jest nieprawidłowy. Sprawdź czy skopiowałeś pełny klucz.',
    };
  } catch (e) {
    if (e.name === 'AbortError' || e.code === 'ECONNABORTED' || e.name === 'CanceledError') {
      return {
        valid: false,
        error: 'Nie udało się zweryfikować klucza — sprawdź połączenie internetowe.',
      };
    }

    if (e.response) {
      // Server responded with non-2xx status (e.g. 403, 401)
      return {
        valid: false,
        error: 'Klucz jest nieprawidłowy. Sprawdź czy skopiowałeś pełny klucz.',
      };
    }

    // Network error (no response received)
    return {
      valid: false,
      error: 'Błąd połączenia podczas walidacji klucza.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validates a TikTok RapidAPI key by making a lightweight request.
 * Endpoint: GET tiktok-scraper7.p.rapidapi.com/user/info?unique_id=tiktok
 * Headers: x-rapidapi-key, x-rapidapi-host
 * Timeout: 10 seconds via AbortController
 * @param {string} key — TikTok RapidAPI key to validate
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
export async function validateTikTokKey(key) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await axios.get(
      'https://tiktok-scraper7.p.rapidapi.com/user/info',
      {
        params: {
          unique_id: 'tiktok',
        },
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
        },
        signal: controller.signal,
      }
    );

    if (response.status === 200) {
      return { valid: true };
    }

    return {
      valid: false,
      error: 'Klucz jest nieprawidłowy. Sprawdź czy skopiowałeś pełny klucz.',
    };
  } catch (e) {
    if (e.name === 'AbortError' || e.code === 'ECONNABORTED' || e.name === 'CanceledError') {
      return {
        valid: false,
        error: 'Nie udało się zweryfikować klucza — sprawdź połączenie internetowe.',
      };
    }

    if (e.response) {
      // Server responded with non-2xx status (e.g. 403, 401)
      return {
        valid: false,
        error: 'Klucz jest nieprawidłowy. Sprawdź czy skopiowałeś pełny klucz.',
      };
    }

    // Network error (no response received)
    return {
      valid: false,
      error: 'Błąd połączenia podczas walidacji klucza.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
