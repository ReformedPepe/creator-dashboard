// YouTubeDownloaderPage — pobieranie filmów i audio z YouTube
import { useState, useEffect } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { validateYouTubeUrl } from '../utils/youtubeUrlValidator';

const QUALITIES = ['1080p', '720p', '480p', '360p'];

export default function YouTubeDownloaderPage() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp4');       // 'mp4' | 'mp3'
  const [quality, setQuality] = useState('720p');    // '1080p' | '720p' | '480p' | '360p'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const [urlValid, setUrlValid] = useState(false);

  // Debounced URL validation (300ms)
  useEffect(() => {
    if (url.trim() === '') {
      setUrlValid(false);
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      const result = validateYouTubeUrl(url);
      setUrlValid(result.valid);
      if (!result.valid) {
        setError('Nieprawidłowy link YouTube');
      } else {
        setError(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [url]);

  // Reset quality to 720p when switching back to MP4
  const handleFormatChange = (newFormat) => {
    setFormat(newFormat);
    if (newFormat === 'mp4') {
      setQuality('720p');
    }
  };

  // Download handler
  const handleDownload = async () => {
    if (isDownloadDisabled) return;

    setLoading(true);
    setDownloadError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/tools/youtube-download`,
        { url, format, quality },
        {
          responseType: 'blob',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Parse filename from Content-Disposition header
      const disposition = response.headers['content-disposition'];
      let filename = `download.${format}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      // Trigger download via hidden <a> element
      const objectUrl = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      let message = 'Wystąpił błąd podczas pobierania. Spróbuj ponownie.';

      if (err.response) {
        const status = err.response.status;

        try {
          // When axios returns a blob error, we need to read it as text
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
            message = 'Film jest niedostępny lub prywatny';
          }
          // 500 or other: use default message
        } catch {
          // JSON parse failed, use default message
        }
      } else if (!err.response) {
        message = 'Błąd połączenia z serwerem. Spróbuj ponownie.';
      }

      setDownloadError(message);
    } finally {
      setLoading(false);
    }
  };

  const isDownloadDisabled = !url.trim() || !urlValid || loading;

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
          {/* URL Input */}
          <div className="space-y-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Wklej link do filmu YouTube"
              maxLength={200}
              disabled={loading}
              className="w-full px-4 py-3 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#444] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            {error && url.trim() !== '' && (
              <p className="text-sm text-red-500">
                {error}
              </p>
            )}
          </div>

          {/* Download Error Banner */}
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
          {format === 'mp4' && (
            <div className="space-y-2">
              <label className="text-sm text-[#A1A1AA]">Jakość</label>
              <div className="flex gap-0">
                {QUALITIES.map((q, index) => {
                  const isFirst = index === 0;
                  const isLast = index === QUALITIES.length - 1;
                  const roundedClass = isFirst
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
            disabled={isDownloadDisabled}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-white transition-all duration-200 disabled:opacity-[0.4] disabled:cursor-not-allowed cursor-pointer bg-[#E53935] hover:bg-[#EF5350]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Pobieranie...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Pobierz
              </>
            )}
          </button>

          {/* Progress Bar — indeterminate, shown during loading */}
          {loading && (
            <div className="space-y-2">
              <div className="w-full h-2 rounded-full bg-[#2A2A2A] overflow-hidden relative">
                <div
                  className="absolute top-0 left-0 h-full w-1/3 rounded-full bg-[#E53935] animate-progress-indeterminate"
                />
              </div>
              <p className="text-xs text-[#888] text-center">Pobieranie pliku... To może chwilę potrwać.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
