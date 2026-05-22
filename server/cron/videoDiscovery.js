// cron/videoDiscovery.js — detects new YouTube videos every 5 minutes
// Only checks channels with recent activity (snapshot < 48h, published video < 7 days)
const axios = require('axios');
const { supabase } = require('../lib/supabase');

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Resolves a channel identifier to an uploads playlist ID.
 * @param {string} identifier — UC..., @handle, or username
 * @param {string} apiKey
 * @returns {Promise<string|null>} uploads playlist ID or null
 */
async function getUploadsPlaylistId(identifier, apiKey) {
  let params;
  if (identifier.startsWith('@') || !identifier.startsWith('UC')) {
    const handle = identifier.startsWith('@') ? identifier : `@${identifier}`;
    params = { part: 'contentDetails', forHandle: handle, key: apiKey };
  } else {
    params = { part: 'contentDetails', id: identifier, key: apiKey };
  }

  const res = await axios.get(`${BASE_URL}/channels`, { params });
  const item = res.data?.items?.[0];
  if (!item) return null;
  return item.contentDetails.relatedPlaylists.uploads;
}

/**
 * Fetches the latest video IDs from a playlist (up to 10).
 * @param {string} playlistId
 * @param {string} apiKey
 * @returns {Promise<string[]>} array of video IDs
 */
async function fetchLatestVideoIds(playlistId, apiKey) {
  const res = await axios.get(`${BASE_URL}/playlistItems`, {
    params: {
      part: 'snippet',
      playlistId,
      maxResults: 10,
      key: apiKey,
    },
  });

  if (!res.data.items || res.data.items.length === 0) return [];
  return res.data.items.map(item => item.snippet.resourceId.videoId);
}

/**
 * Fetches full video details (title, thumbnail, stats) for given video IDs.
 * @param {string[]} videoIds
 * @param {string} apiKey
 * @returns {Promise<Array<{video_id, title, thumbnail, published_at, view_count, like_count, comment_count}>>}
 */
async function fetchVideoDetails(videoIds, apiKey) {
  const res = await axios.get(`${BASE_URL}/videos`, {
    params: {
      part: 'statistics,snippet',
      id: videoIds.join(','),
      key: apiKey,
    },
  });

  return (res.data.items || []).map(video => ({
    video_id: video.id,
    title: video.snippet.title,
    thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
    published_at: video.snippet.publishedAt,
    view_count: parseInt(video.statistics.viewCount, 10) || 0,
    like_count: parseInt(video.statistics.likeCount, 10) || 0,
    comment_count: parseInt(video.statistics.commentCount, 10) || 0,
  }));
}

/**
 * Gets YouTube channels whose owner has been active in the last 7 days
 * (user_activity.last_seen_at > now - 7 days).
 */
async function getActiveYouTubeChannels() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get active user IDs from user_activity
  const { data: activeUsers, error: actError } = await supabase
    .from('user_activity')
    .select('user_id')
    .gte('last_seen_at', sevenDaysAgo);

  if (actError || !activeUsers) {
    console.error('[discovery] Failed to fetch active users:', actError?.message);
    return [];
  }

  const activeUserIds = activeUsers.map(row => row.user_id);
  if (activeUserIds.length === 0) return [];

  // Get YouTube channels belonging to active users
  const { data: channels, error } = await supabase
    .from('channels')
    .select('id, user_id, identifier, name')
    .eq('type', 'youtube')
    .in('user_id', activeUserIds);

  if (error || !channels) {
    console.error('[discovery] Failed to fetch YouTube channels:', error?.message);
    return [];
  }

  return channels;
}

/**
 * Checks if a channel has published a video in the last 7 days.
 * If not, the channel is considered inactive and skipped.
 */
async function hasRecentVideo(channelId) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('videos')
    .select('id')
    .eq('channel_id', channelId)
    .gte('published_at', sevenDaysAgo)
    .limit(1);

  if (error) return false;
  return data && data.length > 0;
}

