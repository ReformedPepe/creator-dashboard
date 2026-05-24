const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const YTDlpWrap = require('yt-dlp-wrap').default;

const TIMEOUT_MS = 300000; // 300 seconds

// Quality mapping for mp4 format
const QUALITY_MAP = {
  '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
  '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
  '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
  '360p': 'bestvideo[height<=360]+bestaudio/best[height<=360]'
};

router.post('/youtube-download', async (req, res) => {
  const { url, format, quality } = req.body;

  // Validate required fields
  if (!url || !format) {
    return res.status(400).json({ error: 'Brak wymaganych pól: url, format' });
  }

  // Validate format value
  if (format !== 'mp4' && format !== 'mp3') {
    return res.status(400).json({ error: 'Brak wymaganych pól: url, format' });
  }

  const ext = format === 'mp4' ? 'mp4' : 'mp3';
  const fileId = crypto.randomUUID();
  const tempPath = path.join(os.tmpdir(), `yt-${fileId}.${ext}`);

  let ytDlpProcess = null;
  let timeoutId = null;
  let timedOut = false;

  try {
    const ytDlpWrap = new YTDlpWrap();

    // Build yt-dlp arguments
    const args = [url, '-o', tempPath];

    if (format === 'mp4') {
      const formatStr = QUALITY_MAP[quality] || QUALITY_MAP['720p'];
      args.push('-f', formatStr);
      args.push('--merge-output-format', 'mp4');
    } else {
      // mp3: extract best audio, convert to mp3
      args.push('-x', '--audio-format', 'mp3');
    }

    // Execute yt-dlp with timeout
    const downloadPromise = new Promise((resolve, reject) => {
      ytDlpProcess = ytDlpWrap.exec(args);

      ytDlpProcess.on('close', (code) => {
        if (timedOut) return;
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });

      ytDlpProcess.on('error', (err) => {
        if (timedOut) return;
        reject(err);
      });
    });

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        // Kill the yt-dlp process
        if (ytDlpProcess) {
          ytDlpProcess.kill('SIGKILL');
        }
        reject(new Error('TIMEOUT'));
      }, TIMEOUT_MS);
    });

    await Promise.race([downloadPromise, timeoutPromise]);

    // Clear timeout on success
    if (timeoutId) clearTimeout(timeoutId);

    // Verify file exists
    if (!fs.existsSync(tempPath)) {
      return res.status(400).json({ error: 'Film jest niedostępny lub link jest nieprawidłowy' });
    }

    // Set response headers
    const filename = `download_${fileId}.${ext}`;
    const contentType = format === 'mp4' ? 'video/mp4' : 'audio/mpeg';

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);

    // Stream file to client
    const fileStream = fs.createReadStream(tempPath);
    fileStream.pipe(res);

    // Wait for stream to finish before cleanup
    await new Promise((resolve, reject) => {
      fileStream.on('end', resolve);
      fileStream.on('error', reject);
    });
  } catch (err) {
    // Clear timeout if still pending
    if (timeoutId) clearTimeout(timeoutId);

    if (err.message === 'TIMEOUT') {
      return res.status(408).json({ error: 'Przekroczono limit czasu pobierania' });
    }

    // Check if it's an unavailable video error
    const errorMsg = err.message || '';
    if (
      errorMsg.includes('Video unavailable') ||
      errorMsg.includes('Private video') ||
      errorMsg.includes('is not a valid URL') ||
      errorMsg.includes('Unsupported URL')
    ) {
      return res.status(400).json({ error: 'Film jest niedostępny lub link jest nieprawidłowy' });
    }

    console.error('[youtube-download] Error:', err.message);
    return res.status(500).json({ error: 'Błąd podczas pobierania pliku' });
  } finally {
    // Cleanup temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
});

module.exports = router;
