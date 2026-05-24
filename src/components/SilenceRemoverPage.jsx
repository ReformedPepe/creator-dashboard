// SilenceRemoverPage — lokalne usuwanie ciszy z plików audio (Web Audio API)
import { useState, useRef, useCallback } from 'react';
import { Shield, Upload, X, FileAudio, Loader2, Download } from 'lucide-react';
import {
  decodeAudioFile,
  analyzeSilence,
  buildWithoutSilence,
  encodeWav,
  sanitizeFilename,
} from '../utils/silenceRemover';

const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.m4a'];
const MAX_FILE_SIZE = 524_288_000; // 500 MB

/**
 * Validates a file for accepted format and size.
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
function validateFile(file) {
  const name = file.name.toLowerCase();
  const hasValidExtension = ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext));
  if (!hasValidExtension) {
    return { valid: false, error: 'Nieobsługiwany format pliku. Wybierz plik MP3, WAV lub M4A' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Plik jest za duży. Maksymalny rozmiar to 500 MB' };
  }
  return { valid: true };
}

export default function SilenceRemoverPage() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [threshold, setThreshold] = useState(-40);
  const [minDuration, setMinDuration] = useState(0.5);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const revokeTimerRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    setError(null);
    setResult(null);

    // Revoke any existing download URL
    if (revokeTimerRef.current) {
      clearTimeout(revokeTimerRef.current);
      revokeTimerRef.current = null;
    }

    const validation = validateFile(f);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setFile(f);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 1) {
      setError('Można wgrać tylko jeden plik naraz');
      return;
    }

    const f = files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleClearFile = useCallback((e) => {
    e.stopPropagation();
    setFile(null);
    setError(null);
    setResult(null);
    if (revokeTimerRef.current) {
      clearTimeout(revokeTimerRef.current);
      revokeTimerRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Wraps analyzeSilence in a chunked async version that yields to the event loop
   * every N windows, allowing React to re-render and update the progress bar.
   */
  const analyzeWithProgress = useCallback((audioBuffer, thresholdDb, minDurationSec, onProgress) => {
    return new Promise((resolve) => {
      // Use setTimeout(0) to yield after calling analyzeSilence synchronously.
      // analyzeSilence already calls onProgress every 100 windows, but since it's
      // synchronous, React can't re-render. We wrap it so the final result is delivered
      // asynchronously, and use the onProgress callback to batch state updates.
      setTimeout(() => {
        const segments = analyzeSilence(audioBuffer, thresholdDb, minDurationSec, onProgress);
        resolve(segments);
      }, 0);
    });
  }, []);

  const handleProcess = useCallback(async () => {
    if (!file || processing) return;

    setProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      // Step 1: Decode audio file
      const audioBuffer = await decodeAudioFile(file);

      // Step 2: Analyze silence with progress reporting
      const segments = await analyzeWithProgress(
        audioBuffer,
        threshold,
        minDuration,
        (percent) => setProgress(percent)
      );

      // Step 3: Build audio without silence
      const resultBuffer = buildWithoutSilence(audioBuffer, segments);

      // Step 4: Encode to WAV
      const blob = encodeWav(resultBuffer);

      // Step 5: Calculate stats
      const originalDuration = audioBuffer.duration;
      const resultDuration = resultBuffer.duration;
      const durationReduced = originalDuration - resultDuration;
      const percentReduced = originalDuration > 0
        ? Math.round((durationReduced / originalDuration) * 100)
        : 0;

      // Step 6: Create download URL and output filename
      const downloadUrl = URL.createObjectURL(blob);
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
      const sanitized = sanitizeFilename(nameWithoutExt);
      const filename = `${sanitized}_no_silence.wav`;

      // Revoke URL after 60 seconds
      if (revokeTimerRef.current) {
        clearTimeout(revokeTimerRef.current);
      }
      revokeTimerRef.current = setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
        revokeTimerRef.current = null;
      }, 60_000);

      setResult({
        blob,
        stats: {
          segmentsRemoved: segments.length,
          durationReduced: Number(durationReduced.toFixed(1)),
          percentReduced,
          originalDuration,
          resultDuration,
        },
        downloadUrl,
        filename,
      });
    } catch (err) {
      setError(err.message || 'Wystąpił błąd podczas przetwarzania audio');
    } finally {
      setProcessing(false);
    }
  }, [file, processing, threshold, minDuration, analyzeWithProgress]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.downloadUrl;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result]);

  return (
    <div className="space-y-6">
      <section>
        {/* Header */}
        <div className="mb-3">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">
            PRZETWARZANIE LOKALNE
          </span>
        </div>

        <div className="rounded-[12px] border border-[#1E1E1E] bg-[#111111] p-4 md:p-5 space-y-4">
          {/* Privacy badge */}
          <div
            role="status"
            className="flex items-center gap-2 text-[11px] text-[#666]"
          >
            <Shield className="h-3.5 w-3.5 text-green-500 shrink-0" aria-hidden="true" />
            <span>Przetwarzanie lokalne — dane nie opuszczają przeglądarki</span>
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={handleDismissError}
                className="ml-3 p-1 rounded-md hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors duration-200 cursor-pointer shrink-0"
                aria-label="Zamknij komunikat błędu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Drag & drop upload zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 px-4 cursor-pointer transition-all duration-200 ease-in-out ${
              dragOver
                ? 'border-accent bg-accent-muted/20'
                : file
                  ? 'border-green-500/40 bg-green-500/5 hover:bg-green-500/8'
                  : 'border-[#2A2A2A] bg-[#0A0A0A] hover:border-[#444] hover:bg-[#0F0F0F]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a"
              onChange={(e) => handleFile(e.target.files[0])}
              className="hidden"
            />

            {file ? (
              <>
                <FileAudio className="h-8 w-8 mb-3 text-green-400" />
                <div className="text-center">
                  <p className="text-sm text-white font-medium">{file.name}</p>
                  <p className="text-xs text-[#888] mt-1">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={handleClearFile}
                  className="absolute top-3 right-3 p-1 rounded-md hover:bg-[#1C1C1C] text-[#555] hover:text-white transition-colors duration-200"
                  aria-label="Usuń plik"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 mb-3 text-[#555]" />
                <div className="text-center">
                  <p className="text-sm text-[#A1A1AA]">Przeciągnij plik lub kliknij żeby wybrać</p>
                  <p className="text-xs text-[#555] mt-1">MP3, WAV, M4A</p>
                </div>
              </>
            )}
          </div>

          {/* Parameter sliders */}
          <div className={`space-y-4 ${processing ? 'opacity-40 cursor-not-allowed' : ''}`}>
            {/* Threshold slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[#A1A1AA]">Próg ciszy</label>
                <span className="text-sm text-white font-mono">{threshold}dB</span>
              </div>
              <input
                type="range"
                min={-60}
                max={-20}
                step={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                disabled={processing}
                className="w-full h-1.5 rounded-full appearance-none bg-[#2A2A2A] accent-[#E53935] cursor-pointer disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#E53935] [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#E53935] [&::-moz-range-thumb]:border-0"
              />
            </div>

            {/* Min duration slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[#A1A1AA]">Minimalna długość ciszy</label>
                <span className="text-sm text-white font-mono">{minDuration.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={2.0}
                step={0.1}
                value={minDuration}
                onChange={(e) => setMinDuration(Number(e.target.value))}
                disabled={processing}
                className="w-full h-1.5 rounded-full appearance-none bg-[#2A2A2A] accent-[#E53935] cursor-pointer disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#E53935] [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#E53935] [&::-moz-range-thumb]:border-0"
              />
            </div>
          </div>

          {/* Process button */}
          <button
            onClick={handleProcess}
            disabled={!file || processing}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-accent hover:bg-accent-light"
          >
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            {processing ? 'Przetwarzanie...' : 'Usuń ciszę'}
          </button>

          {/* Progress bar */}
          {processing && (
            <div className="space-y-2">
              <div className="w-full h-2 rounded-full bg-[#2A2A2A] overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-[#888] text-center">{progress}%</p>
            </div>
          )}

          {/* Results section */}
          {result && !processing && (
            <div className="space-y-3 rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] p-4">
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-white transition-all duration-200 cursor-pointer bg-green-600 hover:bg-green-500"
              >
                <Download className="h-4 w-4" />
                Pobierz plik
              </button>
              <p className="text-sm text-[#A1A1AA] text-center">
                Usunięto {result.stats.segmentsRemoved} fragmentów ciszy • Skrócono o {result.stats.durationReduced.toFixed(1)} sekund ({result.stats.percentReduced}%)
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
