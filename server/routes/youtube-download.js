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

// Quality mapping for mp4 format.
// 1080p — needs merge (video+audio separate streams), goes through tmp file.
// 720p / 480p / 360p — try single-stream first (instant streaming), fallback to merge.
const QUALITY_MAP_MERGED = {
  '1080p': 'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]',
  '720p':  'bestvideo[height<=720][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
  '480p':  'bestvideo[height<=480][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
  '360p':  'bestvideo[height<=360][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]'
};

// Single-stream format strings — pick a single mp4 file with both video+audio.
// YouTube provides these for <=720p typically, sometimes also for 1080p.
// If unavailable, the route falls back to merged mode.
const QUALITY_MAP_SINGLE = {
  '1080p': 'best[ext=mp4][height<=1080][vcodec^=avc1][acodec!=none]/best[ext=mp4][height<=1080][acodec!=none]',
  '720p': 'best[ext=mp4][height<=720][vcodec^=avc1][acodec!=none]/best[ext=mp4][height<=720][acodec!=none]',
  '480p': 'best[ext=mp4][height<=480][vcodec^=avc1][acodec!=none]/best[ext=mp4][height<=480][acodec!=none]',
  '360p': 'best[ext=mp4][height<=360][vcodec^=avc1][acodec!=none]/best[ext=mp4][height<=360][acodec!=none]'
};

// Build common yt-dlp arguments (auth, anti-bot, JS runtime, cookies)
function buildCommonArgs() {
  const args = [];
  args.push('--extractor-args', 'youtube:player_client=default');
  if (fs.existsSync(denoPath)) {
    args.push('--js-runtimes', `deno:${denoPath}`);
  }
  args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  args.push('--add-header', 'Accept-Language:en-US,en;q=0.9');
  args.push('--no-check-certificates');

  const secretCookiesPath = '/etc/secrets/cookies.txt';
  const tmpCookiesPath = path.join(os.tmpdir(), 'yt-cookies.txt');
  if (fs.existsSync(secretCookiesPath)) {
    try {
      fs.copyFileSync(secretCookiesPath, tmpCookiesPath);
      args.push('--cookies', tmpCookiesPath);
    } catch {}
  }

  return args;
}

// --- Progress tracking via SSE ---
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
    try { sub.write(`data: ${payload}\n\n`); } catch {}
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

function parseYtDlpLine(line) {
  if (line.includes('[Merger]') || line.includes('[ExtractAudio]')) {
    return { phase: 'merging', percent: 95 };
  }
  const m = line.match(/\[download\]\s+(\d+\.?\d*)%\s+of/);
  if (m) {
    const percent = parseFloat(m[1]);
    const frag = line.match(/\(frag\s+(\d+)\/(\d+)\)/);
    const update = { phase: 'downloading', percent };
    if (frag) {
      update.fragment = parseInt(frag[1], 10);
      update.totalFragments = parseInt(frag[2], 10);
    }
    return update;
  }
  if (line.includes('[youtube]') && line.includes('Extracting URL')) {
    return { phase: 'extracting', percent: 0 };
  }
  return null;
}

// SSE router (mounted before auth in server/index.js)
const progressSseRouter = express.Router();
progressSseRouter.get('/youtube-progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  console.log(`[youtube-progress] SSE connect jobId=${jobId}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  let job = progressJobs.get(jobId);
  if (!job) {
    job = { phase: 'pending', percent: 0, status: 'pending', subscribers: new Set() };
    progressJobs.set(jobId, job);
  }
  job.subscribers.add(res);

  res.write(`data: ${JSON.stringify({
    phase: job.phase,
    percent: job.percent,
    fragment: job.fragment,
    totalFragments: job.totalFragments,
    status: job.status
  })}\n\n`);

  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch {}
  }, 15000);

  req.on('close', () => {
    console.log(`[youtube-progress] SSE close jobId=${jobId}`);
    clearInterval(keepAlive);
    if (job) job.subscribers.delete(res);
  });
});

