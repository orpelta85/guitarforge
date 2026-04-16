/**
 * Shared audio mixing utilities for dual recording (guitar + browser audio).
 * Used by RecorderBox and SongRecorder.
 *
 * Phase 5 (AUDIO_SPEC.md §8): Dual-channel mixing now routes through an
 * AudioWorklet (`public/audio-worklets/dual-channel-mixer.js`) when available.
 * If worklet load fails (old Safari, CSP, 404, etc.), we fall back to the
 * previous discrete-node chain. The previous ScriptProcessorNode path in
 * `decodeBlobToBuffer` remains as a final decoding fallback — it is only hit
 * when `decodeAudioData` itself fails on exotic containers.
 */

// ---------------------------------------------------------------------------
// AudioWorklet loader — module-level cache keyed by AudioContext identity.
// We use a WeakMap so contexts can be garbage collected normally.
// ---------------------------------------------------------------------------
const WORKLET_URL = "/audio-worklets/dual-channel-mixer.js";
const WORKLET_PROCESSOR_NAME = "dual-channel-mixer-processor";
const workletLoadCache = new WeakMap<BaseAudioContext, Promise<boolean>>();

/**
 * Ensure the dual-channel mixer worklet module is loaded on the given context.
 * Returns true on success, false if the worklet is unavailable.
 * Failures are logged via console.warn so the caller can decide how to fall back.
 */
async function ensureMixerWorklet(ctx: BaseAudioContext): Promise<boolean> {
  const cached = workletLoadCache.get(ctx);
  if (cached) return cached;
  const p = (async () => {
    try {
      if (!ctx.audioWorklet) {
        console.warn("[audioMix] AudioWorklet API unavailable on this context; using fallback path.");
        return false;
      }
      await ctx.audioWorklet.addModule(WORKLET_URL);
      return true;
    } catch (err) {
      console.warn("[audioMix] Failed to load dual-channel mixer worklet, falling back to graph mixer:", err);
      return false;
    }
  })();
  workletLoadCache.set(ctx, p);
  return p;
}

// Default mixing ratios per AUDIO_SPEC.md §8.2.
const DEFAULT_MIC_GAIN = 1.15;      // +1.2 dB
const DEFAULT_BROWSER_GAIN = 0.75;  // -2.5 dB

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

