// YouTubeDownloaderCobaltPage — wersja v2 oparta o cobalt API (osobny serwer na Railway)
import { useState, useEffect } from 'react';
import { Download, Loader2, X, Search, Sparkles } from 'lucide-react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { validateYouTubeUrl } from '../utils/youtubeUrlValidator';

const ALL_QUALITIES = ['1080p', '720p', '480p', '360p'];

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

export default function YouTubeDownloaderCobaltPage() {
  const [url, setUrl] = useState('');
  const [urlValid, setUrlValid] = useState(false);
  const [urlError, setUrlError] = useState(null);

  const [videoInfo, setVideoInfo] = useState(null);
  const [fetchingInfo, setFetchingInfo] = useState(false);

  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('1080p');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState('idle');
  const [downloadError, setDownloadError] = useState(null);
  const [lastTimings, setLastTimings] = useState(null);

  // Debounced URL validation
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

  useEffect(() => {
    setVideoInfo(null);
    setDownloadError(null);
  }, [url]);

  const handleSearch = async () => {
    if (!urlValid || fetchingInfo) return;
    setFetchingInfo(true);
    setDownloadError(null);
    setVideoInfo(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/tools/cobalt-info`,
        { url },
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 35000,
        }
      );
      setVideoInfo(response.data);
    } catch (err) {
      let message = 'Nie udało się pobrać informacji o filmie';
      if (err.response?.data?.error) message = err.response.data.error;
      else if (!err.response) message = 'Błąd połączenia z serwerem. Spróbuj ponownie.';
      setDownloadError(message);
    } finally {
      setFetchingInfo(false);
    }
  };

  const handleFormatChange = (newFormat) => {
    setFormat(newFormat);
    if (newFormat === 'mp4') setQuality('1080p');
  };

  const handleDownload = async () => {
    if (!videoInfo || loading) return;
    setLoading(true);
    setProgress(0);
    setProgressPhase('preparing');
    setDownloadError(null);
    setLastTimings(null);

    const tStart = performance.now();
    const tEnter = (label) => {
      const ms = Math.round(performance.now() - tStart);
      console.log(`[cobalt client] +${ms}ms ${label}`);
      return ms;
    };

    tEnter('start (Pobierz clicked)');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      tEnter('auth token ready, sending POST');

      setProgressPhase('extracting');

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/tools/cobalt-download`,
        { url, format, quality },
        {
          responseType: 'blob',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 0, // no client-side timeout, let server enforce
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
              if (progressPhase !== 'transferring') setProgressPhase('transferring');
              setProgress(percent);
            }
          },
        }
      );

      tEnter('POST response received');

      const disposition = response.headers['content-disposition'];
      let filename = `download.${format}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      if (videoInfo.title && !disposition) {
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
      setLastTimings({
        totalMs,
        fileSize: response.data?.size || 0
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
          } else if (parsed.error) {
            message = parsed.error;
          }
        } catch {}
      } else if (!err.response) {
        message = 'Błąd połączenia z serwerem. Spróbuj ponownie.';
      }
      setDownloadError(message);
      setProgressPhase('idle');
      tEnter(`error: ${message}`);
    } finally {
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

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#E53935]" />
          <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">
            NARZĘDZIE ONLINE • COBALT
          </span>
        </div>

        <div className="rounded-[12px] border border-[#1E1E1E] bg-[#111111] p-4 md:p-5 space-y-6">
          {/* Info badge */}
          <div role="status" className="flex items-center gap-2 text-[11px] text-[#666]">
            <Sparkles className="h-3.5 w-3.5 text-[#E53935] shrink-0" aria-hidden="true" />
            <span>Wersja eksperymentalna oparta o Cobalt API (Railway). Porównaj prędkość z Pobieracz YT.</span>
          </div>

          {/* URL Input + Search */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && urlValid && !fetchingInfo && !loading) handleSearch();
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
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <h3 className="text-sm font-semibold text-white line-clamp-2">{videoInfo.title}</h3>
                  {videoInfo.uploader && (
                    <p className="text-xs text-[#A1A1AA]">{videoInfo.uploader}</p>
                  )}
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

              {/* Quality Selector */}
              {format === 'mp4' && (
                <div className="space-y-2">
                  <label className="text-sm text-[#A1A1AA]">Jakość</label>
                  <div className="flex gap-0">
                    {ALL_QUALITIES.map((q, index) => {
                      const isFirst = index === 0;
                      const isLast = index === ALL_QUALITIES.length - 1;
                      const roundedClass = isFirst ? 'rounded-l-lg' : isLast ? 'rounded-r-lg' : '';
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
                    Pobierz przez Cobalt
                  </>
                )}
              </button>

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
                    {progressPhase === 'extracting' && 'Cobalt przygotowuje plik...'}
                    {progressPhase === 'transferring' && `Pobieranie do przeglądarki — ${progress}%`}
                    {progressPhase === 'preparing' && 'Łączenie z serwerem Cobalt...'}
                  </p>
                </div>
              )}

              {!loading && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-[#888] hover:text-white transition-colors cursor-pointer"
                >
                  ← Wybierz inny film
                </button>
              )}

              {!loading && lastTimings && (
                <div className="rounded-lg border border-[#1E1E1E] bg-[#0F0F0F] p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#A1A1AA] font-medium">Pobrano w {formatMs(lastTimings.totalMs)}</span>
                    {lastTimings.fileSize > 0 && (
                      <span className="text-[#666]">{formatBytes(lastTimings.fileSize)}</span>
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
