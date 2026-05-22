// TranscriptPage — lokalna transkrypcja audio/wideo przez Whisper (Web Worker + CDN)
import { useState, useRef, useCallback } from 'react';
import { Loader2, Copy, Check, Upload, Shield, X } from 'lucide-react';

const ACCEPTED_EXTENSIONS = '.mp4,.mov,.mp3,.wav,.m4a,.webm';

/**
 * Extracts audio as Float32Array (16kHz mono) from a file using Web Audio API.
 */
async function extractAudio(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  let audioData;
  if (audioBuffer.numberOfChannels === 1) {
    audioData = audioBuffer.getChannelData(0);
  } else {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    audioData = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      audioData[i] = (left[i] + right[i]) / 2;
    }
  }

  await audioCtx.close();
  return audioData;
}

/**
 * Formats seconds to [MM:SS]
 */
function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
}

export default function TranscriptPage() {
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [transcriptProgress, setTranscriptProgress] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const workerRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    setFile(f);
    setTranscript(null);
    setError('');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleTranscribe = async () => {
    if (!file) return;

    console.log('[TranscriptPage] Starting local transcription via Web Worker');
    setIsLoading(true);
    setError('');
    setTranscript(null);
    setTranscriptProgress('Wyodrębnianie audio...');

    try {
      const audioData = await extractAudio(file);
      console.log('[TranscriptPage] Audio extracted, samples:', audioData.length);

      setModelLoading(true);
      setTranscriptProgress('Uruchamianie Whisper...');

      // Create worker (module type for ESM imports from CDN)
      if (!workerRef.current) {
        workerRef.current = new Worker('/whisper.worker.js', { type: 'module' });
      }

      const worker = workerRef.current;

      // Listen for messages from worker
      const result = await new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
          const msg = e.data;
          switch (msg.type) {
            case 'model-progress':
              setModelProgress(msg.progress);
              break;
            case 'model-loaded':
              setModelLoading(false);
              setTranscriptProgress('Transkrypcja w toku...');
              break;
            case 'status':
              setTranscriptProgress(msg.message);
              break;
            case 'result':
              resolve(msg.result);
              break;
            case 'error':
              reject(new Error(msg.error));
              break;
          }
        };
        worker.onerror = (err) => reject(new Error(err.message || 'Worker error'));

        // Send audio data to worker (transfer buffer for performance)
        const buffer = audioData.buffer.slice(0);
        worker.postMessage({ type: 'transcribe', audioData: new Float32Array(buffer) }, [buffer]);
      });

      // Format result
      const chunks = result.chunks || [];
      if (chunks.length === 0 && result.text) {
        setTranscript([{ timestamp: '[00:00]', text: result.text.trim() }]);
      } else {
        const formatted = chunks.map(chunk => ({
          timestamp: formatTimestamp(chunk.timestamp?.[0] || 0),
          text: chunk.text.trim(),
        })).filter(c => c.text.length > 0);
        setTranscript(formatted);
      }

      setTranscriptProgress('');
    } catch (err) {
      console.error('[TranscriptPage] Error:', err);
      setError(err.message || 'Nie udało się przetworzyć pliku');
    } finally {
      setIsLoading(false);
      setModelLoading(false);
      setTranscriptProgress('');
    }
  };

  const handleCopy = async () => {
    if (!transcript) return;
    const text = transcript.map(t => `${t.timestamp} ${t.text}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">Transkrypcja lokalna</span>
        </div>

        <div className="rounded-[12px] border border-[#1E1E1E] bg-[#111111] p-4 md:p-5 space-y-4">
          {/* Privacy notice */}
          <div className="flex items-center gap-2 text-[11px] text-[#666]">
            <Shield className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span>Przetwarzanie odbywa się lokalnie w przeglądarce. Żadne dane nie są wysyłane na serwer.</span>
          </div>

          {/* File upload area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 px-4 cursor-pointer transition-colors ${
              dragOver
                ? 'border-accent bg-accent-muted/20'
                : file
                  ? 'border-green-500/40 bg-green-500/5'
                  : 'border-[#2A2A2A] hover:border-[#444] bg-[#0A0A0A]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={(e) => handleFile(e.target.files[0])}
              className="hidden"
            />
            <Upload className={`h-8 w-8 mb-3 ${file ? 'text-green-400' : 'text-[#555]'}`} />
            {file ? (
              <div className="text-center">
                <p className="text-sm text-white font-medium">{file.name}</p>
                <p className="text-xs text-[#888] mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-[#A1A1AA]">Przeciągnij plik lub kliknij żeby wybrać</p>
                <p className="text-xs text-[#555] mt-1">MP4, MOV, MP3, WAV, M4A, WebM</p>
              </div>
            )}
            {file && (
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setTranscript(null); }}
                className="absolute top-3 right-3 p-1 rounded-md hover:bg-[#1C1C1C] text-[#555] hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Transcribe button */}
          <button
            onClick={handleTranscribe}
            disabled={!file || isLoading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-accent text-sm font-medium text-white hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Przetwarzanie...' : 'Transkrybuj'}
          </button>

          {/* Model loading progress */}
          {modelLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#888]">
                <span>Ładowanie modelu Whisper...</span>
                <span>{modelProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1A1A1A] overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${modelProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-[#555]">Pierwsze użycie wymaga pobrania modelu (~150 MB). Kolejne będą szybsze (cache).</p>
            </div>
          )}

          {/* Transcription progress */}
          {transcriptProgress && !modelLoading && (
            <div className="flex items-center gap-2 text-xs text-[#888]">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{transcriptProgress}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Transcript result */}
          {transcript && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#888]">{transcript.length} fragmentów</p>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-xs text-[#A1A1AA] hover:bg-[#1C1C1C] transition-colors cursor-pointer"
                >
                  {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Skopiowano' : 'Kopiuj'}
                </button>
              </div>
              <div className="rounded-lg bg-[#0A0A0A] border border-[#1A1A1A] p-4 max-h-[500px] overflow-y-auto space-y-1">
                {transcript.map((item, i) => (
                  <div key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="text-[#555] font-mono text-xs shrink-0 pt-0.5">{item.timestamp}</span>
                    <span className="text-[#ccc]">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