// --- Info endpoint (oEmbed, fast) ---
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

// --- Helpers for download endpoint ---

function attachYtDlpProgressLogger(ytDlpProcess, jobId, log) {
  if (!ytDlpProcess.ytDlpProcess) return;
  let firstStdout = true;
  let firstStderr = true;
  let stdoutBuffer = '';

  ytDlpProcess.ytDlpProcess.stdout?.on('data', (chunk) => {
    if (firstStdout) { log('yt-dlp first stdout'); firstStdout = false; }
    const text = chunk.toString();
    process.stdout.write(`[yt-dlp:stdout] ${text}`);
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

// MERGED MODE — downloads to tmp file, then streams to client (used for 1080p).
async function downloadMergedMode({ url, format, quality, jobId, res, log }) {
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
      args.push('-f', QUALITY_MAP_MERGED[quality] || QUALITY_MAP_MERGED['720p']);
      args.push('--merge-output-format', 'mp4');
    } else {
      args.push('-x', '--audio-format', 'mp3');
    }

    log('yt-dlp spawn (merged mode)');
    const downloadPromise = new Promise((resolve, reject) => {
      ytDlpProcess = ytDlp.exec(args);
      attachYtDlpProgressLogger(ytDlpProcess, jobId, log);
      ytDlpProcess.on('close', (code) => {
        if (timedOut) return;
        log(`yt-dlp close code=${code}`);
        if (code === 0) resolve();
        else reject(new Error(`yt-dlp exited with code ${code}`));
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
      throw new Error('Plik nie został pobrany');
    }

    if (jobId) publishProgress(jobId, { phase: 'transferring', percent: 100, status: 'transferring' });

    const filename = `download_${fileId}.${ext}`;
    const contentType = format === 'mp4' ? 'video/mp4' : 'audio/mpeg';
    const fileSize = fs.statSync(tempPath).size;
    log(`stream start size=${(fileSize / 1024 / 1024).toFixed(1)}MB (merged)`);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(fileSize));

    const fileStream = fs.createReadStream(tempPath);
    fileStream.pipe(res);

    await new Promise((resolve, reject) => {
      fileStream.on('end', resolve);
      fileStream.on('error', reject);
    });
    log(`done (merged)`);
  } finally {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }
}

// STREAM MODE — single-stream download piped directly stdout → res.
// Client receives bytes while yt-dlp is still fetching from YouTube.
// Works only when YouTube provides a single mp4 file with both video+audio.
// If yt-dlp fails before writing to stdout, throws Error('NO_SINGLE_STREAM') for fallback.
async function downloadStreamMode({ url, format, quality, jobId, res, log }) {
  const ext = format === 'mp4' ? 'mp4' : 'mp3';

  let ytDlpProcess = null;
  let timeoutId = null;
  let timedOut = false;
  let headersSent = false;
  let stdoutStarted = false;

  try {
    // -o - means write to stdout
    const args = [url, '-o', '-', ...buildCommonArgs()];
    args.push('--concurrent-fragments', '1'); // stdout requires sequential
    args.push('--newline');
    args.push('--progress');
    // CRITICAL: progress goes to stderr in stdout-pipe mode (otherwise it'd corrupt the stream)
    args.push('--no-warnings');

    if (format === 'mp4') {
      args.push('-f', QUALITY_MAP_SINGLE[quality] || QUALITY_MAP_SINGLE['720p']);
    } else {
      // mp3 stream mode — extract bestaudio and let ffmpeg pipe to stdout
      args.push('-f', 'bestaudio[ext=m4a]/bestaudio');
      args.push('-x', '--audio-format', 'mp3');
    }

    log('yt-dlp spawn (stream mode)');

    const filename = `download_${crypto.randomUUID()}.${ext}`;
    const contentType = format === 'mp4' ? 'video/mp4' : 'audio/mpeg';

    if (jobId) publishProgress(jobId, { phase: 'transferring', percent: 0, status: 'transferring' });

    const downloadPromise = new Promise((resolve, reject) => {
      ytDlpProcess = ytDlp.exec(args);
      const child = ytDlpProcess.ytDlpProcess;
      let stderrCollected = '';

      if (child) {
        // stdout → res (lazy: send headers only on first byte, so we can fallback if yt-dlp errors first)
        child.stdout.on('data', (chunk) => {
          if (!stdoutStarted) {
            stdoutStarted = true;
            // Now we know yt-dlp is producing output, send headers and start piping
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Transfer-Encoding', 'chunked');
            headersSent = true;
            log('first stdout byte, headers sent');
          }
          res.write(chunk);
        });

        // stderr → logs + progress parsing (yt-dlp writes progress to stderr in stdout-pipe mode)
        let stderrBuffer = '';
        child.stderr.on('data', (chunk) => {
          const text = chunk.toString();
          process.stderr.write(`[yt-dlp:stderr] ${text}`);
          stderrCollected += text;
          stderrBuffer += text;
          const lines = stderrBuffer.split('\n');
          stderrBuffer = lines.pop() || '';
          for (const line of lines) {
            if (jobId) {
              const update = parseYtDlpLine(line);
              if (update) publishProgress(jobId, update);
            }
          }
        });

        child.stdout.on('error', (err) => {
          log(`stdout error: ${err.message}`);
        });
      }

      ytDlpProcess.on('close', (code) => {
        if (timedOut) return;
        log(`yt-dlp close code=${code} (stream) stdoutStarted=${stdoutStarted}`);
        if (code === 0) {
          resolve();
        } else if (!stdoutStarted) {
          // Failed before producing any output — likely format not available
          // Detect "Requested format is not available" or similar
          if (
            stderrCollected.includes('Requested format is not available') ||
            stderrCollected.includes('No video formats found') ||
            stderrCollected.includes('Only images are available')
          ) {
            const err = new Error('NO_SINGLE_STREAM');
            err.code = 'NO_SINGLE_STREAM';
            reject(err);
          } else {
            reject(new Error(`yt-dlp exited with code ${code}`));
          }
        } else {
          reject(new Error(`yt-dlp exited with code ${code} (after streaming started)`));
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

    // Close response
    res.end();
    log(`done (stream)`);
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    if (ytDlpProcess) {
      try { ytDlpProcess.kill('SIGKILL'); } catch {}
    }
    // If headers already sent, we can't change status — just end
    if (headersSent) {
      try { res.end(); } catch {}
      throw err;
    }
    throw err;
  }
}

// Main download endpoint
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

  // Try stream mode first for all qualities + mp3 (instant start, no merge needed).
  // If single-stream format unavailable (typical for some 1080p videos), fall back to merged mode.
  const tryStreamFirst = true;

  log(`start url=${url} format=${format} quality=${quality} jobId=${jobId} mode=${tryStreamFirst ? 'stream-first' : 'merged'}`);

  try {
    if (tryStreamFirst) {
      try {
        await downloadStreamMode({ url, format, quality, jobId, res, log });
        if (jobId) closeProgressJob(jobId);
        return;
      } catch (err) {
        if (err.code === 'NO_SINGLE_STREAM' && !res.headersSent) {
          log('falling back to merged mode (no single-stream available)');
          // continue to merged mode below
        } else {
          throw err;
        }
      }
    }
    await downloadMergedMode({ url, format, quality, jobId, res, log });
    if (jobId) closeProgressJob(jobId);
  } catch (err) {
    if (jobId) {
      publishProgress(jobId, { phase: 'error', status: 'error' });
      closeProgressJob(jobId);
    }

    // If we already started streaming the response, we can't change status code.
    if (res.headersSent) {
      console.error('[youtube-download] Error after headers sent:', err.message);
      try { res.end(); } catch {}
      return;
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
  }
});

module.exports = router;
module.exports.default = router;
module.exports.progressSseRouter = progressSseRouter;
