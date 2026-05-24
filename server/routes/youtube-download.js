const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
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
  // Single player_client — default works with Deno, fewer client probes = faster start
  args.push('--extractor-args', 'youtube:player_client=default');
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

// --- Progress tracking via SSE ---
// Map: jobId -> { phase, percent, fragment?, totalFragments?, status, subscribers: Set<res> }
const progressJobs = new Map();

function publishProgress(jobId, update) {
  const job = progressJobs.get(jobId);
  if (!job) return;
  Object.assign(job, update);
  const payload = JSON.stringify({
    phase: job.phase,
    percent: job.percent,
    fragment: job.fragment,
    totalFragments: job.totalFragments,
    status: job.status
  });
  for (const sub of job.subscribers) {
    try {
      sub.write(`data: ${payload}\n\n`);
    } catch {
      // ignore broken subscribers
    }
  }
}

function closeProgressJob(jobId) {
  const job = progressJobs.get(jobId);
  if (!job) return;
  for (const sub of job.subscribers) {
    try {
      sub.write(`data: ${JSON.stringify({ phase: 'done', percent: 100, status: 'done' })}\n\n`);
      sub.end();
    } catch {}
  }
  progressJobs.delete(jobId);
}

// Parse yt-dlp output line for progress info.
// Examples:
//   [download]   1.2% of    50.4MiB at  2.10MiB/s ETA 00:23
//   [download]   1.2% of ~50.4MiB at  2.10MiB/s ETA 00:23 (frag 3/30)
//   [download] Destination: /tmp/yt-xxx.f140.m4a
//   [Merger] Merging formats into "/tmp/yt-xxx.mp4"
function parseYtDlpLine(line) {
  // Merger phase
  if (line.includes('[Merger]')) {
    return { phase: 'merging', percent: 95 };
  }
  // ExtractAudio (mp3)
  if (line.includes('[ExtractAudio]')) {
    return { phase: 'merging', percent: 95 };
  }
  // Download progress
  const m = line.match(/\[download\]\s+(\d+\.?\d*)%\s+of/);
  if (m) {
    const percent = parseFloat(m[1]);
    // Detect fragment counter
    const frag = line.match(/\(frag\s+(\d+)\/(\d+)\)/);
    const update = { phase: 'downloading', percent };
    if (frag) {
      update.fragment = parseInt(frag[1], 10);
      update.totalFragments = parseInt(frag[2], 10);
    }
    return update;
  }
  // Metadata extraction
  if (line.includes('[youtube]') && line.includes('Extracting URL')) {
    return { phase: 'extracting', percent: 0 };
  }
  return null;
}

// GET /youtube-progress/:jobId — SSE stream of download progress
router.get('/youtube-progress/:jobId', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders?.();

  let job = progressJobs.get(jobId);
  if (!job) {
    // Job may not be registered yet — create a placeholder so download endpoint can attach
    job = {
      phase: 'pending',
      percent: 0,
      status: 'pending',
      subscribers: new Set()
    };
    progressJobs.set(jobId, job);
  }
  job.subscribers.add(res);

  // Send current state immediately
  res.write(`data: ${JSON.stringify({
    phase: job.phase,
    percent: job.percent,
    fragment: job.fragment,
    totalFragments: job.totalFragments,
    status: job.status
  })}\n\n`);

  // Keep-alive comments every 15s
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch {}
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    if (job) job.subscribers.delete(res);
  });
});

// POST /youtube-info — fetch video metadata via YouTube oEmbed (fast, ~200ms)
router.post('/youtube-info', async (req, res) => {
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
    console.error('[youtube-info] Error:', err.message);
    return res.status(500).json({ error: 'Nie udało się pobrać informacji o filmie' });
  }
});

