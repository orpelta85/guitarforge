// Drum sampler: loads optional WAV samples from /public/audio/drums/ and falls
// back to math-based synthesis when a sample isn't present.
//
// The Studio drum machine asks the sampler to play instrument N at time T;
// if a real sample has been loaded for N, it plays back via AudioBufferSource;
// otherwise the synth fallback (a kick/snare/hat oscillator chain) runs.
//
// Files are fetched lazily on first use per AudioContext, then cached. A miss
// at the network layer (404, decode error) is treated as "use synth" and is
// not retried — keeps the Studio responsive without manual setup.

// `null` entries skip the fetch and force the synth fallback (no 404 noise in
// the console). Add a real file to /public/audio/drums/ then swap the entry
// to its filename to enable sample playback.
export const DRUM_SAMPLE_FILES = [
  "kick.wav",
  "snare.wav",
  "hihat-closed.wav",
  "hihat-open.wav",
  null, // clap — no sample yet, use synth
  "ride.wav",
  "tom-low.wav",
  "tom-high.wav",
] as const;

// Index here matches the DRUM_INSTRUMENTS array in StudioPage.tsx:
//   0 Kick, 1 Snare, 2 HiHat Closed, 3 HiHat Open, 4 Clap, 5 Ride,
//   6 Tom Low, 7 Tom High.
export type DrumIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface SampleCache {
  buffers: Map<DrumIndex, AudioBuffer | null>; // null = tried and failed
  loading: Map<DrumIndex, Promise<AudioBuffer | null>>;
}

const ctxCache = new WeakMap<BaseAudioContext, SampleCache>();

function getCache(ctx: BaseAudioContext): SampleCache {
  let c = ctxCache.get(ctx);
  if (!c) {
    c = { buffers: new Map(), loading: new Map() };
    ctxCache.set(ctx, c);
  }
  return c;
}

async function fetchSample(
  ctx: BaseAudioContext,
  index: DrumIndex,
): Promise<AudioBuffer | null> {
  const filename = DRUM_SAMPLE_FILES[index];
  if (!filename) return null; // null entry → use synth, no fetch
  const url = `/audio/drums/${filename}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Returns the cached AudioBuffer for the drum instrument synchronously, or
 * `null` if no sample is available (synth should be used instead).
 *
 * On the very first lookup per (ctx, index), kicks off an async fetch. While
 * the fetch is in flight, returns null and the caller falls back to synth —
 * by the second-or-third call the sample is loaded and used. This is fine for
 * a step sequencer: the first hit may be synth, the rest are samples.
 */
export function getDrumSampleSync(
  ctx: BaseAudioContext,
  index: DrumIndex,
): AudioBuffer | null {
  const cache = getCache(ctx);
  const have = cache.buffers.get(index);
  if (have !== undefined) return have; // null counts as "tried, failed"
  if (!cache.loading.has(index)) {
    const promise = fetchSample(ctx, index).then((buf) => {
      cache.buffers.set(index, buf);
      cache.loading.delete(index);
      return buf;
    });
    cache.loading.set(index, promise);
  }
  return null;
}

/** Eagerly load all drum samples for the given context. Safe to call once on
 *  Studio mount. Resolves once every sample either lands or 404s. */
export async function preloadDrumSamples(ctx: BaseAudioContext): Promise<void> {
  const cache = getCache(ctx);
  const indices: DrumIndex[] = [0, 1, 2, 3, 4, 5, 6, 7];
  await Promise.all(
    indices.map(async (i) => {
      if (cache.buffers.has(i)) return;
      const buf = await fetchSample(ctx, i);
      cache.buffers.set(i, buf);
    }),
  );
}

/**
 * Schedule a drum sample on the context's timeline. Returns true if a sample
 * was found and played, false if the caller should fall back to synth.
 */
export function playDrumSample(
  ctx: AudioContext,
  index: DrumIndex,
  time: number,
  output: AudioNode,
): boolean {
  const buffer = getDrumSampleSync(ctx, index);
  if (!buffer) return false;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(output);
  source.start(time);
  return true;
}
