// Web Worker for Whisper transcription via @xenova/transformers CDN
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

self.onmessage = async (e) => {
  const { type, audioData } = e.data;

  if (type === 'transcribe') {
    try {
      // Load model if not cached
      if (!transcriber) {
        self.postMessage({ type: 'status', message: 'Ładowanie modelu Whisper...' });

        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
          progress_callback: (progress) => {
            if (progress.status === 'progress' && progress.progress) {
              self.postMessage({ type: 'model-progress', progress: Math.round(progress.progress) });
            }
            if (progress.status === 'done') {
              self.postMessage({ type: 'model-progress', progress: 100 });
            }
          },
        });

        self.postMessage({ type: 'model-loaded' });
      }

      self.postMessage({ type: 'status', message: 'Transkrypcja w toku...' });

      const result = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        language: 'polish',
        task: 'transcribe',
      });

      self.postMessage({ type: 'result', result });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message || 'Błąd transkrypcji' });
    }
  }
};
