const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// GET /api/channels — list channels for authenticated user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[channels] GET error:', err.message);
    res.status(500).json({ error: 'Nie udało się pobrać kanałów' });
  }
});

// POST /api/channels — add a channel for authenticated user
router.post('/', async (req, res) => {
  const { type, name, identifier } = req.body;

  if (!type || !name || !identifier) {
    return res.status(400).json({ error: 'Missing required fields: type, name, identifier' });
  }
  if (!['youtube', 'tiktok'].includes(type)) {
    return res.status(400).json({ error: 'type must be "youtube" or "tiktok"' });
  }

  try {
    const { data, error } = await supabase
      .from('channels')
      .insert({ type, name, identifier, user_id: req.user.id })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('[channels] POST error:', err.message);
    res.status(500).json({ error: 'Nie udało się dodać kanału' });
  }
});

// DELETE /api/channels/:id — remove a channel (only if owned by user)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Verify ownership
    const { data: channel, error: fetchError } = await supabase
      .from('channels')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const { error: deleteError } = await supabase
      .from('channels')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (deleteError) throw deleteError;
    res.json({ message: 'Channel deleted', id });
  } catch (err) {
    console.error('[channels] DELETE error:', err.message);
    res.status(500).json({ error: 'Nie udało się usunąć kanału' });
  }
});

module.exports = router;
