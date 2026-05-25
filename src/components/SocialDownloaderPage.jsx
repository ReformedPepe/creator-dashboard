// SocialDownloaderPage — pobieranie z TikToka i X/Twittera przez Cobalt API
import { useState, useEffect } from 'react';
import { Download, Loader2, X as XIcon, Search, Sparkles, ChevronDown, HelpCircle } from 'lucide-react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { validateSocialUrl } from '../utils/socialUrlValidator';

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

function platformLabel(p) {
  if (p === 'tiktok') return 'TikTok';
  if (p === 'x') return 'X / Twitter';
  return '';
}

export default function SocialDownloaderPage({ onDownloadStateChange }) {
  const [url, setUrl] = useState('');
  const [urlValid, setUrlValid] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [detectedPlatform, setDetectedPlatform] = useState(null);

  const [videoInfo, setVideoInfo] = useState(null);
  const [fetchingInfo, setFetchingInfo] = useState(false);

  const [format, setFormat] = useState('mp4');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState('idle');
  const [downloadError, setDownloadError] = useState(null);
  const [lastTimings, setLastTimings] = useState(null);
  const [faqOpen, setFaqOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState(null);

  // Report download state to parent (for background toast widget)
  useEffect(() => {
    if (!onDownloadStateChange) return;
    if (!loading) {
      onDownloadStateChange(null);
    } else {
      onDownloadStateChange({
        filename: `download.${format}`,
        progress,
        phase: progressPhase,
        error: null,
        done: progressPhase === 'done',
      });
    }
  }, [loading, progress, progressPhase, format, onDownloadStateChange]);

  // Debounced URL validation
  useEffect(() => {
    if (url.trim() === '') {
      setUrlValid(false);
      setUrlError(null);
      setDetectedPlatform(null);
      return;
    }
    const timer = setTimeout(() => {
      const result = validateSocialUrl(url);
      setUrlValid(result.valid);
      setDetectedPlatform(result.platform);
      setUrlError(result.valid ? null : 'Nieprawidłowy link. Wklej link z TikToka lub X/Twittera.');
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
        `${import.meta.env.VITE_API_URL}/api/tools/social-info`,
        { url },
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );
      setVideoInfo(response.data);
    } catch (err) {
      let message = 'Nie udało się rozpoznać linku';
      if (err.response?.data?.error) message = err.response.data.error;
      else if (!err.response) message = 'Błąd połączenia z serwerem. Spróbuj ponownie.';
      setDownloadError(message);
    } finally {
      setFetchingInfo(false);
    }
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
      console.log(`[social-dl client] +${ms}ms ${label}`);
      return ms;
    };
    tEnter('start');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      tEnter('auth ready, sending POST');
      setProgressPhase('extracting');

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/tools/social-download`,
        { url, format },
        {
          responseType: 'blob',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 0,
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
              if (progressPhase !== 'transferring') setProgressPhase('transferring');
              setProgress(percent);
            }
          },
        }
      );

      tEnter('response received');

      const disposition = response.headers['content-disposition'];
      let filename = `download.${format}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const objectUrl = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      const totalMs = tEnter('done');
      setProgress(100);
      setProgressPhase('done');
      setLastTimings({ totalMs, fileSize: response.data?.size || 0 });
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
            SOCIAL DOWNLOADER
          </span>
          <button
            onClick={() => setFaqOpen(true)}
            className="ml-auto flex items-center justify-center h-6 w-6 rounded-full border border-[#2A2A2A] text-[#555] hover:text-white hover:border-[#444] transition-colors duration-200 cursor-pointer shrink-0"
            title="Pomoc"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="rounded-[12px] border border-[#1E1E1E] bg-[#111111] p-4 md:p-5 space-y-6">
          <div role="status" className="flex items-center gap-2 text-[11px] text-[#666]">
            <Sparkles className="h-3.5 w-3.5 text-[#E53935] shrink-0" aria-hidden="true" />
            <span>TikTok bez znaku wodnego, X / Twitter w najlepszej jakości. Oparte o Cobalt API.</span>
          </div>

          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && urlValid && !fetchingInfo && !loading) handleSearch();
                }}
                placeholder="Wklej link do TikToka lub X / Twittera"
                maxLength={300}
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
                    Sprawdź
                  </>
                )}
              </button>
            </div>
            {urlError && url.trim() !== '' && (
              <p className="text-sm text-red-500">{urlError}</p>
            )}
            {urlValid && detectedPlatform && !videoInfo && !fetchingInfo && (
              <p className="text-xs text-[#888]">Wykryto: {platformLabel(detectedPlatform)}</p>
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
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {videoInfo && (
            <div className="space-y-4 rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-widest text-[#52525B]">Platforma</p>
                  <p className="text-sm text-white font-medium">{platformLabel(videoInfo.platform)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-[#A1A1AA]">Format</label>
                <div className="flex gap-0">
                  <button
                    type="button"
                    onClick={() => setFormat('mp4')}
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
                    onClick={() => setFormat('mp3')}
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
                    {progressPhase === 'preparing' && 'Łączenie...'}
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

      {/* FAQ Modal */}
      {faqOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] overflow-y-auto" onClick={() => setFaqOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg rounded-[16px] border border-[#222222] bg-[#111111] p-5 md:p-6 max-h-[80vh] overflow-y-auto animate-[fadeScale_200ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Często zadawane pytania</h3>
              <button
                onClick={() => setFaqOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1C1C1C] border border-[#2A2A2A] text-[#888] hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { id: 'q1', q: 'Jak to działa?', a: <p>Wklejasz link do TikToka lub X/Twittera, a serwer Cobalt pobiera plik i przesyła go do Twojej przeglądarki.</p> },
                { id: 'q2', q: 'Czy TikTok jest bez znaku wodnego?', a: <p>Tak — Cobalt domyślnie pobiera wersję bez watermarku TikToka.</p> },
                { id: 'q3', q: 'Jakie linki są obsługiwane?', a: (
                  <ul className="ml-4 list-disc space-y-1">
                    <li>TikTok: tiktok.com/@user/video/..., vm.tiktok.com/...</li>
                    <li>X / Twitter: x.com/user/status/..., twitter.com/user/status/...</li>
                  </ul>
                )},
                { id: 'q4', q: 'Jaki jest limit pobrań?', a: <p>10 pobrań na godzinę per użytkownik. Limit resetuje się automatycznie.</p> },
                { id: 'q5', q: 'Czy mogę pobrać audio (MP3)?', a: <p>Tak — wybierz format MP3 przed kliknięciem "Pobierz". Cobalt wyciągnie ścieżkę audio z filmu.</p> },
              ].map((item) => {
                const isOpen = openFaqId === item.id;
                return (
                  <div key={item.id} className="rounded-lg border border-[#1E1E1E] bg-[#0A0A0A]">
                    <button
                      onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left text-sm text-white hover:bg-[#141414] transition-colors duration-200 cursor-pointer"
                    >
                      <span className="font-medium">{item.q}</span>
                      <ChevronDown className={`h-4 w-4 text-[#555] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div
                      className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                      style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                    >
                      <div className="overflow-hidden">
                        <div className="px-4 pb-3 pt-1 text-xs text-[#888] space-y-1.5">{item.a}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
