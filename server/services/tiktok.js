// services/tiktok.js — TikTok data via RapidAPI (tiktok-scraper7.p.rapidapi.com)
const axios = require('axios');

const RAPIDAPI_HOST = 'tiktok-scraper7.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

/**
 * Fetches up to 3 recent videos for a TikTok username via RapidAPI.
 * @param {string} identifier — TikTok username (with or without @ prefix)
 * @param {string} apiKey — RapidAPI key for TikTok Scraper
 * @returns {Promise<Array<{video_id: string, title: string, thumbnail: string, view_count: number}>>}
 */
async function fetchTikTokVideos(identifier, apiKey) {
  if (!apiKey) {
    console.warn('[tiktok] No TikTok API key provided — skipping');
    return [];
  }

  const username = identifier.startsWith('@') ? identifier.slice(1) : identifier;

  const headers = {
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };

  try {
    const response = await axios.get(`${BASE_URL}/user/posts`, {
      headers,
      params: { unique_id: username, count: 3, cursor: 0 },
      timeout: 15000,
    });

    const videos = response.data?.data?.videos;

    if (!videos || videos.length === 0) {
      console.warn(`[tiktok] No videos found for @${username}`);
      return [];
    }

    return videos.slice(0, 3).map((item) => ({
      video_id: String(item.video_id || item.id),
      title: item.title || `Video by @${username}`,
      thumbnail: item.cover || '',
      view_count: item.play_count || 0,
      like_count: item.digg_count || 0,
      comment_count: item.comment_count || 0,
    }));
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      console.error(`[tiktok] Invalid API key for @${username}`);
    } else if (err.response?.status === 429) {
      console.error(`[tiktok] Rate limit exceeded for @${username}`);
    } else {
      console.error(`[tiktok] Failed to fetch videos for @${username}:`, err.message);
    }
    return [];
  }
}

/**
 * Fetches TikTok user stats (followers, total likes).
 * @param {string} identifier — TikTok username
 * @param {string} apiKey — RapidAPI key
 * @returns {Promise<{follower_count: number, total_like_count: number}>}
 */
async function fetchTikTokChannelStats(identifier, apiKey) {
  if (!apiKey) return { follower_count: 0, total_like_count: 0 };

  const username = identifier.startsWith('@') ? identifier.slice(1) : identifier;

  const headers = {
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };

  try {
    const response = await axios.get(`${BASE_URL}/user/info`, {
      headers,
      params: { unique_id: username },
      timeout: 15000,
    });

    const stats = response.data?.data?.stats;
    if (!stats) return { follower_count: 0, total_like_count: 0 };

    return {
      follower_count: stats.followerCount || 0,
      total_like_count: stats.heartCount || stats.heart || 0,
    };
  } catch (err) {
    console.error(`[tiktok] Failed to fetch stats for @${username}:`, err.message);
    return { follower_count: 0, total_like_count: 0 };
  }
}

module.exports = { fetchTikTokVideos, fetchTikTokChannelStats };
