// cron/collector.js
const db = require('../db');
const { fetchYouTubeVideos } = require('../services/youtube');
const { fetchTikTokVideos } = require('../services/tiktok');
const { getYouTubeApiKey } = require('../services/settings');

// Prepared statements for performance
const upsertVideo = db.prepare(`
  INSERT INTO videos (channel_id, video_id, title, thumbnail, published_at, updated_at, like_count, comment_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(channel_id, video_id) DO UPDATE SET
    title = excluded.title,
    thumbnail = excluded.thumbnail,
    updated_at = excluded.updated_at,
    like_count = excluded.like_count,
    comment_count = excluded.comment_count
`);

const insertSnapshot = db.prepare(
  'INSERT INTO snapshots (video_id, view_count, timestamp) VALUES (?, ?, ?)'
);

const getVideoId = db.prepare(
  'SELECT id FROM videos WHERE channel_id = ? AND video_id = ?'
);

const getAllChannels = db.prepare('SELECT * FROM channels');

/**
 * Collects data for a single channel — fetches videos, upserts them, and inserts snapshots.
 * @param {object} channel — channel row from the database
 * @returns {Promise<{channel: string, status: string, videosProcessed?: number, reason?: string}>}
 */
async function collectForChannel(channel) {
  let videos;

  if (channel.type === 'youtube') {
    const apiKey = getYouTubeApiKey();
    if (!apiKey) {
      console.warn(`[cron] Skipping YouTube channel "${channel.name}" — no YOUTUBE_API_KEY`);
      return { channel: channel.name, status: 'skipped', reason: 'no API key' };
    }
    videos = await fetchYouTubeVideos(channel.identifier, apiKey);
  } else if (channel.type === 'tiktok') {
    videos = await fetchTikTokVideos(channel.identifier);
  } else {
    return { channel: channel.name, status: 'skipped', reason: `unknown type: ${channel.type}` };
  }

  const now = Date.now();

  // Use a transaction for atomicity — upsert videos + insert snapshots together
  const processVideos = db.transaction((vids) => {
    for (const v of vids) {
      upsertVideo.run(
        channel.id,
        v.video_id,
        v.title,
        v.thumbnail,
        v.published_at || null,
        new Date().toISOString(),
        v.like_count || 0,
        v.comment_count || 0
      );

      const dbVideo = getVideoId.get(channel.id, v.video_id);
      insertSnapshot.run(dbVideo.id, v.view_count, now);

      console.log(`  [${channel.name}] ${v.title} — ${v.view_count.toLocaleString()} views`);
    }
  });

  processVideos(videos);

  return { channel: channel.name, status: 'ok', videosProcessed: videos.length };
}

/**
 * Collects data for all registered channels.
 * Iterates channels sequentially, isolating errors per channel with try/catch.
 * @param {string} [filterType] — optional: 'youtube' or 'tiktok' to collect only that type
 * @returns {Promise<Array<{channel: string, status: string, videosProcessed?: number, error?: string}>>}
 */
async function collectAll(filterType) {
  const allChannels = getAllChannels.all();
  const channels = filterType
    ? allChannels.filter(ch => ch.type === filterType)
    : allChannels;

  console.log(`[cron] Starting collection for ${channels.length} ${filterType || 'all'} channel(s)...`);

  const results = [];

  for (const channel of channels) {
    try {
      const result = await collectForChannel(channel);
      results.push(result);
    } catch (err) {
      console.error(`[cron] Error collecting "${channel.name}":`, err.message);
      results.push({ channel: channel.name, status: 'error', error: err.message });
    }
  }

  console.log(`[cron] Collection complete. Results:`, results);
  return results;
}

/**
 * Collect only YouTube channels.
 */
async function collectYouTube() {
  return collectAll('youtube');
}

/**
 * Collect only TikTok channels.
 */
async function collectTikTok() {
  return collectAll('tiktok');
}

module.exports = { collectAll, collectForChannel, collectYouTube, collectTikTok };
