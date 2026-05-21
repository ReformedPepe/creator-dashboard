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

// GET /api/settings/status — check which keys are configured (without exposing values)
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
    });
  } catch (err) {
    console.error('[settings] GET status error:', err.message);
    res.status(500).json({ error: 'Nie udało się sprawdzić statusu kluczy' });
  }
});

module.exports = router;
