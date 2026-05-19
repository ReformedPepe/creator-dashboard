const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/channels/:id/videos — get 3 most recent videos with snapshots
router.get('/:id/videos', (req, res) => {
  const { id } = req.params;

  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const videos = db.prepare(
    'SELECT * FROM videos WHERE channel_id = ? ORDER BY published_at DESC LIMIT 3'
  ).all(id);

  const videosWithSnapshots = videos.map(video => {
    const snapshots = db.prepare(
      'SELECT view_count, timestamp FROM snapshots WHERE video_id = ? ORDER BY timestamp ASC'
    ).all(video.id);

    return { ...video, snapshots };
  });

  res.json(videosWithSnapshots);
});

module.exports = router;