/**
 * Gets the API key for a user.
 */
async function getUserApiKey(userId) {
  const { data, error } = await supabase
    .from('api_keys')
    .select('youtube_api_key')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.youtube_api_key || null;
}

/**
 * Gets existing video_ids for a channel from the database.
 */
async function getExistingVideoIds(channelId) {
  const { data, error } = await supabase
    .from('videos')
    .select('video_id')
    .eq('channel_id', channelId);

  if (error || !data) return new Set();
  return new Set(data.map(v => v.video_id));
}

/**
 * Saves a newly discovered video and its first snapshot.
 */
async function saveNewVideo(channelId, video) {
  const { data: videoRow, error: videoError } = await supabase
    .from('videos')
    .upsert(
      {
        channel_id: channelId,
        video_id: video.video_id,
        title: video.title,
        thumbnail: video.thumbnail,
        published_at: video.published_at || null,
        updated_at: new Date().toISOString(),
        like_count: video.like_count || 0,
        comment_count: video.comment_count || 0,
      },
      { onConflict: 'channel_id,video_id' }
    )
    .select('id')
    .single();

  if (videoError) {
    console.error(`[discovery] Failed to save video ${video.video_id}:`, videoError.message);
    return;
  }

  // First snapshot
  const { error: snapError } = await supabase
    .from('snapshots')
    .insert({
      video_id: videoRow.id,
      view_count: video.view_count,
      timestamp: new Date().toISOString(),
    });

  if (snapError) {
    console.error(`[discovery] Failed to insert snapshot for ${video.video_id}:`, snapError.message);
  }
}

/**
 * Main discovery function — checks all active YouTube channels for new videos.
 */
async function discoverNewVideos() {
  console.log(`[discovery] Starting new video detection at ${new Date().toISOString()}`);

  const channels = await getActiveYouTubeChannels();
  console.log(`[discovery] Found ${channels.length} active YouTube channel(s) to check`);

  let totalDiscovered = 0;

  for (const channel of channels) {
    try {
      // Check if channel has published recently (7 days)
      const hasRecent = await hasRecentVideo(channel.id);
      if (!hasRecent) {
        console.log(`[discovery] Skipping "${channel.name}" — no video published in last 7 days`);
        continue;
      }

      // Get user's API key
      const apiKey = await getUserApiKey(channel.user_id);
      if (!apiKey) {
        console.log(`[discovery] Skipping "${channel.name}" — no YouTube API key for user`);
        continue;
      }

      // Get uploads playlist
      const playlistId = await getUploadsPlaylistId(channel.identifier, apiKey);
      if (!playlistId) {
        console.warn(`[discovery] Could not resolve playlist for "${channel.name}"`);
        continue;
      }

      // Fetch latest 10 video IDs from YouTube
      const latestIds = await fetchLatestVideoIds(playlistId, apiKey);
      if (latestIds.length === 0) continue;

      // Compare with existing videos in DB
      const existingIds = await getExistingVideoIds(channel.id);
      const newIds = latestIds.filter(id => !existingIds.has(id));

      if (newIds.length === 0) continue;

      console.log(`[discovery] Found ${newIds.length} new video(s) for "${channel.name}"`);

      // Fetch details and save new videos
      const newVideos = await fetchVideoDetails(newIds, apiKey);
      for (const video of newVideos) {
        await saveNewVideo(channel.id, video);
        console.log(`  [discovery] Added: "${video.title}" (${video.view_count.toLocaleString()} views)`);
        totalDiscovered++;
      }
    } catch (err) {
      console.error(`[discovery] Error checking "${channel.name}":`, err.message);
      // Continue with next channel — don't break the whole loop
    }
  }

  console.log(`[discovery] Complete. Discovered ${totalDiscovered} new video(s) total.`);
}

module.exports = { discoverNewVideos };
