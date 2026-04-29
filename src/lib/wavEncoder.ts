/**
 * Shared WAV encoder.
 *
 * Encodes an AudioBuffer to a 16-bit PCM WAV ArrayBuffer.
 *
 * Includes optional TPDF (triangular probability distribution function)
 * dithering, which replaces harsh quantization distortion with inaudible
 * broadband noise — significantly improving perceived quality at 16-bit.
 *
 * Extracted from `audioMix.ts` (the version with TPDF dither). Future cleanup
 * should migrate the duplicates in `audioMix.ts`, `JamLooper.tsx`, and
 * `StudioPage.old.tsx` to use this shared implementation.
 */
export interface WavEncoderOptions {
  /**
   * Whether to apply TPDF dithering before quantization to 16-bit.
   * Default: true. Disable for deterministic output (useful for tests).
   */
  dither?: boolean;
}

export function audioBufferToWav(
  buffer: AudioBuffer,
  options: WavEncoderOptions = {},
): ArrayBuffer {
  const { dither = true } = options;
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
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Cache channel data refs to avoid repeated method dispatch in the hot loop.
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      if (dither) {
        // TPDF dither: two uniform random values subtracted produces a triangular
        // probability distribution that is statistically optimal for 16-bit truncation.
        const d = (Math.random() - Math.random()) / 32768;
        sample = sample + d;
      }
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return arrayBuffer;
}
