const express = require('express');
const router = express.Router();
const { collectAll } = require('../cron/collector');

// POST /api/refresh — trigger immediate data collection
// Accepts optional body { type: 'youtube' | 'tiktok' } to filter by platform
router.post('/refresh', async (req, res) => {
  try {
    const { type } = req.body || {};
    const results = await collectAll(type || undefined);
    res.json({ status: 'ok', results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/health — server availability check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

module.exports = router;
