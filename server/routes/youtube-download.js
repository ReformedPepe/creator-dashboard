const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const TIMEOUT_MS = 300000; // 300 seconds

// Download yt-dlp binary via curl if not present
const ytDlpPath = path.join(__dirname, '..', 'yt-dlp');
// Deno is required by yt-dlp for YouTube JS challenge solving (n-sig)
const denoPath = path.join(__dirname, '..', 'deno');

function ensureYtDlp() {
  if (!fs.existsSync(ytDlpPath)) {
    console.log('[yt-dlp] Downloading binary...');
    execSync(
      `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ${ytDlpPath} && chmod +x ${ytDlpPath}`,
      { stdio: 'inherit' }
    );
    console.log('[yt-dlp] Binary ready');
  } else {
    console.log('[yt-dlp] Binary already exists at', ytDlpPath);
  }
}

function ensureDeno() {
  if (!fs.existsSync(denoPath)) {
    console.log('[deno] Downloading binary...');
    try {
      const denoDir = path.dirname(denoPath);
      const zipPath = path.join(denoDir, 'deno.zip');
      execSync(
        `curl -L https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip -o ${zipPath} && unzip -o ${zipPath} -d ${denoDir} && chmod +x ${denoPath} && rm ${zipPath}`,
        { stdio: 'inherit' }
      );
      console.log('[deno] Binary ready');
    } catch (e) {
      console.error('[deno] Failed to install:', e.message);
    }
  } else {
    console.log('[deno] Binary already exists at', denoPath);
  }
}

ensureYtDlp();
ensureDeno();

const YTDlpWrap = require('yt-dlp-wrap').default;
const ytDlp = new YTDlpWrap(ytDlpPath);

// Quality mapping for mp4 format — force H.264/AAC for universal compatibility (QuickTime, etc.)
const QUALITY_MAP = {
  '1080p': 'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=1080][vcodec^=avc1]/best[height<=1080]',
  '720p': 'bestvideo[height<=720][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=720][vcodec^=avc1]/best[height<=720]',
  '480p': 'bestvideo[height<=480][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=480][vcodec^=avc1]/best[height<=480]',
  '360p': 'bestvideo[height<=360][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=360][vcodec^=avc1]/best[height<=360]'
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
    // Build yt-dlp arguments
    const args = [url, '-o', tempPath];

    // Anti-bot detection + JS runtime workaround
    args.push('--extractor-args', 'youtube:player_client=default,tv,web');
    if (fs.existsSync(denoPath)) {
      args.push('--js-runtimes', `deno:${denoPath}`);
    }
    args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    args.push('--add-header', 'Accept-Language:en-US,en;q=0.9');
    args.push('--sleep-interval', '1');
    args.push('--no-check-certificates');

    // Copy cookies from read-only secret to writable tmp location (yt-dlp may try to update the file)
    const secretCookiesPath = '/etc/secrets/cookies.txt';
    const tmpCookiesPath = path.join(os.tmpdir(), 'yt-cookies.txt');
    if (fs.existsSync(secretCookiesPath)) {
      fs.copyFileSync(secretCookiesPath, tmpCookiesPath);
      args.push('--cookies', tmpCookiesPath);
    }

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
      ytDlpProcess = ytDlp.exec(args);

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
