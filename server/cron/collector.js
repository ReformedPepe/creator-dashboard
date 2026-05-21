// cron/collector.js — per-user data collection via Supabase
const { supabase } = require('../lib/supabase');
const { fetchYouTubeVideos } = require('../services/youtube');
const { fetchTikTokVideos } = require('../services/tiktok');

/**
 * Get active user IDs — only users who logged in within the last 7 days
 * and have at least one channel.
 */
async function getUserIds() {
  // Get users active in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: activeUsers, error: actError } = await supabase
    .from('user_activity')
    .select('user_id')
    .gte('last_seen_at', sevenDaysAgo);

  if (actError) {
    console.error('[cron] Failed to fetch active users:', actError.message);
    return [];
  }

  const activeUserIds = new Set(activeUsers.map(row => row.user_id));

  // Get all users that have channels
  const { data: channelUsers, error: chError } = await supabase
    .from('channels')
    .select('user_id');

  if (chError) {
    console.error('[cron] Failed to fetch channel user IDs:', chError.message);
    return [];
  }

  const allChannelUserIds = [...new Set(channelUsers.map(row => row.user_id))];

  // Filter: only active users with channels
  const result = [];
  for (const userId of allChannelUserIds) {
    if (activeUserIds.has(userId)) {
      result.push(userId);
    } else {
      console.log(`[cron] Skipping inactive user ${userId}`);
    }
  }

  return result;
}

/**
 * Get API keys for a specific user.
 */
async function getUserKeys(userId) {
  const { data, error } = await supabase
    .from('api_keys')
    .select('youtube_api_key, tiktok_rapidapi_key')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { youtubeApiKey: null, tiktokApiKey: null };
  }

  return {
    youtubeApiKey: data.youtube_api_key || null,
    tiktokApiKey: data.tiktok_rapidapi_key || null,
  };
}

/**
 * Get channels for a specific user, optionally filtered by type.
 */
async function getUserChannels(userId, filterType) {
  let query = supabase
    .from('channels')
    .select('*')
    .eq('user_id', userId);

  if (filterType) {
    query = query.eq('type', filterType);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`[cron] Failed to fetch channels for user ${userId}:`, error.message);
    return [];
  }

  return data;
}

/**
 * Upsert a video and insert a snapshot into Supabase.
 */
async function saveVideoAndSnapshot(channelId, video) {
  // Upsert video
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
    console.error(`[cron] Failed to upsert video ${video.video_id}:`, videoError.message);
    return;
  }

  // Insert snapshot
  const { error: snapError } = await supabase
    .from('snapshots')
    .insert({
      video_id: videoRow.id,
      view_count: video.view_count,
      timestamp: new Date().toISOString(),
    });

  if (snapError) {
    console.error(`[cron] Failed to insert snapshot for ${video.video_id}:`, snapError.message);
  }
}

/**
 * Collects data for a single channel using provided API keys.
 * After upserting the latest 3 videos, removes any older videos for this channel.
 */
async function collectForChannel(channel, keys) {
  let videos;

  if (channel.type === 'youtube') {
    if (!keys.youtubeApiKey) {
      console.warn(`[cron] Skipping YouTube channel "${channel.name}" — no API key for user`);
      return { channel: channel.name, status: 'skipped', reason: 'no API key' };
    }
    videos = await fetchYouTubeVideos(channel.identifier, keys.youtubeApiKey);
  } else if (channel.type === 'tiktok') {
    if (!keys.tiktokApiKey) {
      console.warn(`[cron] Skipping TikTok channel "${channel.name}" — no API key for user`);
      return { channel: channel.name, status: 'skipped', reason: 'no API key' };
    }
    videos = await fetchTikTokVideos(channel.identifier, keys.tiktokApiKey);
  } else {
    return { channel: channel.name, status: 'skipped', reason: `unknown type: ${channel.type}` };
  }

  for (const v of videos) {
    await saveVideoAndSnapshot(channel.id, v);
    console.log(`  [${channel.name}] ${v.title} — ${v.view_count.toLocaleString()} views`);
  }

  // Cleanup: remove videos that are no longer in the latest 3
  const currentVideoIds = videos.map(v => v.video_id);
  if (currentVideoIds.length > 0) {
    // Get all videos for this channel that are NOT in the current set
    const { data: oldVideos, error: fetchOldErr } = await supabase
      .from('videos')
      .select('id, video_id')
      .eq('channel_id', channel.id)
      .not('video_id', 'in', `(${currentVideoIds.join(',')})`);

    if (!fetchOldErr && oldVideos && oldVideos.length > 0) {
      const oldIds = oldVideos.map(v => v.id);
      // Delete snapshots for old videos first
      await supabase.from('snapshots').delete().in('video_id', oldIds);
      // Delete old videos
      await supabase.from('videos').delete().in('id', oldIds);
      console.log(`  [${channel.name}] Cleaned up ${oldVideos.length} old video(s)`);
    }
  }

  return { channel: channel.name, status: 'ok', videosProcessed: videos.length };
}

/**
 * Collects data for a single user's channels.
 * Used by POST /api/refresh to only refresh the authenticated user's data.
 * @param {string} userId — Supabase user ID
 * @param {string} [filterType] — optional: 'youtube' or 'tiktok'
 */
async function collectForUser(userId, filterType) {
  const keys = await getUserKeys(userId);
  const channels = await getUserChannels(userId, filterType);

  console.log(`[cron] Refreshing ${channels.length} channel(s) for user ${userId}, filter: ${filterType || 'all'}...`);

  const results = [];
  for (const channel of channels) {
    try {
      const result = await collectForChannel(channel, keys);
      results.push(result);
    } catch (err) {
      console.error(`[cron] Error collecting "${channel.name}":`, err.message);
      results.push({ channel: channel.name, status: 'error', error: err.message });
    }
  }

  return results;
}

/**
 * Collects data for all users and their channels.
 * @param {string} [filterType] — optional: 'youtube' or 'tiktok'
 */
async function collectAll(filterType) {
  const userIds = await getUserIds();
  console.log(`[cron] Starting collection for ${userIds.length} user(s), filter: ${filterType || 'all'}...`);

  const allResults = [];

  for (const userId of userIds) {
    const keys = await getUserKeys(userId);
    const channels = await getUserChannels(userId, filterType);

    for (const channel of channels) {
      try {
        const result = await collectForChannel(channel, keys);
        allResults.push(result);
      } catch (err) {
        console.error(`[cron] Error collecting "${channel.name}":`, err.message);
        allResults.push({ channel: channel.name, status: 'error', error: err.message });
      }
    }
  }

  console.log(`[cron] Collection complete. ${allResults.length} channel(s) processed.`);
  return allResults;
}

async function collectYouTube() {
  return collectAll('youtube');
}

async function collectTikTok() {
  return collectAll('tiktok');
}

module.exports = { collectAll, collectForChannel, collectForUser, collectYouTube, collectTikTok };
