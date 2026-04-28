/**
 * MP3 encoder wrapper around lamejs.
 *
 * Encodes an AudioBuffer to a CBR MP3 ArrayBuffer.
 *
 * Loads lamejs at runtime via the prebuilt single-file bundle
 * (`lamejs/lame.min.js`).  We can't use `import("lamejs")` directly because
 * its CommonJS source spreads MPEGMode/Lame/BitStream/etc. across many files
 * that reference each other through global-scope `var` declarations — under
 * Webpack/Turbopack each file becomes an isolated module and the cross-file
 * references throw `MPEGMode is not defined`.  The bundled file works around
 * this by self-containing every dependency in one IIFE.
 */
export interface Mp3EncoderOptions {
  /** Constant bitrate in kbps. Default: 192. Common values: 128, 192, 256, 320. */
  kbps?: number;
}

interface LameMp3Encoder {
  encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array;
  flush: () => Int8Array;
}

interface LameNamespace {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => LameMp3Encoder;
}

let lamePromise: Promise<LameNamespace> | null = null;

/**
 * Load the prebuilt lamejs bundle by injecting `<script src="/lame.min.js">`.
 *
 * The file is a self-contained IIFE: `function lamejs(){...}; lamejs();`.
 * After it runs, `Mp3Encoder` and `WavHeader` are attached as static members
 * of the `lamejs` function which is exposed on the global window.  We assume
 * `lame.min.js` is served from `/public/lame.min.js` (copied at build time
 * from `node_modules/lamejs/lame.min.js`).
 */
async function loadLame(): Promise<LameNamespace> {
  if (lamePromise) return lamePromise;
  lamePromise = (async () => {
    const existing = (globalThis as unknown as { lamejs?: LameNamespace }).lamejs;
    if (existing && existing.Mp3Encoder) return existing;

    // Try the static script-tag approach first (works in dev and prod when
    // `/lame.min.js` is served from `public/`).
    const url = "/lame.min.js";
    await new Promise<void>((resolve, reject) => {
      // Reuse an already-injected tag if present.
      const existingTag = document.querySelector(`script[data-lamejs="1"]`) as HTMLScriptElement | null;
      if (existingTag) {
        if ((globalThis as unknown as { lamejs?: LameNamespace }).lamejs) return resolve();
        existingTag.addEventListener("load", () => resolve(), { once: true });
        existingTag.addEventListener("error", () => reject(new Error("lamejs script load failed")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.dataset.lamejs = "1";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("lamejs script load failed"));
      document.head.appendChild(script);
    });

    const lamejs = (globalThis as unknown as { lamejs?: LameNamespace }).lamejs;
    if (!lamejs || !lamejs.Mp3Encoder) {
      throw new Error("Failed to load lamejs (Mp3Encoder not available on window.lamejs)");
    }
    return lamejs;
  })();
  return lamePromise;
}

export async function audioBufferToMp3(
  buffer: AudioBuffer,
  options: Mp3EncoderOptions = {},
): Promise<ArrayBuffer> {
  const { kbps = 192 } = options;
  const lame = await loadLame();
  const Mp3Encoder = lame.Mp3Encoder;
  const numCh = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const encoder = new Mp3Encoder(numCh, sampleRate, kbps);

  const length = buffer.length;
  const left = new Int16Array(length);
  const leftF = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    left[i] = Math.max(-32768, Math.min(32767, Math.round(leftF[i] * 32767)));
  }

  let right: Int16Array | undefined;
  if (numCh === 2) {
    right = new Int16Array(length);
    const rightF = buffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      right[i] = Math.max(-32768, Math.min(32767, Math.round(rightF[i] * 32767)));
    }
  }

  const chunks: Uint8Array[] = [];
  const blockSize = 1152;
  for (let i = 0; i < length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const rightChunk = right ? right.subarray(i, i + blockSize) : undefined;
    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      // Copy out of the encoder-owned Int8Array into a fresh Uint8Array so the
      // bytes survive subsequent encodeBuffer calls (some lamejs builds reuse
      // the underlying buffer).
      chunks.push(new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.byteLength).slice());
    }
  }
  const tail = encoder.flush();
  if (tail.length > 0) {
    chunks.push(new Uint8Array(tail.buffer, tail.byteOffset, tail.byteLength).slice());
  }

  // Concatenate into a single ArrayBuffer.
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out.buffer;
}
