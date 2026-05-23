// Transcribe Worker — uses @huggingface/transformers (next-gen, WebGPU support)
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

let transcriber = null;
let currentModelId = null;

async function detectDevice() {
  // Try WebGPU first, fallback to wasm
  if ('gpu' in self.navigator) {
    try {
      const adapter = await self.navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    } catch {
      // fall through
    }
  }
  return 'wasm';
}

self.onmessage = async (e) => {
  const { type, audio, modelId } = e.data;

  try {
    if (type === 'load') {
      // If model changed, reset transcriber
      if (currentModelId !== modelId) {
        transcriber = null;
        currentModelId = modelId;
      }

      if (transcriber) {
        self.postMessage({ type: 'loaded', device: 'cached' });
        return;
      }

      const device = await detectDevice();
      console.log('[worker] detected device:', device, 'for model:', modelId);
      self.postMessage({ type: 'status', message: `Ładowanie modelu (${device})...` });

      let totalFiles = 0;
      let downloadedFiles = 0;
      // Track loaded/total bytes per file for accurate overall progress
      const fileBytes = new Map(); // file -> { loaded, total }

      transcriber = await pipeline(
        'automatic-speech-recognition',
        modelId,
        {
          dtype: modelId.includes('whisper-large') ? 'fp32' : { encoder_model: 'fp32', decoder_model_merged: 'q4' },
          device,
          progress_callback: (progress) => {
            if (progress.status === 'initiate') {
              totalFiles++;
              fileBytes.set(progress.file, { loaded: 0, total: 0 });
              postOverall(progress.file);
            }
            if (progress.status === 'progress') {
              fileBytes.set(progress.file, { loaded: progress.loaded || 0, total: progress.total || 0 });
              postOverall(progress.file);
            }
            if (progress.status === 'done') {
              downloadedFiles++;
              const existing = fileBytes.get(progress.file);
              if (existing && existing.total > 0) {
                fileBytes.set(progress.file, { loaded: existing.total, total: existing.total });
              }
              postOverall(progress.file);
            }
          },
        }
      );

      // Final 100% only after pipeline fully resolves
      self.postMessage({
        type: 'download_progress',
        percent: 100,
        downloaded: totalFiles,
        total: totalFiles,
        loaded: 0,
        totalBytes: 0,
        file: '',
      });

      function postOverall(file) {
        let totalLoaded = 0;
        let totalSize = 0;
        let inProgressFraction = 0;
        let inProgressCount = 0;
        for (const { loaded, total } of fileBytes.values()) {
          totalLoaded += loaded;
          totalSize += total;
          if (total > 0 && loaded > 0 && loaded < total) {
            inProgressFraction += loaded / total;
            inProgressCount++;
          }
        }

        // Use bytes-based % only once we've seen enough total bytes
        // (>5MB indicates real model files are loading, not just configs)
        // Otherwise use file count + fractional progress on in-flight files
        let percent;
        if (totalSize > 5_000_000) {
          percent = Math.round((totalLoaded / totalSize) * 100);
        } else {
          // File-count based with current-file fractions
          percent = totalFiles > 0
            ? Math.round(((downloadedFiles + inProgressFraction) / totalFiles) * 100)
            : 0;
          // Cap at 99 until truly done — prevents misleading 100%
          if (percent >= 100) percent = 99;
        }

        self.postMessage({
          type: 'download_progress',
          percent,
          downloaded: downloadedFiles,
          total: totalFiles,
          loaded: totalLoaded,
          totalBytes: totalSize,
          file: file || '',
        });
      }

      self.postMessage({ type: 'loaded', device });
      return;
    }

    if (type === 'transcribe') {
      if (!transcriber) {
        self.postMessage({ type: 'error', error: 'Model nie został załadowany' });
        return;
      }

      console.log('[worker] transcribe received, audio length:', audio?.length);
      self.postMessage({ type: 'status', message: 'Transkrypcja w toku...' });

      console.log('[worker] starting pipeline inference...');
      const startTime = Date.now();

      const result = await transcriber(audio, {
        language: 'polish',
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      console.log('[worker] inference done in', Date.now() - startTime, 'ms');
      self.postMessage({ type: 'result', data: result });
    }
  } catch (err) {
    self.postMessage({ type: 'error', error: err.message || 'Błąd workera' });
  }
};
