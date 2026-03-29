/**
 * Shared audio mixing utilities for dual recording (guitar + browser audio).
 * Used by RecorderBox and SongRecorder.
 */

/**
 * Decode an audio blob to AudioBuffer.
 * Uses decodeAudioData which handles most webm/mp4 containers in modern browsers.
 * Fallback: play through <audio> element + ScriptProcessorNode to capture PCM.
 * NOTE: ScriptProcessorNode is deprecated in favor of AudioWorklet, but the
 * fallback path is rarely hit in modern Chrome/Firefox/Edge and AudioWorklet
 * cannot be used with MediaElementSource in this pattern. Keeping as last resort.
 */
export async function decodeBlobToBuffer(blob: Blob): Promise<AudioBuffer> {
  try {
    const ctx = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
    const arrayBuf = await blob.arrayBuffer();
    const buf = await ctx.decodeAudioData(arrayBuf);
    await ctx.close();
    return buf;
  } catch {
    // decodeAudioData failed — use audio element fallback (deprecated ScriptProcessorNode)
  }

  return new Promise<AudioBuffer>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";

    const cleanup = () => { URL.revokeObjectURL(url); };

    audio.addEventListener("error", () => {
      cleanup();
      reject(new Error("Cannot decode audio blob — format not supported."));
    }, { once: true });

    audio.addEventListener("loadedmetadata", () => {
      const duration = audio.duration;
      if (!isFinite(duration) || duration <= 0) {
        cleanup();
        reject(new Error("Audio blob has invalid duration."));
        return;
      }

      const ctx = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
      const src = ctx.createMediaElementSource(audio);
      // ScriptProcessorNode is deprecated but required here as a fallback
      // for containers that decodeAudioData cannot handle directly
      const processor = ctx.createScriptProcessor(4096, 2, 2);
      const pcmL: Float32Array[] = [];
      const pcmR: Float32Array[] = [];

      processor.onaudioprocess = (e) => {
        pcmL.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        if (e.inputBuffer.numberOfChannels > 1) {
          pcmR.push(new Float32Array(e.inputBuffer.getChannelData(1)));
        } else {
          pcmR.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        }
      };

      const gain = ctx.createGain();
      gain.gain.value = 0.001;
      src.connect(processor);
      processor.connect(gain);
      gain.connect(ctx.destination);

      audio.addEventListener("ended", () => {
        processor.disconnect();
        src.disconnect();
        gain.disconnect();

        const totalLen = pcmL.reduce((a, c) => a + c.length, 0);
        if (totalLen === 0) {
          ctx.close().catch(() => {});
          cleanup();
          reject(new Error("No audio data captured from blob."));
          return;
        }

        const result = ctx.createBuffer(2, totalLen, ctx.sampleRate);
        let off = 0;
        for (const chunk of pcmL) { result.getChannelData(0).set(chunk, off); off += chunk.length; }
        off = 0;
        for (const chunk of pcmR) { result.getChannelData(1).set(chunk, off); off += chunk.length; }

        ctx.close().catch(() => {});
        cleanup();
        resolve(result);
      }, { once: true });

      audio.currentTime = 0;
      audio.play().catch(() => {
        ctx.close().catch(() => {});
        cleanup();
        reject(new Error("Cannot play audio for decoding."));
      });
    }, { once: true });

    audio.load();
  });
}

/** Peak-normalize an AudioBuffer in-place — only boosts quiet signals, never amplifies above target */
function normalizeBuffer(buffer: AudioBuffer, targetLinear = 0.90): void {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  let peak = 0;
  for (let ch = 0; ch < numChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  // Only normalize UP if the signal is quiet (peak < target).
  // Never boost a signal that is already near or above target — this avoids
  // amplifying compression artifacts and pushing hot signals into clipping.
  if (peak > 0.001 && peak < targetLinear) {
    const gain = targetLinear / peak;
    for (let ch = 0; ch < numChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] *= gain;
      }
    }
  }
}

/**
 * Soft-clip a buffer in-place using tanh saturation.
 * Prevents hard digital clipping in the 16-bit WAV export.
 * The tanh curve gently rounds peaks above ~0.8 instead of
 * chopping them flat at 1.0 (which sounds harsh).
 */
function softClipBuffer(buffer: AudioBuffer): void {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  for (let ch = 0; ch < numChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      // tanh soft-clips: values near 0 pass through linearly,
      // values above ~0.8 are gently compressed toward 1.0
      data[i] = Math.tanh(data[i]);
    }
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = buffer.getChannelData(ch)[i];
      // TPDF dithering: two uniform random values subtracted produces a triangular
      // probability distribution. This replaces harsh quantization distortion with
      // inaudible broadband noise, significantly improving perceived quality at 16-bit.
      const dither = (Math.random() - Math.random()) / 32768;
      sample = Math.max(-1, Math.min(1, sample + dither));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return arrayBuffer;
}

/** Merge two audio blobs at given volume levels using OfflineAudioContext */
export async function mixAudioBlobs(
  micBlob: Blob, browserBlob: Blob, micLevel: number, browserLevel: number
): Promise<Blob> {
  const [micBuf, browserBuf] = await Promise.all([
    decodeBlobToBuffer(micBlob),
    decodeBlobToBuffer(browserBlob),
  ]);

  const length = Math.max(micBuf.length, browserBuf.length);
  const sampleRate = micBuf.sampleRate;
  const channels = Math.max(micBuf.numberOfChannels, browserBuf.numberOfChannels);
  const offline = new OfflineAudioContext(channels, length, sampleRate);

  // True brick-wall limiter — completely transparent below -3dBFS,
  // only catches intersample peaks when both sources combine.
  // Previous settings (threshold: -1, ratio: 2, knee: 10) were compressing
  // almost everything, squashing dynamics and causing harshness.
  const limiter = offline.createDynamicsCompressor();
  limiter.threshold.value = -3;    // only engage on combined peaks above -3dBFS
  limiter.knee.value = 0;          // hard knee — either limiting or not
  limiter.ratio.value = 20;        // 20:1 = brick wall, not gentle compression
  limiter.attack.value = 0.001;    // 1ms — catch transients fast
  limiter.release.value = 0.05;    // 50ms — release quickly to avoid pumping
  limiter.connect(offline.destination);

  const micSrc = offline.createBufferSource();
  micSrc.buffer = micBuf;
  const micGain = offline.createGain();
  micGain.gain.value = micLevel;
  micSrc.connect(micGain);
  micGain.connect(limiter);
  micSrc.start(0);

  const browserSrc = offline.createBufferSource();
  browserSrc.buffer = browserBuf;
  const browserGain = offline.createGain();
  browserGain.gain.value = browserLevel;
  browserSrc.connect(browserGain);
  browserGain.connect(limiter);
  browserSrc.start(0);

  const rendered = await offline.startRendering();
  // Only boost if the signal is quiet; never push a hot signal higher
  normalizeBuffer(rendered, 0.90);
  // Soft-clip before 16-bit conversion to avoid harsh digital clipping
  softClipBuffer(rendered);
  const wavData = audioBufferToWav(rendered);
  return new Blob([wavData], { type: "audio/wav" });
}
