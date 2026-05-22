// routes/settings.js — API key management via Supabase
const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// POST /api/settings — save API keys for authenticated user
router.post('/settings', async (req, res) => {
  const { youtubeApiKey, tiktokApiKey } = req.body;
  const userId = req.user.id;

  try {
    // Upsert — insert or update on conflict (user_id)
    const { error } = await supabase
      .from('api_keys')
      .upsert(
        {
          user_id: userId,
          youtube_api_key: youtubeApiKey || null,
          tiktok_rapidapi_key: tiktokApiKey || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    console.log(`[settings] API keys updated for user ${userId}`);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[settings] POST error:', err.message);
    res.status(500).json({ error: 'Nie udało się zapisać kluczy' });
  }
});

// GET /api/settings/status — return masked keys and boolean status
router.get('/settings/status', async (req, res) => {
  const userId = req.user.id;

  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('youtube_api_key, tiktok_rapidapi_key')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

    res.json({
      youtubeKeySet: !!(data?.youtube_api_key),
      tiktokKeySet: !!(data?.tiktok_rapidapi_key),
      youtubeMasked: maskKey(data?.youtube_api_key),
      tiktokMasked: maskKey(data?.tiktok_rapidapi_key),
    });
  } catch (err) {
    console.error('[settings] GET status error:', err.message);
    res.status(500).json({ error: 'Nie udało się sprawdzić statusu kluczy' });
  }
});

/**
 * Masks a key: first 4 chars + •••••••• + last 4 chars
 * Returns null if key is empty/null
 */
function maskKey(key) {
  if (!key || key.length < 9) return key ? '••••••••' : null;
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

// DELETE /api/account — delete user account and all associated data
router.delete('/account', async (req, res) => {
  const userId = req.user.id;

  try {
    console.log(`[account] Deleting all data for user ${userId}...`);

    // 1. Get all channel IDs for this user
    const { data: channels } = await supabase
      .from('channels')
      .select('id')
      .eq('user_id', userId);

    const channelIds = channels?.map(ch => ch.id) || [];

    if (channelIds.length > 0) {
      // 2. Get all video IDs for these channels
      const { data: videos } = await supabase
        .from('videos')
        .select('id')
        .in('channel_id', channelIds);

      const videoIds = videos?.map(v => v.id) || [];

      // 3. Delete snapshots for all videos
      if (videoIds.length > 0) {
        await supabase.from('snapshots').delete().in('video_id', videoIds);
      }

      // 4. Delete videos
      await supabase.from('videos').delete().in('channel_id', channelIds);

      // 5. Delete channels
      await supabase.from('channels').delete().eq('user_id', userId);
    }

    // 6. Delete API keys
    await supabase.from('api_keys').delete().eq('user_id', userId);

    // 7. Delete user activity
    await supabase.from('user_activity').delete().eq('user_id', userId);

    // 8. Delete the auth user via admin API
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      console.error(`[account] Failed to delete auth user:`, authError.message);
      // Data is already deleted, log but don't fail
    }

    console.log(`[account] User ${userId} fully deleted.`);
    res.json({ status: 'deleted' });
  } catch (err) {
    console.error('[account] DELETE error:', err.message);
    res.status(500).json({ error: 'Nie udało się usunąć konta' });
  }
});

module.exports = router;
