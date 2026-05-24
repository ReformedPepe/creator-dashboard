const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const TIMEOUT_MS = 300000; // 300 seconds
const INFO_TIMEOUT_MS = 30000; // 30 seconds for metadata fetch

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

// Quality mapping for mp4 format — prefer H.264/AAC for compatibility, fallback to anything mp4-mergeable
const QUALITY_MAP = {
  '1080p': 'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]',
  '720p': 'bestvideo[height<=720][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
  '480p': 'bestvideo[height<=480][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
  '360p': 'bestvideo[height<=360][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]'
};

// Build common yt-dlp arguments (auth, anti-bot, JS runtime, cookies)
function buildCommonArgs() {
  const args = [];
  args.push('--extractor-args', 'youtube:player_client=default,tv,web');
  if (fs.existsSync(denoPath)) {
    args.push('--js-runtimes', `deno:${denoPath}`);
  }
  args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  args.push('--add-header', 'Accept-Language:en-US,en;q=0.9');
  args.push('--no-check-certificates');

  // Copy cookies from read-only secret to writable tmp location (yt-dlp may try to update the file)
  const secretCookiesPath = '/etc/secrets/cookies.txt';
  const tmpCookiesPath = path.join(os.tmpdir(), 'yt-cookies.txt');
  if (fs.existsSync(secretCookiesPath)) {
    try {
      fs.copyFileSync(secretCookiesPath, tmpCookiesPath);
      args.push('--cookies', tmpCookiesPath);
    } catch {
      // cookies optional
    }
  }

  return args;
}

// Run yt-dlp and collect stdout (used for metadata fetching)
function runYtDlpJson(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proc = ytDlp.exec(args);
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill('SIGKILL'); } catch {}
      reject(new Error('TIMEOUT'));
    }, timeoutMs);

    if (proc.ytDlpProcess) {
      // yt-dlp-wrap exposes the underlying child_process via .ytDlpProcess
      proc.ytDlpProcess.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
      proc.ytDlpProcess.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    }

    proc.on('close', (code) => {
      if (timedOut) return;
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      if (timedOut) return;
      clearTimeout(timer);
      reject(err);
    });
  });
}

// POST /youtube-info — fetch video metadata (title, thumbnail, duration, available qualities)
router.post('/youtube-info', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Brak wymaganego pola: url' });
  }

  try {
    const args = [url, '--dump-single-json', '--no-warnings', ...buildCommonArgs()];
    const stdout = await runYtDlpJson(args, INFO_TIMEOUT_MS);

    let info;
    try {
      info = JSON.parse(stdout);
    } catch (e) {
      console.error('[youtube-info] Failed to parse JSON:', e.message);
      return res.status(500).json({ error: 'Nie udało się odczytać informacji o filmie' });
    }

    // Extract list of available video heights (for quality selector)
    const heights = new Set();
    if (Array.isArray(info.formats)) {
      for (const fmt of info.formats) {
        if (fmt.vcodec && fmt.vcodec !== 'none' && typeof fmt.height === 'number') {
          heights.add(fmt.height);
        }
      }
    }
    // Map to standard buckets we offer
    const standardQualities = [1080, 720, 480, 360];
    const maxAvailable = Math.max(...heights, 0);
    const availableQualities = standardQualities
      .filter(h => h <= maxAvailable)
      .map(h => `${h}p`);

    // If video has higher than 1080p available, still include 1080p
    if (maxAvailable >= 1080 && !availableQualities.includes('1080p')) {
      availableQualities.unshift('1080p');
    }
    // Always include at least 360p as fallback
    if (availableQualities.length === 0) {
      availableQualities.push('360p');
    }

    return res.json({
      title: info.title || 'Bez tytułu',
      thumbnail: info.thumbnail || (Array.isArray(info.thumbnails) && info.thumbnails.length > 0 ? info.thumbnails[info.thumbnails.length - 1].url : null),
      duration: typeof info.duration === 'number' ? info.duration : null,
      uploader: info.uploader || info.channel || null,
      viewCount: typeof info.view_count === 'number' ? info.view_count : null,
      availableQualities,
      maxHeight: maxAvailable || null
    });
  } catch (err) {
    if (err.message === 'TIMEOUT') {
      return res.status(408).json({ error: 'Przekroczono limit czasu pobierania informacji' });
    }
    const errorMsg = err.message || '';
    if (
      errorMsg.includes('Video unavailable') ||
      errorMsg.includes('Private video') ||
      errorMsg.includes('is not a valid URL') ||
      errorMsg.includes('Unsupported URL') ||
      errorMsg.includes('Sign in')
    ) {
      return res.status(400).json({ error: 'Film jest niedostępny lub link jest nieprawidłowy' });
    }
    console.error('[youtube-info] Error:', errorMsg);
    return res.status(500).json({ error: 'Nie udało się pobrać informacji o filmie' });
  }
});

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
    const args = [url, '-o', tempPath, ...buildCommonArgs()];
    args.push('--sleep-interval', '1');

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
    const fileSize = fs.statSync(tempPath).size;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(fileSize));

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
