// TranscriptPage — lokalna transkrypcja audio/wideo przez Whisper (WebGPU/WASM)
import { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2, Copy, Check, Upload, Shield, X, Trash2, Download, ChevronDown, HelpCircle, Mic } from 'lucide-react';
import TranscribeWorker from '../workers/transcribe.worker.js?worker';
import { isModelCached, deleteModelCache } from '../utils/modelCache';

const ACCEPTED_EXTENSIONS = '.mp4,.mov,.mp3,.wav,.m4a,.webm';

const MODELS = [
  { id: 'tiny',   name: 'Whisper Tiny',     hfId: 'onnx-community/whisper-tiny',     size: '~40MB',   description: 'Najszybszy, mniej dokładny' },
  { id: 'base',   name: 'Whisper Base',     hfId: 'onnx-community/whisper-base',     size: '~80MB',   description: 'Szybki, dobra jakość' },
  { id: 'small',  name: 'Whisper Small',    hfId: 'onnx-community/whisper-small',    size: '~150MB',  description: 'Domyślny, balans szybkość/jakość' },
  { id: 'medium', name: 'Whisper Medium',   hfId: 'Xenova/whisper-medium',           size: '~500MB',  description: 'Bardzo dobra jakość' },
  { id: 'large',  name: 'Whisper Large v2', hfId: 'Xenova/whisper-large-v2',         size: '~1.5GB',  description: 'Najlepsza jakość, wolny' },
];

const MODEL_KEY = 'statflow-whisper-model';

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

function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
}

