/**
 * Silence Remover — moduł logiki przetwarzania audio.
 * 100% Web Audio API, brak zewnętrznych bibliotek.
 */

/**
 * Dekoduje plik audio do AudioBuffer.
 * @param {File} file - plik audio (mp3, wav, m4a)
 * @returns {Promise<AudioBuffer>}
 * @throws {Error} gdy dekodowanie się nie powiedzie
 */
export async function decodeAudioFile(file) {
  const arrayBuffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Nie udało się odczytać pliku'));
    reader.readAsArrayBuffer(file);
  });

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } catch (err) {
    throw new Error('Nie udało się zdekodować pliku audio');
  } finally {
    await audioContext.close();
  }
}

/**
 * Analizuje AudioBuffer i zwraca segmenty ciszy do usunięcia.
 * @param {AudioBuffer} audioBuffer
 * @param {number} thresholdDb - próg ciszy w dB (np. -40)
 * @param {number} minDurationSec - minimalna długość ciszy w sekundach (np. 0.5)
 * @param {function} onProgress - callback(percent: number) 0-100
 * @returns {Array<{startMs: number, endMs: number}>} segmenty ciszy
 */
export function analyzeSilence(audioBuffer, thresholdDb, minDurationSec, onProgress) {
  const WINDOW_SIZE = 2048;
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;
  const totalWindows = Math.floor(totalSamples / WINDOW_SIZE);

  // Mix all channels to mono for analysis
  const channelCount = audioBuffer.numberOfChannels;
  const channels = [];
  for (let ch = 0; ch < channelCount; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  const silenceWindows = []; // array of booleans: true = silence

  for (let w = 0; w < totalWindows; w++) {
    const offset = w * WINDOW_SIZE;

    // Compute RMS across all channels (average)
    let sumSquares = 0;
    for (let i = 0; i < WINDOW_SIZE; i++) {
      let sampleSum = 0;
      for (let ch = 0; ch < channelCount; ch++) {
        sampleSum += channels[ch][offset + i];
      }
      const sample = sampleSum / channelCount;
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / WINDOW_SIZE);

    // Convert to dB
    let db;
    if (rms === 0) {
      db = -Infinity;
    } else {
      db = 20 * Math.log10(rms);
    }

    // Classify: silence if dB < threshold
    silenceWindows.push(db < thresholdDb);

    // Report progress
    if (onProgress && (w % 100 === 0 || w === totalWindows - 1)) {
      onProgress(Math.round(((w + 1) / totalWindows) * 100));
    }
  }

  // Aggregate contiguous silence windows into segments
  const windowDurationMs = (WINDOW_SIZE / sampleRate) * 1000;
  const minDurationMs = minDurationSec * 1000;
  const segments = [];

  let segStart = null;
  for (let w = 0; w <= totalWindows; w++) {
    const isSilence = w < totalWindows && silenceWindows[w];

    if (isSilence && segStart === null) {
      segStart = w;
    } else if (!isSilence && segStart !== null) {
      // End of contiguous silence run
      const startMs = segStart * windowDurationMs;
      const endMs = w * windowDurationMs;
      const durationMs = endMs - startMs;

      if (durationMs >= minDurationMs) {
        segments.push({ startMs, endMs });
      }
      segStart = null;
    }
  }

  return segments;
}

/**
 * Buduje nowy AudioBuffer bez segmentów ciszy, z 50ms paddingiem i crossfade.
 * @param {AudioBuffer} audioBuffer - źródłowy buffer
 * @param {Array<{startMs: number, endMs: number}>} silenceSegments
 * @returns {AudioBuffer} nowy buffer bez ciszy
 */
export function buildWithoutSilence(audioBuffer, silenceSegments) {
  const sampleRate = audioBuffer.sampleRate;
  const channelCount = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;
  const paddingSamples = Math.round(0.05 * sampleRate); // 50ms padding

  // If no silence segments, return a copy of the original
  if (!silenceSegments || silenceSegments.length === 0) {
    const output = new AudioContext().createBuffer(channelCount, totalSamples, sampleRate);
    for (let ch = 0; ch < channelCount; ch++) {
      output.getChannelData(ch).set(audioBuffer.getChannelData(ch));
    }
    return output;
  }

  // Compute non-silence regions (gaps between silence segments)
  // Include audio before first silence and after last silence
  const nonSilenceRegions = []; // array of {startSample, endSample}

  // Convert ms to samples
  const silenceSamples = silenceSegments.map(seg => ({
    start: Math.round((seg.startMs / 1000) * sampleRate),
    end: Math.round((seg.endMs / 1000) * sampleRate),
  }));

  let cursor = 0;
  for (const seg of silenceSamples) {
    if (cursor < seg.start) {
      nonSilenceRegions.push({ startSample: cursor, endSample: seg.start });
    }
    cursor = seg.end;
  }
  // Remaining audio after last silence
  if (cursor < totalSamples) {
    nonSilenceRegions.push({ startSample: cursor, endSample: totalSamples });
  }

  // If no non-silence regions, return empty buffer
  if (nonSilenceRegions.length === 0) {
    const ctx = new AudioContext();
    const output = ctx.createBuffer(channelCount, 0, sampleRate);
    return output;
  }

  // Expand each region with padding (clamped to source bounds)
  const paddedRegions = nonSilenceRegions.map(region => ({
    startSample: Math.max(0, region.startSample - paddingSamples),
    endSample: Math.min(totalSamples, region.endSample + paddingSamples),
  }));

  // Calculate total output length considering overlaps and crossfades
  // First, determine the actual segments to write (merging overlapping padded regions)
  const mergedRegions = [];
  for (const region of paddedRegions) {
    if (mergedRegions.length === 0) {
      mergedRegions.push({ ...region });
    } else {
      const last = mergedRegions[mergedRegions.length - 1];
      if (region.startSample <= last.endSample) {
        // Overlapping — merge
        last.endSample = Math.max(last.endSample, region.endSample);
      } else {
        mergedRegions.push({ ...region });
      }
    }
  }

  // Now build output with crossfade on overlapping padding regions between adjacent non-merged padded regions
  // Strategy: write each padded region sequentially, applying crossfade where padding overlaps
  let outputLength = 0;
  const regionOutputInfo = []; // {srcStart, srcEnd, outStart, crossfadeLength}

  for (let i = 0; i < paddedRegions.length; i++) {
    const region = paddedRegions[i];
    const regionLength = region.endSample - region.startSample;

    if (i === 0) {
      regionOutputInfo.push({
        srcStart: region.startSample,
        srcEnd: region.endSample,
        outStart: 0,
        crossfadeLength: 0,
      });
      outputLength = regionLength;
    } else {
      const prevRegion = paddedRegions[i - 1];
      // Check if this region's start overlaps with previous region's end in source
      const overlap = Math.max(0, prevRegion.endSample - region.startSample);
      const crossfadeLength = Math.min(overlap, paddingSamples);

      if (crossfadeLength > 0) {
        // Overlap: the output position backs up by crossfadeLength
        const outStart = outputLength - crossfadeLength;
        regionOutputInfo.push({
          srcStart: region.startSample,
          srcEnd: region.endSample,
          outStart,
          crossfadeLength,
        });
        outputLength = outStart + regionLength;
      } else {
        // No overlap: append directly
        regionOutputInfo.push({
          srcStart: region.startSample,
          srcEnd: region.endSample,
          outStart: outputLength,
          crossfadeLength: 0,
        });
        outputLength += regionLength;
      }
    }
  }

  // Create output buffer
  const ctx = new AudioContext();
  const output = ctx.createBuffer(channelCount, outputLength, sampleRate);

  for (let ch = 0; ch < channelCount; ch++) {
    const srcData = audioBuffer.getChannelData(ch);
    const outData = output.getChannelData(ch);

    for (let i = 0; i < regionOutputInfo.length; i++) {
      const info = regionOutputInfo[i];
      const regionLength = info.srcEnd - info.srcStart;

      for (let s = 0; s < regionLength; s++) {
        const srcSample = srcData[info.srcStart + s];
        const outIdx = info.outStart + s;

        if (s < info.crossfadeLength) {
          // Crossfade region: blend with existing data
          const fadeIn = s / info.crossfadeLength;
          const fadeOut = 1 - fadeIn;
          outData[outIdx] = outData[outIdx] * fadeOut + srcSample * fadeIn;
        } else {
          outData[outIdx] = srcSample;
        }
      }
    }
  }

  return output;
}

/**
 * Koduje AudioBuffer do formatu WAV (PCM 16-bit).
 * @param {AudioBuffer} audioBuffer
 * @returns {Blob} blob typu "audio/wav"
 * @throws {Error} gdy buffer jest pusty lub niezdefiniowany
 */
export function encodeWav(audioBuffer) {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Brak danych audio do zakodowania');
  }

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true); // file size - 8
  writeString(view, 8, 'WAVE');

  // fmt subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1 size (PCM = 16)
  view.setUint16(20, 1, true); // audio format (PCM = 1)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write interleaved PCM samples
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  let offset = headerSize;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      // Clamp to [-1, 1] and convert to 16-bit signed integer
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Sanityzuje nazwę pliku — usuwa znaki niedozwolone.
 * Removes: / \ : * ? " < > |
 * @param {string} filename
 * @returns {string}
 */
export function sanitizeFilename(filename) {
  return filename.replace(/[/\\:*?"<>|]/g, '');
}

// --- Helper ---

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
