// YouTube Data API v3 — fetch 3 most recent videos with view counts
const axios = require('axios');

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Fetches the 3 most recent videos from a YouTube channel with view statistics.
 * Resolves @handles and non-UC identifiers to channel IDs automatically.
 *
 * @param {string} identifier — Channel ID (UC...), handle (@username), or username
 * @param {string} apiKey — YouTube Data API v3 key
 * @returns {Promise<Array<{video_id: string, title: string, thumbnail: string, published_at: string, view_count: number}>>}
 */
async function fetchYouTubeVideos(identifier, apiKey) {
  if (!apiKey) {
    throw new Error('Missing YouTube API key');
  }

  let channelId = identifier;

  // Resolve @handle or non-UC identifier to channel ID
  if (identifier.startsWith('@') || !identifier.startsWith('UC')) {
    const handle = identifier.startsWith('@') ? identifier : `@${identifier}`;
    const channelRes = await axios.get(`${BASE_URL}/channels`, {
      params: {
        part: 'contentDetails',
        forHandle: handle,
        key: apiKey,
      },
    });

    if (!channelRes.data.items || channelRes.data.items.length === 0) {
      throw new Error(`YouTube channel not found: ${identifier}`);
    }

    const channelItem = channelRes.data.items[0];
    channelId = channelItem.id;

    // Extract uploads playlist from the same response
    const uploadsPlaylistId = channelItem.contentDetails.relatedPlaylists.uploads;
    return fetchVideosFromPlaylist(uploadsPlaylistId, apiKey);
  }

  // Direct UC... channel ID — fetch contentDetails to get uploads playlist
  const channelRes = await axios.get(`${BASE_URL}/channels`, {
    params: {
      part: 'contentDetails',
      id: channelId,
      key: apiKey,
    },
  });

  if (!channelRes.data.items || channelRes.data.items.length === 0) {
    throw new Error(`YouTube channel not found: ${identifier}`);
  }

  const uploadsPlaylistId = channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;
  return fetchVideosFromPlaylist(uploadsPlaylistId, apiKey);
}

/**
 * Fetches the 3 most recent videos from a playlist and their statistics.
 *
 * @param {string} playlistId — YouTube uploads playlist ID
 * @param {string} apiKey — YouTube Data API v3 key
 * @returns {Promise<Array<{video_id: string, title: string, thumbnail: string, published_at: string, view_count: number}>>}
 */
async function fetchVideosFromPlaylist(playlistId, apiKey) {
  // Fetch 3 most recent uploads from playlist
  const playlistRes = await axios.get(`${BASE_URL}/playlistItems`, {
    params: {
      part: 'snippet',
      playlistId: playlistId,
      maxResults: 3,
      key: apiKey,
    },
  });

  const items = playlistRes.data.items;
  if (!items || items.length === 0) {
    return [];
  }

  const videoIds = items.map(item => item.snippet.resourceId.videoId);

  // Fetch video statistics
  const statsRes = await axios.get(`${BASE_URL}/videos`, {
    params: {
      part: 'statistics,snippet',
      id: videoIds.join(','),
      key: apiKey,
    },
  });

  // Return normalized array
  return statsRes.data.items.map(video => ({
    video_id: video.id,
    title: video.snippet.title,
    thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
    published_at: video.snippet.publishedAt,
    view_count: parseInt(video.statistics.viewCount, 10) || 0,
    like_count: parseInt(video.statistics.likeCount, 10) || 0,
    comment_count: parseInt(video.statistics.commentCount, 10) || 0,
  }));
}

module.exports = { fetchYouTubeVideos };
