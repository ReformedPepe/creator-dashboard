// cron/collector.js — per-user data collection via Supabase
const { supabase } = require('../lib/supabase');
const { fetchYouTubeVideos } = require('../services/youtube');
const { fetchTikTokVideos } = require('../services/tiktok');

/**
 * Get all distinct user IDs that have channels.
 */
async function getUserIds() {
  const { data, error } = await supabase
    .from('channels')
    .select('user_id');

  if (error) {
    console.error('[cron] Failed to fetch user IDs:', error.message);
    return [];
  }

  // Deduplicate
  const unique = [...new Set(data.map(row => row.user_id))];
  return unique;
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

  return { channel: channel.name, status: 'ok', videosProcessed: videos.length };
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

module.exports = { collectAll, collectForChannel, collectYouTube, collectTikTok };
