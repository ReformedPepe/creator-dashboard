const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

const COBALT_API_URL = process.env.COBALT_API_URL || '';
const TIMEOUT_MS = 300000; // 5 minutes

// Defensive URL validation — accept only TikTok and X / Twitter.
// (Frontend already validates; this is a safety net.)
function detectPlatform(url) {
  if (typeof url !== 'string') return null;
  const u = url.trim();
  if (/^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.\-]+\/video\/\d+/i.test(u)) return 'tiktok';
  if (/^(?:https?:\/\/)?(?:vm|vt)\.tiktok\.com\/[\w-]+/i.test(u)) return 'tiktok';
  if (/^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/[\w-]+/i.test(u)) return 'tiktok';
  if (/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter|x)\.com\/[\w]+\/status\/\d+/i.test(u)) return 'x';
  return null;
}

// POST /social-info — minimal preview metadata.
// We can't get rich metadata for TT/X without scraping; return platform + URL echo so the
// frontend can show a basic preview card. Actual download will fetch the real file.
router.post('/social-info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Brak wymaganego pola: url' });
  const platform = detectPlatform(url);
  if (!platform) {
    return res.status(400).json({ error: 'Obsługiwane są tylko linki TikTok i X / Twitter' });
  }
  res.json({ platform, url });
});

// POST /social-download — proxy to Cobalt, stream the resulting file.
router.post('/social-download', async (req, res) => {
  const { url, format } = req.body;
  const tStart = Date.now();
  const log = (label) => console.log(`[social-download] +${Date.now() - tStart}ms ${label}`);

  if (!COBALT_API_URL) {
    return res.status(500).json({ error: 'Cobalt API URL nie jest skonfigurowany' });
  }
  if (!url || !format) {
    return res.status(400).json({ error: 'Brak wymaganych pól: url, format' });
  }
  if (format !== 'mp4' && format !== 'mp3') {
    return res.status(400).json({ error: 'Nieprawidłowy format' });
  }
  const platform = detectPlatform(url);
  if (!platform) {
    return res.status(400).json({ error: 'Obsługiwane są tylko linki TikTok i X / Twitter' });
  }

  log(`start platform=${platform} format=${format}`);

  // Cobalt request — always best quality, no watermark on TikTok by default (cobalt strips it).
  const cobaltBody = {
    url,
    filenameStyle: 'pretty',
    videoQuality: 'max',
    disableMetadata: false,
  };

  if (format === 'mp3') {
    cobaltBody.downloadMode = 'audio';
    cobaltBody.audioFormat = 'mp3';
    cobaltBody.audioBitrate = '128';
  } else {
    cobaltBody.downloadMode = 'auto';
  }

  let cobaltResponse;
  try {
    log('POST to cobalt');
    cobaltResponse = await axios.post(`${COBALT_API_URL.replace(/\/$/, '')}/`, cobaltBody, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
      validateStatus: () => true,
    });
    log(`cobalt response status=${cobaltResponse.status}`);
  } catch (err) {
    console.error('[social-download] Cobalt request failed:', err.message);
    return res.status(502).json({ error: 'Nie udało się połączyć z serwerem Cobalt' });
  }

  const data = cobaltResponse.data || {};

  if (cobaltResponse.status >= 400 || data.status === 'error') {
    const code = data?.error?.code || data?.error || `http_${cobaltResponse.status}`;
    console.error('[social-download] Cobalt error:', JSON.stringify(data));
    if (typeof code === 'string') {
      if (code.includes('content.video.unavailable') || code.includes('video_unavailable')) {
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
    // Cobalt returns multiple items for image galleries etc. — pick the first.
    downloadUrl = data.picker[0].url;
    suggestedFilename = data.audio?.filename || `download.${format}`;
  } else {
    console.error('[social-download] Unexpected cobalt response shape:', JSON.stringify(data).slice(0, 500));
    return res.status(500).json({ error: 'Nieoczekiwana odpowiedź z Cobalt' });
  }

  if (!downloadUrl) {
    return res.status(500).json({ error: 'Cobalt nie zwrócił URL pobierania' });
  }

  log(`downloading from cobalt: ${downloadUrl.slice(0, 80)}...`);

  let upstream;
  try {
    upstream = await axios.get(downloadUrl, {
      responseType: 'stream',
      timeout: TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: () => true,
    });
  } catch (err) {
    console.error('[social-download] Upstream fetch failed:', err.message);
    return res.status(502).json({ error: 'Nie udało się pobrać pliku z Cobalt' });
  }

  if (upstream.status >= 400) {
    console.error('[social-download] Upstream returned status:', upstream.status);
    return res.status(502).json({ error: 'Cobalt zwrócił błąd przy pobieraniu pliku' });
  }

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
    console.error('[social-download] Stream error:', err.message);
    try { res.end(); } catch {}
  });
});

module.exports = router;
