const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// GET /api/channels/:id/videos — get 3 most recent videos with snapshots
router.get('/:id/videos', async (req, res) => {
  const { id } = req.params;

  try {
    // Verify channel exists and belongs to user
    const { data: channel, error: chError } = await supabase
      .from('channels')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (chError || !channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Fetch 3 most recent videos
    const { data: videos, error: vidError } = await supabase
      .from('videos')
      .select('*')
      .eq('channel_id', id)
      .order('published_at', { ascending: false })
      .limit(3);

    if (vidError) throw vidError;

    // Fetch snapshots for each video
    const videosWithSnapshots = await Promise.all(
      videos.map(async (video) => {
        const { data: snapshots, error: snapError } = await supabase
          .from('snapshots')
          .select('view_count, timestamp')
          .eq('video_id', video.id)
          .order('timestamp', { ascending: true });

        if (snapError) {
          console.error(`[videos] Snapshot fetch error for video ${video.id}:`, snapError.message);
          return { ...video, snapshots: [] };
        }

        return { ...video, snapshots };
      })
    );

    res.json(videosWithSnapshots);
  } catch (err) {
    console.error('[videos] GET error:', err.message);
    res.status(500).json({ error: 'Nie udało się pobrać filmów' });
  }
});

module.exports = router;
