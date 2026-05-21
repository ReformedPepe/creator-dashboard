const express = require('express');
const router = express.Router();
const { collectForUser } = require('../cron/collector');

// POST /api/refresh — trigger immediate data collection for the authenticated user only
// Accepts optional body { type: 'youtube' | 'tiktok' } to filter by platform
router.post('/refresh', async (req, res) => {
  try {
    const { type } = req.body || {};
    const results = await collectForUser(req.user.id, type || undefined);
    res.json({ status: 'ok', results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
