// Metronome click synthesis (cowbell/woodblock FM hybrid).
// Pre-builds 3 AudioBuffers (accent / normal / subdivision) per AudioContext.
// See docs/AUDIO_SPEC.md Section 5 for parameter rationale.

export type ClickKind = "accent" | "normal" | "subdivision";

interface ClickPreset {
  durationMs: number;
  carrierFreq: number;
  modFreq: number;
  fmIndex: number;
  attackMs: number;
  decayMs: number;
  noiseAmp: number;
  noiseDecay: number; // 1/sec
  bodyMix: number; // body-vs-noise mix (0..1)
  postFilterFreq: number;
  postFilterGainDb: number;
  postFilterQ: number;
  finalPeak: number;
}

// ─── Section 5.2 parameter tables ────────────────────────────────────────────

const ACCENT_PRESET: ClickPreset = {
  durationMs: 25, carrierFreq: 2200, modFreq: 3300, fmIndex: 1.2,
  attackMs: 0.5, decayMs: 18, noiseAmp: 0.65, noiseDecay: 800,
  bodyMix: 0.55, postFilterFreq: 3200, postFilterGainDb: 4, postFilterQ: 2.0,
  finalPeak: 0.85,
};
const NORMAL_PRESET: ClickPreset = {
  durationMs: 20, carrierFreq: 1700, modFreq: 2400, fmIndex: 1.0,
  attackMs: 0.5, decayMs: 14, noiseAmp: 0.55, noiseDecay: 900,
  bodyMix: 0.60, postFilterFreq: 2600, postFilterGainDb: 3, postFilterQ: 2.0,
  finalPeak: 0.75,
};
const SUBDIVISION_PRESET: ClickPreset = {
  durationMs: 14, carrierFreq: 2800, modFreq: 3700, fmIndex: 0.8,
  attackMs: 0.3, decayMs: 9, noiseAmp: 0.40, noiseDecay: 1100,
  bodyMix: 0.70, postFilterFreq: 3800, postFilterGainDb: 2, postFilterQ: 2.0,
  finalPeak: 0.55,
};

// ─── Local DSP helper — RBJ peaking biquad, applied in place ─────────────────

function applyPeakingEQ(
  data: Float32Array,
  sr: number,
  f0: number,
  linearGain: number,
  Q: number,
): void {
  const A = Math.sqrt(linearGain);
  const w0 = (2 * Math.PI * f0) / sr;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw = Math.cos(w0);
  const b0 = 1 + alpha * A;
  const b1 = -2 * cosw;
  const b2 = 1 - alpha * A;
  const a0 = 1 + alpha / A;
  const a1 = -2 * cosw;
  const a2 = 1 - alpha / A;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    data[i] = y0;
  }
}

// ─── Core buffer builder ─────────────────────────────────────────────────────

function buildClickBuffer(ctx: AudioContext, p: ClickPreset): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor((sr * p.durationMs) / 1000));
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);

  const attackSamples = Math.max(1, Math.floor((sr * p.attackMs) / 1000));
  const decayTau = p.decayMs / 1000;

  for (let i = 0; i < len; i++) {
    const t = i / sr;

    // Linear attack, exponential decay after the attack phase.
    const env =
      i < attackSamples
        ? i / attackSamples
        : Math.exp(-(t - attackSamples / sr) / decayTau);

    // FM synthesis: carrier modulated by a higher-frequency modulator.
    const mod = Math.sin(2 * Math.PI * p.modFreq * t);
    const body = Math.sin(2 * Math.PI * p.carrierFreq * t + p.fmIndex * mod);

    // Transient broadband noise burst — gives the click its "tock".
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * p.noiseDecay) * p.noiseAmp;

    d[i] = (body * p.bodyMix + noise * (1 - p.bodyMix)) * env;
  }

  // Post EQ for bite at the carrier's upper harmonic region.
  applyPeakingEQ(
    d,
    sr,
    p.postFilterFreq,
    10 ** (p.postFilterGainDb / 20),
    p.postFilterQ,
  );

  // Normalize to the preset's final peak — keeps click loudness consistent
  // so external `clickGain()` in metronomeAudio.ts can remain unchanged.
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const a = Math.abs(d[i]);
    if (a > peak) peak = a;
  }
  if (peak > 0) {
    const g = p.finalPeak / peak;
    for (let i = 0; i < len; i++) d[i] *= g;
  }

  return buf;
}

// ─── Module-level cache (per AudioContext sample rate) ───────────────────────

export interface MetronomeClickBuffers {
  accent: AudioBuffer;
  normal: AudioBuffer;
  subdivision: AudioBuffer;
}

// Keyed by sampleRate + version so rebuild only happens when a context with a
// different rate is encountered (rare; happens when the browser forces 48k),
// or when the preset version is bumped (forcing stale caches to invalidate).
const bufferCache = new Map<string, MetronomeClickBuffers>();

/**
 * Pre-build (or return cached) accent/normal/subdivision click buffers.
 * Total CPU: ~1-3 ms per context. Safe to call during mount.
 */
export function buildMetronomeClicks(ctx: AudioContext): MetronomeClickBuffers {
  const key = `${ctx.sampleRate}@v2`;
  const existing = bufferCache.get(key);
  if (existing) return existing;
  const built: MetronomeClickBuffers = {
    accent: buildClickBuffer(ctx, ACCENT_PRESET),
    normal: buildClickBuffer(ctx, NORMAL_PRESET),
    subdivision: buildClickBuffer(ctx, SUBDIVISION_PRESET),
  };
  bufferCache.set(key, built);
  return built;
}