/** Safety-only peak check — scales DOWN if the buffer exceeds 0.99, never boosts. */
function peakSafety(buffer: AudioBuffer, ceiling = 0.99): void {
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
  if (peak > ceiling) {
    const gain = ceiling / peak;
    for (let ch = 0; ch < numChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] *= gain;
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

// ---------------------------------------------------------------------------
// Core offline-render helpers
// ---------------------------------------------------------------------------

/**
 * Render two pre-decoded AudioBuffers into a single mixed AudioBuffer
 * using the dual-channel-mixer AudioWorklet.
 *
 * Signal graph inside the OfflineAudioContext:
 *   micBuf  → BufferSource → HP(80Hz) ─┐
 *                                       ├→ AudioWorkletNode(dual-channel-mixer) → destination
 *   bBuf    → BufferSource ─────────────┘
 *
 * The worklet applies its own gain + soft-clip. We apply a per-stream
 * compressor *before* the worklet so dynamics per source are preserved,
 * matching the previous graph's behavior.
 */
async function renderMixWithWorklet(
  micBuf: AudioBuffer,
  browserBuf: AudioBuffer,
  micLevel: number,
  browserLevel: number,
): Promise<AudioBuffer> {
  const length = Math.max(micBuf.length, browserBuf.length);
  const sampleRate = micBuf.sampleRate;
  // Force stereo output — the worklet writes to two output channels.
  const channels = 2;
  const offline = new OfflineAudioContext(channels, length, sampleRate);

  await ensureMixerWorklet(offline);

  // Mic chain: HP(80Hz) → per-stream compressor → worklet input 0
  const micSrc = offline.createBufferSource();
  micSrc.buffer = micBuf;
  const micHP = offline.createBiquadFilter();
  micHP.type = "highpass";
  micHP.frequency.value = 80;
  micHP.Q.value = 0.7;
  const micComp = offline.createDynamicsCompressor();
  micComp.threshold.value = -12;
  micComp.knee.value = 6;
  micComp.ratio.value = 3;
  micComp.attack.value = 0.015;
  micComp.release.value = 0.15;
  micSrc.connect(micHP);
  micHP.connect(micComp);

  // Browser chain: per-stream compressor → worklet input 1
  const browserSrc = offline.createBufferSource();
  browserSrc.buffer = browserBuf;
  const browserComp = offline.createDynamicsCompressor();
  browserComp.threshold.value = -12;
  browserComp.knee.value = 6;
  browserComp.ratio.value = 3;
  browserComp.attack.value = 0.015;
  browserComp.release.value = 0.15;
  browserSrc.connect(browserComp);

  // The worklet node — 2 inputs, 1 output, stereo
  const mixerNode = new AudioWorkletNode(offline, WORKLET_PROCESSOR_NAME, {
    numberOfInputs: 2,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: {
      micGain: micLevel,
      browserGain: browserLevel,
      hpCutoff: 80,
    },
  });

  // Connect per-source chains into the worklet's two inputs
  micComp.connect(mixerNode, 0, 0);
  browserComp.connect(mixerNode, 0, 1);

  // Final brick-wall limiter on the worklet output
  const finalLimiter = offline.createDynamicsCompressor();
  finalLimiter.threshold.value = -0.3;
  finalLimiter.knee.value = 0;
  finalLimiter.ratio.value = 20;
  finalLimiter.attack.value = 0.0005;
  finalLimiter.release.value = 0.03;
  mixerNode.connect(finalLimiter);
  finalLimiter.connect(offline.destination);

  micSrc.start(0);
  browserSrc.start(0);

  return offline.startRendering();
}

/**
 * Legacy offline-render path using discrete nodes — kept as a fallback when
 * the AudioWorklet cannot be loaded (old browsers, CSP block, asset 404).
 * This is the exact graph that shipped before Phase 5.
 */
async function renderMixWithGraphFallback(
  micBuf: AudioBuffer,
  browserBuf: AudioBuffer,
  micLevel: number,
  browserLevel: number,
): Promise<AudioBuffer> {
  const length = Math.max(micBuf.length, browserBuf.length);
  const sampleRate = micBuf.sampleRate;
  const channels = Math.max(micBuf.numberOfChannels, browserBuf.numberOfChannels);
  const offline = new OfflineAudioContext(channels, length, sampleRate);

  const finalLimiter = offline.createDynamicsCompressor();
  finalLimiter.threshold.value = -0.3;
  finalLimiter.knee.value = 0;
  finalLimiter.ratio.value = 20;
  finalLimiter.attack.value = 0.0005;
  finalLimiter.release.value = 0.03;
  finalLimiter.connect(offline.destination);

  const micSrc = offline.createBufferSource();
  micSrc.buffer = micBuf;
  const micHP = offline.createBiquadFilter();
  micHP.type = "highpass";
  micHP.frequency.value = 80;
  micHP.Q.value = 0.7;
  const micGain = offline.createGain();
  micGain.gain.value = micLevel;
  const micComp = offline.createDynamicsCompressor();
  micComp.threshold.value = -12;
  micComp.knee.value = 6;
  micComp.ratio.value = 3;
  micComp.attack.value = 0.015;
  micComp.release.value = 0.15;
  micSrc.connect(micHP);
  micHP.connect(micGain);
  micGain.connect(micComp);
  micComp.connect(finalLimiter);
  micSrc.start(0);

  const browserSrc = offline.createBufferSource();
  browserSrc.buffer = browserBuf;
  const browserGain = offline.createGain();
  browserGain.gain.value = browserLevel;
  const browserComp = offline.createDynamicsCompressor();
  browserComp.threshold.value = -12;
  browserComp.knee.value = 6;
  browserComp.ratio.value = 3;
  browserComp.attack.value = 0.015;
  browserComp.release.value = 0.15;
  browserSrc.connect(browserGain);
  browserGain.connect(browserComp);
  browserComp.connect(finalLimiter);
  browserSrc.start(0);

  return offline.startRendering();
}

/**
 * Render a single-source AudioBuffer through the offline pipeline as a stand-alone
 * WAV. Used by `mixTwoStreamsToWavSeparated` to produce per-channel blobs.
 * No gain change, no compression — we capture the source verbatim so the caller
 * can rebalance later.
 */
function renderSourceOnlyToWav(buf: AudioBuffer): Blob {
  // Safety only — do not modify the caller's buffer. Copy into a fresh buffer
  // of the same shape so peakSafety/softClip mutations don't leak back.
  const copy = new OfflineAudioContext(buf.numberOfChannels, buf.length, buf.sampleRate)
    .createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    copy.getChannelData(ch).set(buf.getChannelData(ch));
  }
  const wavData = audioBufferToWav(copy);
  return new Blob([wavData], { type: "audio/wav" });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merge two audio blobs at given volume levels.
 * Public API preserved — callers (RecorderBox, SongRecorder) are unchanged.
 *
 * Internally tries the AudioWorklet path first; on any failure (worklet load
 * or render error) falls back to the discrete-node graph that shipped before
 * Phase 5. Output WAV is identical in format either way.
 */
export async function mixAudioBlobs(
  micBlob: Blob, browserBlob: Blob, micLevel: number, browserLevel: number
): Promise<Blob> {
  const [micBuf, browserBuf] = await Promise.all([
    decodeBlobToBuffer(micBlob),
    decodeBlobToBuffer(browserBlob),
  ]);

  let rendered: AudioBuffer;
  try {
    // Probe an OfflineAudioContext once to check worklet availability
    // (cheap — it just adds the module, no rendering).
    const probeCtx = new OfflineAudioContext(2, 128, micBuf.sampleRate);
    const ok = await ensureMixerWorklet(probeCtx);
    if (!ok) throw new Error("worklet unavailable");
    rendered = await renderMixWithWorklet(micBuf, browserBuf, micLevel, browserLevel);
  } catch (err) {
    console.warn("[audioMix] worklet mix failed, using graph fallback:", err);
    rendered = await renderMixWithGraphFallback(micBuf, browserBuf, micLevel, browserLevel);
  }

  // Safety only — scale down if the limiter let anything slip above 0.99. Never boost.
  peakSafety(rendered, 0.99);
  // Soft-clip before 16-bit conversion as final safety net
  softClipBuffer(rendered);
  const wavData = audioBufferToWav(rendered);
  return new Blob([wavData], { type: "audio/wav" });
}

/**
 * Separated-channel render per AUDIO_SPEC.md §8.3 "Record separately, mix later".
 *
 * Returns three WAV blobs:
 *   - `mic`     : the untouched mic source as a WAV (for post-session rebalance)
 *   - `browser` : the untouched browser tab source as a WAV
 *   - `mixed`   : the mixed output produced by the worklet pipeline
 *
 * If `micLevel` / `browserLevel` are omitted, the spec defaults are used
 * (mic +1.2 dB, browser -2.5 dB).
 *
 * This function does NOT replace `mixAudioBlobs` — existing callers keep the
 * old single-blob API. New callers that want to preserve the raw sources for
 * future rebalancing should prefer this function.
 */
export async function mixTwoStreamsToWavSeparated(
  micBlob: Blob,
  browserBlob: Blob,
  options?: { micLevel?: number; browserLevel?: number },
): Promise<{ mic: Blob; browser: Blob; mixed: Blob }> {
  const micLevel = options?.micLevel ?? DEFAULT_MIC_GAIN;
  const browserLevel = options?.browserLevel ?? DEFAULT_BROWSER_GAIN;

  const [micBuf, browserBuf] = await Promise.all([
    decodeBlobToBuffer(micBlob),
    decodeBlobToBuffer(browserBlob),
  ]);

  // Per-channel blobs are rendered straight from the decoded buffers — no
  // processing — so the user can re-mix later with different gains.
  const micWav = renderSourceOnlyToWav(micBuf);
  const browserWav = renderSourceOnlyToWav(browserBuf);

  // Mixed render with worklet-first / graph-fallback strategy
  let rendered: AudioBuffer;
  try {
    const probeCtx = new OfflineAudioContext(2, 128, micBuf.sampleRate);
    const ok = await ensureMixerWorklet(probeCtx);
    if (!ok) throw new Error("worklet unavailable");
    rendered = await renderMixWithWorklet(micBuf, browserBuf, micLevel, browserLevel);
  } catch (err) {
    console.warn("[audioMix] worklet mix failed in separated path, using graph fallback:", err);
    rendered = await renderMixWithGraphFallback(micBuf, browserBuf, micLevel, browserLevel);
  }
  peakSafety(rendered, 0.99);
  softClipBuffer(rendered);
  const mixedWav = new Blob([audioBufferToWav(rendered)], { type: "audio/wav" });

  return { mic: micWav, browser: browserWav, mixed: mixedWav };
}
