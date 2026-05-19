const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/channels — list all channels
router.get('/', (req, res) => {
  const channels = db.prepare('SELECT * FROM channels ORDER BY created_at DESC').all();
  res.json(channels);
});

// POST /api/channels — add a channel
router.post('/', (req, res) => {
  const { type, name, identifier } = req.body;

  if (!type || !name || !identifier) {
    return res.status(400).json({ error: 'Missing required fields: type, name, identifier' });
  }
  if (!['youtube', 'tiktok'].includes(type)) {
    return res.status(400).json({ error: 'type must be "youtube" or "tiktok"' });
  }

  const result = db.prepare(
    'INSERT INTO channels (type, name, identifier) VALUES (?, ?, ?)'
  ).run(type, name, identifier);

  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(channel);
});

// DELETE /api/channels/:id — remove a channel (cascades to videos + snapshots)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);

  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  db.prepare('DELETE FROM channels WHERE id = ?').run(id);
  res.json({ message: 'Channel deleted', id: Number(id) });
});

module.exports = router;
