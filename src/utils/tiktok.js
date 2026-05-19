import axios from 'axios';
import { trackApiUsage } from './apiTracker';
import { getTikTokApiKey } from './apiKeys';

// Environment
const RAPIDAPI_HOST = 'tiktok-scraper7.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

/**
 * Normalizes any TikTok identifier input to a clean username (no @).
 * Handles: "username", "@username", "https://www.tiktok.com/@username",
 *          "https://www.tiktok.com/@username/video/123"
 * @param {string} input
 * @returns {string} clean username without @
 */
function cleanUsername(input) {
  let cleaned = input.trim();

  // Handle profile URLs: extract username from tiktok.com/@username...
  try {
    if (cleaned.includes('tiktok.com')) {
      const url = new URL(cleaned);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0 && pathParts[0].startsWith('@')) {
        cleaned = pathParts[0];
      }
    }
  } catch {
    // Not a valid URL, continue with string processing
  }

  // Remove @ prefix
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Validates a TikTok video URL and extracts the video ID.
 * Valid patterns: https://www.tiktok.com/@user/video/1234567890
 *                https://vm.tiktok.com/XXXXXXXXX/
 * @param {string} url
 * @returns {string|null} video ID or null if invalid
 */
function extractVideoId(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Full URL pattern: https://www.tiktok.com/@user/video/1234567890
  const fullPattern = /tiktok\.com\/@[\w.]+\/video\/(\d+)/;
  const fullMatch = trimmed.match(fullPattern);
  if (fullMatch) {
    return fullMatch[1];
  }

  // Short link pattern: https://vm.tiktok.com/XXXXXXXXX/
  const shortPattern = /vm\.tiktok\.com\/([\w]+)/;
  const shortMatch = trimmed.match(shortPattern);
  if (shortMatch) {
    return shortMatch[1];
  }

  return null;
}

/**
 * Validates whether a string is a valid TikTok video URL.
 * @param {string} url
 * @returns {boolean}
 */
export function isValidTikTokUrl(url) {
  return extractVideoId(url) !== null;
}

/**
 * Maps API response item to Unified_Video_Format.
 * @param {object} item — raw API response item
 * @param {string} username — fallback for title
 * @returns {{ id: string, title: string, thumbnail: string, viewCount: number, likeCount: number, commentCount: number, publishedAt: string, url: string }}
 */
function mapToUnifiedFormat(item, username = '') {
  const videoId = item.video_id || item.id;
  const authorUsername = item.author?.unique_id || username;

  return {
    id: String(videoId),
    title: item.title || `Film @${authorUsername}`,
    thumbnail: item.cover || '',
    viewCount: item.play_count || 0,
    likeCount: item.digg_count || 0,
    commentCount: item.comment_count || 0,
    publishedAt: item.create_time
      ? new Date(item.create_time * 1000).toISOString()
      : new Date().toISOString(),
    url: `https://www.tiktok.com/@${authorUsername}/video/${videoId}`,
  };
}

/**
 * Fetches the 3 most recent videos for a TikTok username.
 * Two-step flow: GET /user/info (resolve secUid) → GET /user/posts (fetch 3 latest videos)
 * @param {string} identifier — username, @username, or profile URL
 * @returns {Promise<{ videos: Array<{ id: string, title: string, thumbnail: string, viewCount: number, likeCount: number, commentCount: number, publishedAt: string, url: string }>, channelStats: { followerCount: number, heartCount: number } | null }>}
 */
