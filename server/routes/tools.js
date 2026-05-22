// routes/tools.js — utility tools (no auth required)
const express = require('express');
const router = express.Router();
const { YoutubeTranscript } = require('youtube-transcript');

/**
 * Extracts video ID from various YouTube URL formats.
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/
 */
function extractVideoId(url) {
  if (!url) return null;

  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // youtube.com/shorts/VIDEO_ID
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  // youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // Raw video ID (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

  return null;
}

/**
 * Formats milliseconds offset to [MM:SS] timestamp.
 */
function formatTimestamp(offsetMs) {
  const totalSeconds = Math.floor(offsetMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;
}

// POST /api/tools/transcript — fetch YouTube video transcript
router.post('/transcript', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Podaj link do filmu YouTube' });
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'Nieprawidłowy link do filmu YouTube' });
  }

  try {
    const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!rawTranscript || rawTranscript.length === 0) {
      return res.status(404).json({ error: 'Ten film nie ma dostępnych napisów' });
    }

    const transcript = rawTranscript.map(item => ({
      timestamp: formatTimestamp(item.offset),
      text: item.text,
      offset: item.offset,
    }));

    res.json({ transcript });
  } catch (err) {
    console.error('[tools/transcript] Error:', err.message);

    if (err.message?.includes('disabled') || err.message?.includes('Transcript')) {
      return res.status(404).json({ error: 'Ten film nie ma dostępnych napisów' });
    }

    res.status(500).json({ error: 'Nie udało się pobrać transkrypcji' });
  }
});

module.exports = router;
