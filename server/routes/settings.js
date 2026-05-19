// routes/settings.js — API key management endpoint
const express = require('express');
const router = express.Router();
const { updateKeys, getYouTubeApiKey, getTikTokApiKey } = require('../services/settings');

// POST /api/settings — update API keys in memory
router.post('/settings', (req, res) => {
  const { youtubeApiKey, tiktokApiKey } = req.body;

  updateKeys({ youtubeApiKey, tiktokApiKey });

  console.log('[settings] API keys updated from frontend');
  console.log(`  YouTube key: ${getYouTubeApiKey() ? '***' + getYouTubeApiKey().slice(-4) : '(not set)'}`);
  console.log(`  TikTok key: ${getTikTokApiKey() ? '***' + getTikTokApiKey().slice(-4) : '(not set)'}`);

  res.json({ status: 'ok' });
});

// GET /api/settings/status — check which keys are configured (without exposing values)
router.get('/settings/status', (req, res) => {
  res.json({
    youtubeApiKey: !!getYouTubeApiKey(),
    tiktokApiKey: !!getTikTokApiKey(),
  });
});

module.exports = router;