export async function fetchTikTokVideos(identifier) {
  const RAPIDAPI_KEY = getTikTokApiKey();
  if (!RAPIDAPI_KEY) {
    throw new Error(
      'Brak klucza TikTok API. Skonfiguruj go w Ustawieniach (ikona ⚙️) lub w pliku .env (klucz znajdziesz na rapidapi.com).'
    );
  }

  const username = cleanUsername(identifier);

  const headers = {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };

  try {
    // Fetch latest videos directly using unique_id
    const postsResponse = await axios.get(`${BASE_URL}/user/posts`, {
      headers,
      params: { unique_id: username, count: 3, cursor: 0 },
    });
    trackApiUsage(postsResponse);

    const videos = postsResponse.data?.data?.videos;

    if (!videos || videos.length === 0) {
      throw new Error('Nie znaleziono filmów dla tego profilu lub profil nie istnieje.');
    }

    const mappedVideos = videos.slice(0, 3).map((item) => mapToUnifiedFormat(item, username));

    // Extract channel stats from the first video's author field
    const firstAuthor = videos[0]?.author;
    let channelStats = null;
    
    if (firstAuthor && (firstAuthor.follower_count || firstAuthor.heart_count)) {
      channelStats = {
        followerCount: firstAuthor.follower_count || 0,
        heartCount: firstAuthor.heart_count || 0,
      };
    } else {
      // Fallback: fetch user info for channel stats
      try {
        const userInfoResponse = await axios.get(`${BASE_URL}/user/info`, {
          headers,
          params: { unique_id: username },
        });
        trackApiUsage(userInfoResponse);
        const userInfo = userInfoResponse.data?.data;
        if (userInfo) {
          channelStats = {
            followerCount: userInfo.follower_count || userInfo.stats?.followerCount || 0,
            heartCount: userInfo.heart_count || userInfo.stats?.heartCount || 0,
          };
        }
      } catch (e) {
        // Non-critical — channel stats are optional
        console.warn('[tiktok] Failed to fetch user info for channel stats:', e.message);
      }
    }

    return { videos: mappedVideos, channelStats };
  } catch (error) {
    // Re-throw our own errors (from empty data checks)
    if (error.message && !error.response) {
      // Check if it's our custom error (not a network error from axios)
      if (
        error.message.includes('Nie znaleziono') ||
        error.message.includes('Brak klucza')
      ) {
        throw error;
      }
      // Network error (no response object at all)
      throw new Error('Błąd połączenia z API TikTok. Sprawdź połączenie internetowe.', { cause: error });
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Nieprawidłowy klucz API TikTok. Sprawdź klucz w Ustawieniach (ikona ⚙️).', { cause: error });
    }

    if (error.response?.status === 429) {
      trackApiUsage(error.response);
      throw new Error('Przekroczono limit darmowego planu TikTok API. Spróbuj ponownie za godzinę.', { cause: error });
    }

    throw new Error(`Nie udało się pobrać danych TikTok: ${error.message}`, { cause: error });
  }
}

/**
 * Fetches metadata for a single TikTok video by URL.
 * Single GET /?url=VIDEO_URL&hd=1 call
 * @param {string} videoUrl — full TikTok video URL
 * @returns {Promise<{ id: string, title: string, thumbnail: string, viewCount: number, publishedAt: string, url: string }>}
 */
export async function fetchTikTokVideoByUrl(videoUrl) {
  const RAPIDAPI_KEY = getTikTokApiKey();
  if (!RAPIDAPI_KEY) {
    throw new Error(
      'Brak klucza TikTok API. Skonfiguruj go w Ustawieniach (ikona ⚙️) lub w pliku .env (klucz znajdziesz na rapidapi.com).'
    );
  }

  if (!isValidTikTokUrl(videoUrl)) {
    throw new Error(
      'Nieprawidłowy link do filmu TikTok. Wklej pełny URL (np. https://www.tiktok.com/@user/video/123...).'
    );
  }

  const headers = {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };

  try {
    const response = await axios.get(BASE_URL, {
      headers,
      params: { url: videoUrl, hd: 1 },
    });
    trackApiUsage(response);

    const videoData = response.data?.data;

    if (!videoData || (!videoData.id && !videoData.video_id)) {
      throw new Error('Nie znaleziono filmów dla tego profilu lub profil nie istnieje.');
    }

    return mapToUnifiedFormat(videoData, videoData.author?.unique_id || '');
  } catch (error) {
    // Re-throw our own errors
    if (error.message && !error.response) {
      if (
        error.message.includes('Nie znaleziono') ||
        error.message.includes('Brak klucza') ||
        error.message.includes('Nieprawidłowy link')
      ) {
        throw error;
      }
      throw new Error('Błąd połączenia z API TikTok. Sprawdź połączenie internetowe.', { cause: error });
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Nieprawidłowy klucz API TikTok. Sprawdź klucz w Ustawieniach (ikona ⚙️).', { cause: error });
    }

    if (error.response?.status === 429) {
      trackApiUsage(error.response);
      throw new Error('Przekroczono limit darmowego planu TikTok API. Spróbuj ponownie za godzinę.', { cause: error });
    }

    throw new Error(`Nie udało się pobrać danych TikTok: ${error.message}`, { cause: error });
  }
}

// Export helpers for testing
export { cleanUsername, extractVideoId, mapToUnifiedFormat };