router.post('/youtube-download', async (req, res) => {
  const { url, format, quality, jobId } = req.body;
  const tStart = Date.now();
  const log = (label) => console.log(`[youtube-download] +${Date.now() - tStart}ms ${label}`);

  if (!url || !format) {
    return res.status(400).json({ error: 'Brak wymaganych pól: url, format' });
  }
  if (format !== 'mp4' && format !== 'mp3') {
    return res.status(400).json({ error: 'Brak wymaganych pól: url, format' });
  }

  // Register progress job (if jobId provided)
  if (jobId) {
    let job = progressJobs.get(jobId);
    if (!job) {
      job = { phase: 'extracting', percent: 0, status: 'running', subscribers: new Set() };
      progressJobs.set(jobId, job);
    } else {
      job.phase = 'extracting';
      job.percent = 0;
      job.status = 'running';
    }
    publishProgress(jobId, { phase: 'extracting', percent: 0, status: 'running' });
  }

  log(`start url=${url} format=${format} quality=${quality} jobId=${jobId}`);

  const ext = format === 'mp4' ? 'mp4' : 'mp3';
  const fileId = crypto.randomUUID();
  const tempPath = path.join(os.tmpdir(), `yt-${fileId}.${ext}`);

  let ytDlpProcess = null;
  let timeoutId = null;
  let timedOut = false;

  try {
    const args = [url, '-o', tempPath, ...buildCommonArgs()];
    args.push('--concurrent-fragments', '4');
    args.push('--newline');
    args.push('--progress');

    if (format === 'mp4') {
      const formatStr = QUALITY_MAP[quality] || QUALITY_MAP['720p'];
      args.push('-f', formatStr);
      args.push('--merge-output-format', 'mp4');
    } else {
      args.push('-x', '--audio-format', 'mp3');
    }

    log('yt-dlp spawn');
    const downloadPromise = new Promise((resolve, reject) => {
      ytDlpProcess = ytDlp.exec(args);

      if (ytDlpProcess.ytDlpProcess) {
        let firstStdout = true;
        let firstStderr = true;
        let stdoutBuffer = '';

        ytDlpProcess.ytDlpProcess.stdout?.on('data', (chunk) => {
          if (firstStdout) { log('yt-dlp first stdout'); firstStdout = false; }
          const text = chunk.toString();
          process.stdout.write(`[yt-dlp:stdout] ${text}`);

          // Parse line by line for progress
          stdoutBuffer += text;
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() || '';
          for (const line of lines) {
            if (jobId) {
              const update = parseYtDlpLine(line);
              if (update) publishProgress(jobId, update);
            }
          }
        });

        ytDlpProcess.ytDlpProcess.stderr?.on('data', (chunk) => {
          if (firstStderr) { log('yt-dlp first stderr'); firstStderr = false; }
          process.stderr.write(`[yt-dlp:stderr] ${chunk.toString()}`);
        });
      }

      ytDlpProcess.on('close', (code) => {
        if (timedOut) return;
        log(`yt-dlp close code=${code}`);
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
        if (ytDlpProcess) ytDlpProcess.kill('SIGKILL');
        reject(new Error('TIMEOUT'));
      }, TIMEOUT_MS);
    });

    await Promise.race([downloadPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);

    if (!fs.existsSync(tempPath)) {
      if (jobId) publishProgress(jobId, { phase: 'error', status: 'error' });
      return res.status(400).json({ error: 'Film jest niedostępny lub link jest nieprawidłowy' });
    }

    if (jobId) publishProgress(jobId, { phase: 'transferring', percent: 100, status: 'transferring' });

    const filename = `download_${fileId}.${ext}`;
    const contentType = format === 'mp4' ? 'video/mp4' : 'audio/mpeg';
    const fileSize = fs.statSync(tempPath).size;
    log(`stream start size=${(fileSize / 1024 / 1024).toFixed(1)}MB`);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(fileSize));

    const fileStream = fs.createReadStream(tempPath);
    fileStream.pipe(res);

    await new Promise((resolve, reject) => {
      fileStream.on('end', resolve);
      fileStream.on('error', reject);
    });
    log(`done`);

    if (jobId) closeProgressJob(jobId);
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    if (jobId) {
      publishProgress(jobId, { phase: 'error', status: 'error' });
      closeProgressJob(jobId);
    }

    if (err.message === 'TIMEOUT') {
      return res.status(408).json({ error: 'Przekroczono limit czasu pobierania' });
    }

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
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
});

module.exports = router;
