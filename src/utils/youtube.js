// YouTube Data API v3 — pobieranie 3 ostatnich filmów z kanału
import axios from 'axios';
import { getYouTubeApiKey } from './apiKeys';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Pobiera 3 ostatnie filmy z kanału YouTube oraz statystyki kanału
 * @param {string} channelIdOrHandle — ID kanału YouTube (np. UC...) lub handle (@username)
 * @returns {Promise<{ videos: Array, channelStats: { subscriberCount: number|null, viewCount: number } }>}
 */
export async function fetchYouTubeVideos(channelIdOrHandle) {
  const API_KEY = getYouTubeApiKey();

  if (!API_KEY) {
    throw new Error('Brak klucza YouTube API. Skonfiguruj go w Ustawieniach (ikona ⚙️) lub w pliku .env.');
  }

  let channelId = channelIdOrHandle;
  let channelStats = null;

  // Resolve YouTube Handle (@username) to Channel ID (UC...)
  if (channelIdOrHandle.startsWith('@')) {
    const channelRes = await axios.get(`${BASE_URL}/channels`, {
      params: {
        part: 'id,statistics',
        forHandle: channelIdOrHandle,
        key: API_KEY,
      },
    });

    if (!channelRes.data.items || channelRes.data.items.length === 0) {
      throw new Error(`Nie znaleziono kanału YouTube o nazwie ${channelIdOrHandle}.`);
    }

    const channelItem = channelRes.data.items[0];
    channelId = channelItem.id;
    channelStats = extractChannelStats(channelItem);
  } else if (!channelIdOrHandle.startsWith('UC')) {
    // Attempt to treat it as a handle anyway by prepending @
    const channelRes = await axios.get(`${BASE_URL}/channels`, {
      params: {
        part: 'id,statistics',
        forHandle: `@${channelIdOrHandle}`,
        key: API_KEY,
      },
    });

    if (!channelRes.data.items || channelRes.data.items.length === 0) {
      throw new Error('Identyfikator kanału musi zaczynać się od "UC" (ID kanału) lub "@" (Handle/Nazwa).');
    }

    const channelItem = channelRes.data.items[0];
    channelId = channelItem.id;
    channelStats = extractChannelStats(channelItem);
  } else {
    // Direct UC... channel ID — fetch channel statistics separately
    const channelRes = await axios.get(`${BASE_URL}/channels`, {
      params: {
        part: 'statistics',
        id: channelId,
        key: API_KEY,
      },
    });

    if (channelRes.data.items && channelRes.data.items.length > 0) {
      channelStats = extractChannelStats(channelRes.data.items[0]);
    }
  }

  // Krok 1: Pobierz ID 3 ostatnich filmów
  const searchResponse = await axios.get(`${BASE_URL}/search`, {
    params: {
      part: 'snippet',
      channelId: channelId,
      order: 'date',
      maxResults: 3,
      type: 'video',
      key: API_KEY,
    },
  });

  const items = searchResponse.data.items;
  if (!items || items.length === 0) {
    return { videos: [], channelStats };
  }

  const videoIds = items.map(item => item.id.videoId).join(',');

  // Krok 2: Pobierz statystyki (wyświetlenia) dla tych filmów
  const statsResponse = await axios.get(`${BASE_URL}/videos`, {
    params: {
      part: 'statistics,snippet',
      id: videoIds,
      key: API_KEY,
    },
  });

  // Krok 3: Zmapuj dane do ujednoliconego formatu
  const videos = statsResponse.data.items.map(video => ({
    id: video.id,
    title: video.snippet.title,
    thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
    viewCount: parseInt(video.statistics.viewCount, 10),
    likeCount: video.statistics.likeCount != null ? parseInt(video.statistics.likeCount, 10) : null,
    commentCount: video.statistics.commentCount != null ? parseInt(video.statistics.commentCount, 10) : null,
    publishedAt: video.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${video.id}`,
  }));

  return { videos, channelStats };
}

/**
 * Extracts channel statistics from a YouTube channels API response item.
 * @param {object} channelItem — single item from channels API response
 * @returns {{ subscriberCount: number|null, viewCount: number }}
 */
function extractChannelStats(channelItem) {
  const stats = channelItem.statistics;
  if (!stats) return null;

  const subscriberCount = stats.hiddenSubscriberCount === true
    ? null
    : parseInt(stats.subscriberCount, 10);

  const viewCount = parseInt(stats.viewCount, 10);

  return { subscriberCount, viewCount };
}
