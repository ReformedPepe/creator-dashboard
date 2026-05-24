// YouTubeDownloaderPage — pobieranie filmów i audio z YouTube
import { useState, useEffect } from 'react';
import { Download, Loader2, X, Search, Clock, Eye } from 'lucide-react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { validateYouTubeUrl } from '../utils/youtubeUrlValidator';

const ALL_QUALITIES = ['1080p', '720p', '480p', '360p'];

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViews(count) {
  if (!count && count !== 0) return '';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function formatMs(ms) {
  if (ms == null) return '–';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function YouTubeDownloaderPage() {
  const [url, setUrl] = useState('');
  const [urlValid, setUrlValid] = useState(false);
  const [urlError, setUrlError] = useState(null);

  // Video info state
  const [videoInfo, setVideoInfo] = useState(null);
  const [fetchingInfo, setFetchingInfo] = useState(false);

  // Download state
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('720p');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState('idle'); // 'idle' | 'preparing' | 'extracting' | 'server-download' | 'merging' | 'transferring' | 'done'
  const [downloadError, setDownloadError] = useState(null);
  const [lastTimings, setLastTimings] = useState(null); // { totalMs, phases: {extracting, downloading, merging, transferring} }

  // Debounced URL validation (300ms)
  useEffect(() => {
    if (url.trim() === '') {
      setUrlValid(false);
      setUrlError(null);
      return;
    }

    const timer = setTimeout(() => {
      const result = validateYouTubeUrl(url);
      setUrlValid(result.valid);
      setUrlError(result.valid ? null : 'Nieprawidłowy link YouTube');
    }, 300);

    return () => clearTimeout(timer);
  }, [url]);

  // When URL changes, reset video info (user must search again)
  useEffect(() => {
    setVideoInfo(null);
    setDownloadError(null);
  }, [url]);

  // Reset quality to highest available when video info changes
  useEffect(() => {
    if (videoInfo && videoInfo.availableQualities.length > 0) {
      // Pick the highest available <= 720p as default, or highest available if all are below 720p
      const preferred = videoInfo.availableQualities.includes('720p') ? '720p' : videoInfo.availableQualities[0];
      setQuality(preferred);
    }
  }, [videoInfo]);

  const handleSearch = async () => {
    if (!urlValid || fetchingInfo) return;

    setFetchingInfo(true);
    setDownloadError(null);
    setVideoInfo(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/tools/youtube-info`,
        { url },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 35000,
        }
      );

      setVideoInfo(response.data);
    } catch (err) {
      let message = 'Nie udało się pobrać informacji o filmie';
      if (err.response?.data?.error) {
        message = err.response.data.error;
      } else if (!err.response) {
        message = 'Błąd połączenia z serwerem. Spróbuj ponownie.';
      }
      setDownloadError(message);
    } finally {
      setFetchingInfo(false);
    }
  };

  const handleFormatChange = (newFormat) => {
    setFormat(newFormat);
    if (newFormat === 'mp4' && videoInfo) {
      const preferred = videoInfo.availableQualities.includes('720p') ? '720p' : videoInfo.availableQualities[0];
      setQuality(preferred || '720p');
    }
  };

  const handleDownload = async () => {
    if (!videoInfo || loading) return;

    setLoading(true);
    setProgress(0);
    setProgressPhase('preparing');
    setDownloadError(null);
    setLastTimings(null);

    // Timing
    const tStart = performance.now();
    const tEnter = (label) => {
      const ms = Math.round(performance.now() - tStart);
      console.log(`[yt-dl client] +${ms}ms ${label}`);
      return ms;
    };
    const phaseStart = {}; // phase name -> ms timestamp when entered
    const phaseEnd = {};   // phase name -> ms timestamp when left
    let lastPhase = 'preparing';
    phaseStart[lastPhase] = 0;

    const enterPhase = (newPhase) => {
      if (newPhase === lastPhase) return;
      const now = Math.round(performance.now() - tStart);
      phaseEnd[lastPhase] = now;
      phaseStart[newPhase] = now;
      console.log(`[yt-dl client] +${now}ms phase: ${lastPhase} -> ${newPhase}`);
      lastPhase = newPhase;
    };

    tEnter('start (Pobierz clicked)');

    // Generate jobId for progress tracking
    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Open SSE connection for backend progress
    const sseUrl = `${import.meta.env.VITE_API_URL}/api/tools/youtube-progress/${jobId}`;
    let eventSource = null;
    let sseClosedByUs = false;
    const closeSse = () => {
      if (eventSource && !sseClosedByUs) {
        sseClosedByUs = true;
        try { eventSource.close(); } catch {}
      }
    };
    try {
      eventSource = new EventSource(sseUrl);
      eventSource.onopen = () => tEnter('SSE connected');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.phase === 'done' || data.status === 'done') {
            closeSse();
            return;
          }
          if (data.phase === 'extracting') {
            enterPhase('extracting');
            setProgressPhase('extracting');
            setProgress(0);
          } else if (data.phase === 'downloading') {
            enterPhase('server-download');
            setProgressPhase('server-download');
            setProgress(Math.min(Math.round(data.percent || 0), 95));
          } else if (data.phase === 'merging') {
            enterPhase('merging');
            setProgressPhase('merging');
            setProgress(95);
          } else if (data.phase === 'transferring') {
            enterPhase('transferring');
            setProgressPhase('transferring');
          }
        } catch {}
      };
      eventSource.onerror = (e) => {
        // EventSource auto-reconnects on disconnect; this fires on every reconnect attempt.
        // Only log if we haven't intentionally closed it yet — and skip if we're already
        // transferring (axios takes over progress reporting from here).
        if (sseClosedByUs) return;
        if (lastPhase === 'transferring' || lastPhase === 'done') return;
        // Don't spam — SSE errors during normal operation are typically transient
        // (Render keeps idle connections only briefly).
      };
    } catch (e) {
      console.warn('[yt-dl client] EventSource not available', e);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      tEnter('auth token ready, sending POST');

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/tools/youtube-download`,
        { url, format, quality, jobId },
        {
          responseType: 'blob',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
              if (progressPhase !== 'transferring') {
                enterPhase('transferring');
                setProgressPhase('transferring');
              }
              setProgress(percent);
            }
          },
        }
      );

      tEnter('POST response received (full file in browser)');
      enterPhase('done');

      const disposition = response.headers['content-disposition'];
      let filename = `download.${format}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }
      if (videoInfo.title) {
        const safeName = videoInfo.title.replace(/[/\\:*?"<>|]/g, '').slice(0, 100);
        filename = `${safeName}.${format}`;
      }

      const objectUrl = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      const totalMs = tEnter('done (file saved)');
      setProgress(100);
      setProgressPhase('done');

      // Compute phase durations
      const phases = {};
      for (const p of Object.keys(phaseStart)) {
        const end = phaseEnd[p] ?? totalMs;
        phases[p] = end - phaseStart[p];
      }
      console.log('[yt-dl client] Total:', totalMs, 'ms');
      console.log('[yt-dl client] Phases:', phases);
      setLastTimings({
        totalMs,
        fileSize: response.data?.size || 0,
        phases
      });
    } catch (err) {
      let message = 'Wystąpił błąd podczas pobierania. Spróbuj ponownie.';

      if (err.response) {
        const status = err.response.status;
        try {
          let parsed = {};
          if (err.response.data instanceof Blob) {
            const text = await err.response.data.text();
            parsed = JSON.parse(text);
          } else {
            parsed = err.response.data;
          }
          if (status === 429) {
            const minutes = parsed.retryAfterMinutes || '?';
            message = `Przekroczono limit 10 pobrań/h. Spróbuj za ${minutes} minut.`;
          } else if (status === 400) {
            message = parsed.error || 'Film jest niedostępny lub prywatny';
          } else if (status === 408) {
            message = 'Przekroczono limit czasu pobierania';
          }
        } catch {
          // JSON parse failed, use default message
        }
      } else if (!err.response) {
        message = 'Błąd połączenia z serwerem. Spróbuj ponownie.';
      }

      setDownloadError(message);
      setProgressPhase('idle');
      const errMs = tEnter(`error: ${message}`);
      console.warn('[yt-dl client] Failed after', errMs, 'ms');
    } finally {
      closeSse();
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUrl('');
    setVideoInfo(null);
    setDownloadError(null);
    setProgress(0);
    setLastTimings(null);
  };

  // Filter standard qualities by what's actually available
  const availableQualities = videoInfo
    ? ALL_QUALITIES.filter(q => videoInfo.availableQualities.includes(q))
    : ALL_QUALITIES;

  return (
    <div className="space-y-6">
      <section>
        {/* Header */}
        <div className="mb-3">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">
            NARZĘDZIE ONLINE
          </span>
        </div>

        <div className="rounded-[12px] border border-[#1E1E1E] bg-[#111111] p-4 md:p-5 space-y-6">
          {/* URL Input + Search button */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && urlValid && !fetchingInfo && !loading) {
                    handleSearch();
                  }
                }}
                placeholder="Wklej link do filmu YouTube"
                maxLength={200}
                disabled={fetchingInfo || loading}
                className="flex-1 px-4 py-3 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#444] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={!urlValid || fetchingInfo || loading}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-white transition-all duration-200 disabled:opacity-[0.4] disabled:cursor-not-allowed cursor-pointer bg-[#E53935] hover:bg-[#EF5350] sm:w-32"
              >
                {fetchingInfo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Znajdź
                  </>
                )}
              </button>
            </div>
            {urlError && url.trim() !== '' && (
              <p className="text-sm text-red-500">{urlError}</p>
            )}
          </div>

          {/* Error Banner */}
          {downloadError && (
            <div className="flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-400">{downloadError}</p>
              <button
                onClick={() => setDownloadError(null)}
                className="ml-3 p-1 rounded-md hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors duration-200 cursor-pointer shrink-0"
                aria-label="Zamknij komunikat błędu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Video Info Card */}
          {videoInfo && (
            <div className="space-y-4 rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {videoInfo.thumbnail && (
                  <div className="relative shrink-0 sm:w-48 rounded-lg overflow-hidden bg-[#0A0A0A]">
                    <img
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      className="w-full h-auto aspect-video object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    {videoInfo.duration && (
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[11px] font-medium">
                        {formatDuration(videoInfo.duration)}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <h3 className="text-sm font-semibold text-white line-clamp-2">{videoInfo.title}</h3>
                  {videoInfo.uploader && (
                    <p className="text-xs text-[#A1A1AA]">{videoInfo.uploader}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-[#888]">
                    {videoInfo.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(videoInfo.duration)}
                      </span>
                    )}
                    {videoInfo.viewCount !== null && (
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {formatViews(videoInfo.viewCount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Format Selector */}
              <div className="space-y-2">
                <label className="text-sm text-[#A1A1AA]">Format</label>
                <div className="flex gap-0">
                  <button
                    type="button"
                    onClick={() => handleFormatChange('mp4')}
                    disabled={loading}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-l-lg border transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed ${
                      format === 'mp4'
                        ? 'bg-[#E53935] border-[#E53935] text-white'
                        : 'bg-[#0A0A0A] border-[#2A2A2A] text-[#A1A1AA] hover:bg-[#1A1A1A]'
                    }`}
                  >
                    MP4 (wideo)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormatChange('mp3')}
                    disabled={loading}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-r-lg border border-l-0 transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed ${
                      format === 'mp3'
                        ? 'bg-[#E53935] border-[#E53935] text-white'
                        : 'bg-[#0A0A0A] border-[#2A2A2A] text-[#A1A1AA] hover:bg-[#1A1A1A]'
                    }`}
                  >
                    MP3 (audio)
                  </button>
                </div>
              </div>

              {/* Quality Selector — visible only for MP4 */}
              {format === 'mp4' && availableQualities.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm text-[#A1A1AA]">Jakość</label>
                  <div className="flex gap-0">
                    {availableQualities.map((q, index) => {
                      const isFirst = index === 0;
                      const isLast = index === availableQualities.length - 1;
                      const roundedClass = isFirst && isLast
                        ? 'rounded-lg'
                        : isFirst
                          ? 'rounded-l-lg'
                          : isLast
                            ? 'rounded-r-lg'
                            : '';
                      const borderClass = index > 0 ? 'border-l-0' : '';

                      return (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuality(q)}
                          disabled={loading}
                          className={`flex-1 px-3 py-2.5 text-sm font-medium border transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed ${roundedClass} ${borderClass} ${
                            quality === q
                              ? 'bg-[#E53935] border-[#E53935] text-white'
                              : 'bg-[#0A0A0A] border-[#2A2A2A] text-[#A1A1AA] hover:bg-[#1A1A1A]'
                          }`}
                        >
                          {q}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Download Button */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-white transition-all duration-200 disabled:opacity-[0.4] disabled:cursor-not-allowed cursor-pointer bg-[#E53935] hover:bg-[#EF5350]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Pobieranie... {progress > 0 && `${progress}%`}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Pobierz
                  </>
                )}
              </button>

              {/* Progress Bar */}
              {loading && (
                <div className="space-y-2">
                  <div className="w-full h-2 rounded-full bg-[#2A2A2A] overflow-hidden relative">
                    {progress > 0 ? (
                      <div
                        className="h-full rounded-full bg-[#E53935] transition-all duration-200 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    ) : (
                      <div className="absolute top-0 left-0 h-full w-1/3 rounded-full bg-[#E53935] animate-progress-indeterminate" />
                    )}
                  </div>
                  <p className="text-xs text-[#888] text-center">
                    {progressPhase === 'extracting' && 'Łączenie z YouTube...'}
                    {progressPhase === 'server-download' && `Pobieranie z YouTube — ${progress}%`}
                    {progressPhase === 'merging' && 'Łączenie video i audio...'}
                    {progressPhase === 'transferring' && `Pobieranie do przeglądarki — ${progress}%`}
                    {progressPhase === 'preparing' && 'Przygotowywanie...'}
                  </p>
                </div>
              )}

              {/* Reset/new search */}
              {!loading && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-[#888] hover:text-white transition-colors cursor-pointer"
                >
                  ← Wybierz inny film
                </button>
              )}

              {/* Last download timings — diagnostic widget */}
              {!loading && lastTimings && (
                <div className="rounded-lg border border-[#1E1E1E] bg-[#0F0F0F] p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#A1A1AA] font-medium">Pobrano w {formatMs(lastTimings.totalMs)}</span>
                    {lastTimings.fileSize > 0 && (
                      <span className="text-[#666]">{formatBytes(lastTimings.fileSize)}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#666] space-y-0.5 font-mono">
                    {lastTimings.phases.extracting !== undefined && (
                      <div>łączenie z YouTube: {formatMs(lastTimings.phases.extracting)}</div>
                    )}
                    {lastTimings.phases['server-download'] !== undefined && (
                      <div>pobieranie z YouTube: {formatMs(lastTimings.phases['server-download'])}</div>
                    )}
                    {lastTimings.phases.merging !== undefined && (
                      <div>łączenie audio+video: {formatMs(lastTimings.phases.merging)}</div>
                    )}
                    {lastTimings.phases.transferring !== undefined && (
                      <div>transfer do przeglądarki: {formatMs(lastTimings.phases.transferring)}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