export default function TranscriptPage() {
  const [selectedModelId, setSelectedModelId] = useState(() => {
    try { return localStorage.getItem(MODEL_KEY) || 'small'; } catch { return 'small'; }
  });
  const [modelCacheStatus, setModelCacheStatus] = useState({}); // { modelId: boolean }
  const [loadedModelId, setLoadedModelId] = useState(null);

  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [downloadedFiles, setDownloadedFiles] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const speedSamplesRef = useRef([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [device, setDevice] = useState(null);
  const fileInputRef = useRef(null);
  const workerRef = useRef(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedModel = MODELS.find(m => m.id === selectedModelId) || MODELS[2];

  // Rotating download messages
  const ROTATING_MESSAGES = ['Pobieranie modelu...', 'To może chwilę potrwać...', 'Nie zamykaj karty...'];
  const [rotatingMsgIdx, setRotatingMsgIdx] = useState(0);

  // FAQ accordion
  const [openFaqId, setOpenFaqId] = useState(null);
  const [faqOpen, setFaqOpen] = useState(false);

  useEffect(() => {
    if (!modelLoading) return;
    const id = setInterval(() => {
      setRotatingMsgIdx(i => (i + 1) % ROTATING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, [modelLoading]);

  // NO outside click handler — dropdown closes ONLY when a model is selected

  // Persist selected model
  useEffect(() => {
    try { localStorage.setItem(MODEL_KEY, selectedModelId); } catch {}
  }, [selectedModelId]);

  // Initialize worker once
  useEffect(() => {
    workerRef.current = new TranscribeWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Refresh cache status for all models
  const refreshCacheStatus = useCallback(async () => {
    const status = {};
    for (const m of MODELS) {
      status[m.id] = await isModelCached(m.hfId);
    }
    setModelCacheStatus(status);
  }, []);

  useEffect(() => {
    refreshCacheStatus();
  }, [refreshCacheStatus]);

  const handleWorkerDownloadMsg = useCallback((msg) => {
    if (msg.type === 'download_progress') {
      setDownloadedFiles(msg.downloaded);
      setTotalFiles(msg.total);
      if (msg.file) setCurrentFile(msg.file);

      // Monotonic-only percent (never decrease)
      if (msg.percent !== undefined) {
        setDownloadPercent(prev => Math.max(prev, msg.percent));
      }

      // Calculate download speed from total loaded bytes
      if (typeof msg.loaded === 'number' && msg.loaded > 0) {
        const now = Date.now();
        const samples = speedSamplesRef.current;
        const prev = samples.length > 0 ? samples[samples.length - 1] : null;

        if (prev) {
          const dt = now - prev.time;
          const dBytes = msg.loaded - prev.loaded;
          if (dt >= 200 && dBytes > 0) {
            const speedMBs = (dBytes / (dt / 1000)) / 1024 / 1024;
            if (speedMBs > 0 && speedMBs < 1000) {
              samples.push({ loaded: msg.loaded, time: now, speed: speedMBs });
              if (samples.length > 5) samples.shift();
              const speeds = samples.filter(s => s.speed > 0).map(s => s.speed);
              const avg = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
              setDownloadSpeed(avg);
            }
          }
        } else {
          samples.push({ loaded: msg.loaded, time: now, speed: 0 });
        }
      }
    }
  }, []);

  const handleDeleteModel = async (modelId) => {
    const m = MODELS.find(x => x.id === modelId);
    if (!m) return;
    await deleteModelCache(m.hfId);
    // Reset worker so it doesn't use cached model from memory
    if (loadedModelId === modelId) {
      setLoadedModelId(null);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = new TranscribeWorker();
      }
    }
    await refreshCacheStatus();
  };

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

  const handlePreloadModel = async (modelId) => {
    if (!workerRef.current || modelLoading) return;
    const m = MODELS.find(x => x.id === modelId);
    if (!m) return;

    setSelectedModelId(modelId);
    setModelLoading(true);
    setDownloadedFiles(0);
    setTotalFiles(0);
    setCurrentFile('');
    setDownloadPercent(0);
    setDownloadSpeed(0);
    speedSamplesRef.current = [];
    setStatusMessage('Pobieranie modelu...');
    setError('');

    try {
      const worker = workerRef.current;
      await new Promise((resolve, reject) => {
        const handler = (e) => {
          const msg = e.data;
          handleWorkerDownloadMsg(msg);
          if (msg.type === 'status') setStatusMessage(msg.message);
          if (msg.type === 'loaded') {
            setDevice(msg.device);
            setLoadedModelId(modelId);
            setModelLoading(false);
            worker.removeEventListener('message', handler);
            resolve();
          }
          if (msg.type === 'error') {
            worker.removeEventListener('message', handler);
            reject(new Error(msg.error));
          }
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ type: 'load', modelId: m.hfId });
      });
      await refreshCacheStatus();
    } catch (err) {
      setError(err.message || 'Nie udało się pobrać modelu');
    } finally {
      setModelLoading(false);
      setStatusMessage('');
    }
  };

  const handleTranscribe = async () => {
    if (!file || !workerRef.current) return;

    setIsLoading(true);
    setError('');
    setTranscript(null);
    setStatusMessage('Wyodrębnianie audio...');
    setDownloadPercent(0);

    try {
      const audioData = await extractAudio(file);

      const worker = workerRef.current;

      // Load model if not yet loaded or if user changed model
      if (loadedModelId !== selectedModelId) {
        setModelLoading(true);
        setDownloadedFiles(0);
        setTotalFiles(0);
        setCurrentFile('');
        setDownloadPercent(0);
        setDownloadSpeed(0);
        speedSamplesRef.current = [];
        setStatusMessage('Ładowanie modelu...');

        await new Promise((resolve, reject) => {
          const handler = (e) => {
            const msg = e.data;
            handleWorkerDownloadMsg(msg);
            if (msg.type === 'status') setStatusMessage(msg.message);
            if (msg.type === 'loaded') {
              setDevice(msg.device);
              setLoadedModelId(selectedModelId);
              setModelLoading(false);
              worker.removeEventListener('message', handler);
              resolve();
            }
            if (msg.type === 'error') {
              worker.removeEventListener('message', handler);
              reject(new Error(msg.error));
            }
          };
          worker.addEventListener('message', handler);
          worker.postMessage({ type: 'load', modelId: selectedModel.hfId });
        });

        // Refresh cache status after load
        await refreshCacheStatus();
      }

      // Transcribe
      setStatusMessage('Transkrypcja w toku...');
      const result = await new Promise((resolve, reject) => {
        const handler = (e) => {
          const msg = e.data;
          if (msg.type === 'status') setStatusMessage(msg.message);
          if (msg.type === 'result') {
            worker.removeEventListener('message', handler);
            resolve(msg.data);
          }
          if (msg.type === 'error') {
            worker.removeEventListener('message', handler);
            reject(new Error(msg.error));
          }
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ type: 'transcribe', audio: audioData });
      });

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

      setStatusMessage('');
    } catch (err) {
      console.error('[TranscriptPage] Error:', err);
      setError(err.message || 'Nie udało się przetworzyć pliku');
    } finally {
      setIsLoading(false);
      setModelLoading(false);
      setStatusMessage('');
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
          <Mic className="h-3.5 w-3.5 text-[#E53935]" />
          <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">Transkrypcja lokalna</span>
          <button
            onClick={() => setFaqOpen(true)}
            className="ml-auto flex items-center justify-center h-6 w-6 rounded-full border border-[#2A2A2A] text-[#555] hover:text-white hover:border-[#444] transition-colors duration-200 cursor-pointer shrink-0"
            title="Pomoc"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="rounded-[12px] border border-[#1E1E1E] bg-[#111111] p-4 md:p-5 space-y-4">
          {/* Privacy notice */}
          <div className="flex items-center gap-2 text-[11px] text-[#666]">
            <Shield className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span>Przetwarzanie lokalne — dane nie opuszczają przeglądarki{device ? ` (${device.toUpperCase()})` : ''}.</span>
          </div>

          {/* Model selector — collapsible radio list */}
          <div ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] text-sm text-white hover:border-[#333] transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedModel.name}</span>
                <span className="text-[11px] text-[#666]">{selectedModel.size}</span>
                {modelCacheStatus[selectedModelId] && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-500/10 text-green-400">
                    <Check className="h-2 w-2" />
                    Pobrany
                  </span>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 text-[#555] transition-transform duration-250 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Animated radio list */}
            <div
              className="overflow-hidden transition-all duration-250 ease-in-out"
              style={{
                maxHeight: dropdownOpen ? `${MODELS.length * 80 + (modelLoading ? 80 : 0) + 80}px` : '0px',
                opacity: dropdownOpen ? 1 : 0,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mt-2 space-y-1">
                {MODELS.map((m) => {
                  const isCached = modelCacheStatus[m.id] === true;
                  const isSelected = m.id === selectedModelId;
                  const isDownloading = modelLoading && isSelected;

                  return (
                    <div
                      key={m.id}
                      onClick={() => { setSelectedModelId(m.id); setDropdownOpen(false); }}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                        isDownloading
                          ? 'border border-accent pulse-border bg-accent-muted/10'
                          : isSelected
                            ? 'bg-accent-muted/10 border border-accent/30'
                            : 'border border-transparent hover:bg-[#1A1A1A]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Radio indicator */}
                        <div className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors duration-200 ${
                          isSelected ? 'border-accent' : 'border-[#444]'
                        }`}>
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm transition-colors duration-200 ${isSelected ? 'text-white font-medium' : 'text-[#A1A1AA]'}`}>{m.name}</span>
                            <span className="text-[11px] text-[#555]">{m.size}</span>
                            {isCached ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                <Check className="h-2 w-2" />
                                Pobrany
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#1A1A1A] text-[#555] border border-[#2A2A2A]">
                                <Download className="h-2 w-2" />
                                Nie pobrano
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#666]">{m.description}</p>
                        </div>
                      </div>

                      {isCached ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteModel(m.id); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors duration-200 cursor-pointer shrink-0"
                          title="Usuń z cache"
                        >
                          <Trash2 className="h-3 w-3" />
                          Usuń
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePreloadModel(m.id); }}
                          disabled={modelLoading}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-accent hover:bg-accent-muted/20 border border-accent/30 transition-colors duration-200 cursor-pointer disabled:opacity-40 shrink-0"
                          title="Pobierz model"
                        >
                          <Download className="h-3 w-3" />
                          Pobierz
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Orbit loader + rotating message + file count when downloading */}
                {modelLoading && dropdownOpen && (
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <svg className="h-8 w-8 shrink-0" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="13" fill="none" stroke="#B71C1C" strokeWidth="1.5" opacity="0.3" />
                        <g className="animate-[spin_1.2s_linear_infinite]" style={{ transformOrigin: '16px 16px' }}>
                          <circle cx="16" cy="3" r="3" fill="#E53935" />
                        </g>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[#A1A1AA]">
                          {ROTATING_MESSAGES[rotatingMsgIdx]}
                          {totalFiles > 0 ? ` ${downloadedFiles} / ${totalFiles} plików` : ''}
                          {downloadSpeed > 0 ? ` • ${downloadSpeed.toFixed(1)} MB/s` : ''}
                        </p>
                        {currentFile && <p className="text-[9px] text-[#555] truncate mt-0.5">{currentFile}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* File upload area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
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
              accept={ACCEPTED_EXTENSIONS}
              onChange={(e) => handleFile(e.target.files[0])}
              className="hidden"
            />
            <Upload className={`h-8 w-8 mb-3 transition-colors duration-200 ${file ? 'text-green-400' : 'text-[#555]'}`} />
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
                className="absolute top-3 right-3 p-1 rounded-md hover:bg-[#1C1C1C] text-[#555] hover:text-white transition-colors duration-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Transcribe button */}
          <button
            onClick={handleTranscribe}
            disabled={!file || isLoading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-accent text-sm font-medium text-white hover:bg-accent-light transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Przetwarzanie...' : 'Transkrybuj'}
          </button>

          {/* Model download progress — orbit + rotating message + file counter */}
          {modelLoading && !dropdownOpen && (
            <div className="flex items-center gap-3 overflow-visible">
              <svg className="h-8 w-8 shrink-0" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="13" fill="none" stroke="#B71C1C" strokeWidth="1.5" opacity="0.3" />
                <g className="animate-[spin_1.2s_linear_infinite]" style={{ transformOrigin: '16px 16px' }}>
                  <circle cx="16" cy="3" r="3" fill="#E53935" />
                </g>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#A1A1AA]">
                  {ROTATING_MESSAGES[rotatingMsgIdx]}
                  {totalFiles > 0 ? ` ${downloadedFiles} / ${totalFiles} plików` : ''}
                  {downloadSpeed > 0 ? ` • ${downloadSpeed.toFixed(1)} MB/s` : ''}
                </p>
                {currentFile && <p className="text-[10px] text-[#555] truncate mt-0.5">{currentFile}</p>}
              </div>
            </div>
          )}

          {/* Status message */}
          {statusMessage && !modelLoading && (
            <div className="flex items-center gap-2 text-xs text-[#888]">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{statusMessage}</span>
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-xs text-[#A1A1AA] hover:bg-[#1C1C1C] transition-colors duration-200 cursor-pointer"
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
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {[
                {
                  id: 'q1',
                  q: 'Który model wybrać?',
                  a: (
                    <>
                      <p><strong className="text-[#A1A1AA]">Tiny / Base</strong> — szybkie testy i krótkie nagrania.</p>
                      <p><strong className="text-[#A1A1AA]">Small</strong> — codzienny użytek, balans szybkość/jakość.</p>
                      <p><strong className="text-[#A1A1AA]">Medium / Large</strong> — profesjonalne transkrypcje, długie materiały.</p>
                    </>
                  ),
                },
                {
                  id: 'q2',
                  q: 'Jak długo trwa pobieranie modelu?',
                  a: (
                    <>
                      <p>Zależy od łącza. Orientacyjnie:</p>
                      <ul className="ml-4 list-disc">
                        <li>Tiny (~40MB): kilka sekund</li>
                        <li>Small (~150MB): ~30s</li>
                        <li>Medium (~500MB): 1-2 min</li>
                        <li>Large (~1.5GB): 5-15 min</li>
                      </ul>
                    </>
                  ),
                },
                {
                  id: 'q3',
                  q: 'Czy moje pliki są bezpieczne?',
                  a: <p>Tak — przetwarzanie odbywa się lokalnie w Twojej przeglądarce. Żadne dane nie są wysyłane na serwer.</p>,
                },
                {
                  id: 'q4',
                  q: 'Gdzie znajdę więcej informacji o modelach?',
                  a: (
                    <ul className="space-y-1">
                      <li><a href="https://huggingface.co/Xenova/whisper-tiny" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Xenova/whisper-tiny</a></li>
                      <li><a href="https://huggingface.co/Xenova/whisper-base" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Xenova/whisper-base</a></li>
                      <li><a href="https://huggingface.co/Xenova/whisper-small" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Xenova/whisper-small</a></li>
                      <li><a href="https://huggingface.co/Xenova/whisper-medium" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Xenova/whisper-medium</a></li>
                      <li><a href="https://huggingface.co/Xenova/whisper-large-v2" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Xenova/whisper-large-v2</a></li>
                    </ul>
                  ),
                },
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
                        <div className="px-4 pb-3 pt-1 text-xs text-[#888] space-y-1.5">
                          {item.a}
                        </div>
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
