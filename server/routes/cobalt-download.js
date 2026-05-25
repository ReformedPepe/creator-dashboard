const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

const COBALT_API_URL = process.env.COBALT_API_URL || '';
const TIMEOUT_MS = 300000; // 5 minutes

// POST /cobalt-info — fetch video metadata via YouTube oEmbed (same as yt-dlp variant)
// Reusing oEmbed because it's instant and doesn't need cobalt to be involved.
router.post('/cobalt-info', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Brak wymaganego pola: url' });
  }
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await axios.get(oembedUrl, { timeout: 10000 });
    const data = response.data || {};
    return res.json({
      title: data.title || 'Bez tytułu',
      thumbnail: data.thumbnail_url || null,
      uploader: data.author_name || null,
      duration: null,
      viewCount: null,
      availableQualities: ['1080p', '720p', '480p', '360p'],
      maxHeight: null
    });
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 401 || status === 404) {
        return res.status(400).json({ error: 'Film jest niedostępny lub link jest nieprawidłowy' });
      }
    }
    console.error('[cobalt-info] Error:', err.message);
    return res.status(500).json({ error: 'Nie udało się pobrać informacji o filmie' });
  }
});

// Map our quality string -> cobalt videoQuality string
// Our format is "720p", cobalt expects "720" (just the number) or "max"
function mapQuality(quality) {
  if (!quality) return '1080';
  const m = quality.match(/^(\d+)p$/i);
  if (m) return m[1];
  return '1080';
}

// POST /cobalt-download — proxy to Cobalt API + stream the resulting file to client
router.post('/cobalt-download', async (req, res) => {
  const { url, format, quality } = req.body;
  const tStart = Date.now();
  const log = (label) => console.log(`[cobalt-download] +${Date.now() - tStart}ms ${label}`);

  if (!COBALT_API_URL) {
    return res.status(500).json({ error: 'Cobalt API URL nie jest skonfigurowany' });
  }
  if (!url || !format) {
    return res.status(400).json({ error: 'Brak wymaganych pól: url, format' });
  }
  if (format !== 'mp4' && format !== 'mp3') {
    return res.status(400).json({ error: 'Nieprawidłowy format' });
  }

  log(`start url=${url} format=${format} quality=${quality}`);

  // Build cobalt request body
  const cobaltBody = {
    url,
    filenameStyle: 'pretty',
    disableMetadata: false
  };

  if (format === 'mp3') {
    cobaltBody.downloadMode = 'audio';
    cobaltBody.audioFormat = 'mp3';
    cobaltBody.audioBitrate = '128';
  } else {
    cobaltBody.downloadMode = 'auto';
    cobaltBody.videoQuality = mapQuality(quality);
  }

  let cobaltResponse;
  try {
    log('POST to cobalt');
    cobaltResponse = await axios.post(`${COBALT_API_URL.replace(/\/$/, '')}/`, cobaltBody, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      // Don't auto-throw on 4xx so we can read the JSON error
      validateStatus: () => true
    });
    log(`cobalt response status=${cobaltResponse.status}`);
  } catch (err) {
    console.error('[cobalt-download] Cobalt request failed:', err.message);
    return res.status(502).json({ error: 'Nie udało się połączyć z serwerem Cobalt' });
  }

  const data = cobaltResponse.data || {};

  // Cobalt response shapes:
  // - { status: "tunnel" | "redirect", url, filename }   — single file ready
  // - { status: "picker", picker: [{url, ...}], audio?: ... } — multiple options (we'll pick first)
  // - { status: "error", error: { code, ... } }
  if (cobaltResponse.status >= 400 || data.status === 'error') {
    const code = data?.error?.code || data?.error || `http_${cobaltResponse.status}`;
    console.error('[cobalt-download] Cobalt error:', JSON.stringify(data));
    // Map common cobalt errors to user-friendly Polish messages
    if (typeof code === 'string') {
      if (code.includes('youtube.login') || code.includes('youtube.auth')) {
        return res.status(400).json({ error: 'YouTube wymaga autoryzacji (cobalt nie ma cookies)' });
      }
      if (code.includes('youtube.video_unavailable') || code.includes('video_unavailable')) {
        return res.status(400).json({ error: 'Film jest niedostępny lub prywatny' });
      }
      if (code.includes('link.invalid') || code.includes('link.unsupported')) {
        return res.status(400).json({ error: 'Nieprawidłowy lub nieobsługiwany link' });
      }
      if (code.includes('rate_limit') || cobaltResponse.status === 429) {
        return res.status(429).json({ error: 'Przekroczono limit pobrań w Cobalt. Spróbuj za chwilę.' });
      }
    }
    return res.status(500).json({ error: 'Błąd Cobalt: ' + (typeof code === 'string' ? code : 'unknown') });
  }

  let downloadUrl = null;
  let suggestedFilename = null;

  if (data.status === 'tunnel' || data.status === 'redirect') {
    downloadUrl = data.url;
    suggestedFilename = data.filename;
  } else if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length > 0) {
    // Pick the first option (cobalt returns multiple choices for galleries etc.)
    downloadUrl = data.picker[0].url;
    suggestedFilename = data.audio?.filename || `download.${format}`;
  } else {
    console.error('[cobalt-download] Unexpected cobalt response shape:', JSON.stringify(data).slice(0, 500));
    return res.status(500).json({ error: 'Nieoczekiwana odpowiedź z Cobalt' });
  }

  if (!downloadUrl) {
    return res.status(500).json({ error: 'Cobalt nie zwrócił URL pobierania' });
  }

  log(`downloading from cobalt URL: ${downloadUrl.slice(0, 80)}...`);

  // Stream the actual file from cobalt's tunnel/CDN to our client
  let upstream;
  try {
    upstream = await axios.get(downloadUrl, {
      responseType: 'stream',
      timeout: TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: () => true
    });
  } catch (err) {
    console.error('[cobalt-download] Upstream fetch failed:', err.message);
    return res.status(502).json({ error: 'Nie udało się pobrać pliku z Cobalt' });
  }

  if (upstream.status >= 400) {
    console.error('[cobalt-download] Upstream returned status:', upstream.status);
    return res.status(502).json({ error: 'Cobalt zwrócił błąd przy pobieraniu pliku' });
  }

  // Forward headers we care about
  const filename = suggestedFilename || `download_${crypto.randomUUID()}.${format}`;
  const contentType = upstream.headers['content-type'] || (format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
  const contentLength = upstream.headers['content-length'];

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', contentType);
  if (contentLength) res.setHeader('Content-Length', contentLength);

  log(`stream start size=${contentLength ? (contentLength / 1024 / 1024).toFixed(1) + 'MB' : 'unknown'}`);

  upstream.data.pipe(res);

  upstream.data.on('end', () => log('done'));
  upstream.data.on('error', (err) => {
    console.error('[cobalt-download] Stream error:', err.message);
    try { res.end(); } catch {}
  });
});

module.exports = router;
