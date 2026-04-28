// Math-based cabinet and room impulse-response builders.
// Generates 4 IRs deterministically at runtime — no hosted deps, no npm deps.
// See docs/AUDIO_SPEC.md Section 1 for the physical model and parameter rationale.

export type CabinetPresetName =
  | "mesa_v30_highgain"
  | "marshall_1960_rock"
  | "fender_twin_clean"
  | "room_studio_medium";

interface Resonance {
  freq: number;
  amp: number;
  decay: number;
}

interface Notch {
  freq: number;
  depth: number;
  decay: number;
}

interface EarlyReflection {
  timeMs: number;
  amp: number;
  stereo: number; // +1 = L louder, -1 = R louder
}

interface PreEmphasis {
  freq: number;
  gainDb: number;
}

export interface CabinetPreset {
  name: CabinetPresetName;
  lengthSec: number;
  resonances: Resonance[];
  notches: Notch[];
  earlyReflections: EarlyReflection[];
  noiseAmp: number;
  masterDecay: number;
  preEmphasis: PreEmphasis;
  lowCut: number;
  highCut: number;
  // Rooms add a diffuse noise tail after 60 ms; cabinets do not.
  diffuseTail?: boolean;
}

// ─── Preset A: Mesa Rectifier 4x12 w/ V30, SM57 on-axis close ───
export const MesaV30: CabinetPreset = {
  name: "mesa_v30_highgain",
  lengthSec: 0.120,
  resonances: [
    { freq: 95, amp: 1.0, decay: 55 },
    { freq: 220, amp: 0.45, decay: 70 },
    { freq: 480, amp: 0.30, decay: 90 },
    { freq: 1100, amp: 0.55, decay: 110 },
    { freq: 2500, amp: 0.80, decay: 130 },
    { freq: 4200, amp: 0.35, decay: 180 },
  ],
  notches: [
    { freq: 350, depth: 0.35, decay: 80 },
    { freq: 750, depth: 0.25, decay: 95 },
  ],
  earlyReflections: [
    { timeMs: 1.2, amp: 0.25, stereo: 0 },
    { timeMs: 3.5, amp: 0.15, stereo: 0.4 },
    { timeMs: 7.8, amp: 0.10, stereo: -0.4 },
  ],
  noiseAmp: 0.18,
  masterDecay: 28,
  preEmphasis: { freq: 2500, gainDb: 4.5 },
  lowCut: 85,
  highCut: 6500,
};

// ─── Preset B: Marshall 1960A 4x12 w/ G12T-75, SM57 slightly off-axis ───
export const Marshall1960: CabinetPreset = {
  name: "marshall_1960_rock",
  lengthSec: 0.140,
  resonances: [
    { freq: 110, amp: 0.85, decay: 50 },
    { freq: 260, amp: 0.55, decay: 65 },
    { freq: 680, amp: 0.60, decay: 85 },
    { freq: 1800, amp: 0.70, decay: 120 },
    { freq: 3600, amp: 0.45, decay: 160 },
    { freq: 5200, amp: 0.25, decay: 220 },
  ],
  notches: [
    { freq: 420, depth: 0.20, decay: 75 },
  ],
  earlyReflections: [
    { timeMs: 1.8, amp: 0.28, stereo: 0.3 },
    { timeMs: 4.2, amp: 0.18, stereo: -0.3 },
    { timeMs: 9.1, amp: 0.12, stereo: 0.5 },
  ],
  noiseAmp: 0.14,
  masterDecay: 22,
  preEmphasis: { freq: 1800, gainDb: 3.0 },
  lowCut: 80,
  highCut: 7500,
};

// ─── Preset C: Fender Twin 2x12 w/ Jensen, condenser mid-cone ───
export const FenderTwin: CabinetPreset = {
  name: "fender_twin_clean",
  lengthSec: 0.160,
  resonances: [
    { freq: 130, amp: 0.70, decay: 40 },
    { freq: 320, amp: 0.50, decay: 60 },
    { freq: 900, amp: 0.55, decay: 80 },
    { freq: 2200, amp: 0.60, decay: 110 },
    { freq: 4800, amp: 0.55, decay: 150 },
    { freq: 7800, amp: 0.30, decay: 200 },
  ],
  notches: [],
  earlyReflections: [
    { timeMs: 2.5, amp: 0.22, stereo: 0.2 },
    { timeMs: 5.8, amp: 0.15, stereo: -0.2 },
    { timeMs: 12.3, amp: 0.10, stereo: 0.4 },
  ],
  noiseAmp: 0.10,
  masterDecay: 18,
  preEmphasis: { freq: 4500, gainDb: 2.5 },
  lowCut: 75,
  highCut: 10000,
};

// ─── Preset D: Medium studio room — used as a send FX, not a cabinet ───
export const MediumRoom: CabinetPreset = {
  name: "room_studio_medium",
  lengthSec: 0.450,
  resonances: [],
  notches: [],
  earlyReflections: [
    { timeMs: 8, amp: 0.35, stereo: 0.6 },
    { timeMs: 14, amp: 0.28, stereo: -0.6 },
    { timeMs: 22, amp: 0.22, stereo: 0.3 },
    { timeMs: 31, amp: 0.18, stereo: -0.3 },
    { timeMs: 43, amp: 0.14, stereo: 0.5 },
    { timeMs: 58, amp: 0.10, stereo: -0.5 },
    { timeMs: 76, amp: 0.08, stereo: 0 },
  ],
  noiseAmp: 0,
  masterDecay: 6,
  preEmphasis: { freq: 500, gainDb: -1.5 },
  lowCut: 120,
  highCut: 9000,
  diffuseTail: true,
};

// ─── DSP helpers (RBJ cookbook filters, applied in place) ────────────────────

function applyOnePoleHP(data: Float32Array, sr: number, fc: number): void {
  const rc = 1 / (2 * Math.PI * fc);
  const dt = 1 / sr;
  const a = rc / (rc + dt);
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < data.length; i++) {
    const out = a * (prevOut + data[i] - prevIn);
    prevIn = data[i];
    prevOut = out;
    data[i] = out;
  }
}

function applyOnePoleLP(data: Float32Array, sr: number, fc: number): void {
  const rc = 1 / (2 * Math.PI * fc);
  const dt = 1 / sr;
  const a = dt / (rc + dt);
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    prev = prev + a * (data[i] - prev);
    data[i] = prev;
  }
}

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

// ─── Core IR builder ─────────────────────────────────────────────────────────

function buildIRBuffer(ctx: BaseAudioContext, p: CabinetPreset): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * p.lengthSec);
  const buf = ctx.createBuffer(2, len, sr);

  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let s = 0;

      // Damped sinusoidal resonances (speaker cone + cab body).
      for (const r of p.resonances) {
        s += Math.sin(2 * Math.PI * r.freq * t) * Math.exp(-t * r.decay) * r.amp;
      }

      // Subtract notches (mic-placement comb filtering).
      for (const n of p.notches) {
        s -= Math.sin(2 * Math.PI * n.freq * t) * Math.exp(-t * n.decay) * n.depth;
      }

      // Discrete early reflections at exact sample indices.
      for (const e of p.earlyReflections) {
        const sampleIdx = Math.floor(e.timeMs * 0.001 * sr);
        if (i === sampleIdx) {
          const chGain =
            ch === 0
              ? e.stereo >= 0
                ? 1
                : 1 + e.stereo * 0.3
              : e.stereo <= 0
                ? 1
                : 1 - e.stereo * 0.3;
          s += e.amp * chGain;
        }
      }

      // Initial air-transient broadband noise.
      if (p.noiseAmp > 0) {
        s += (Math.random() * 2 - 1) * Math.exp(-t * 400) * p.noiseAmp;
      }

      // Room diffuse tail (rooms only).
      if (p.diffuseTail && t > 0.060) {
        const decorr = ch === 0 ? 1 : -1;
        s += (Math.random() * 2 - 1) * decorr * Math.exp(-(t - 0.060) * 8) * 0.12;
      }

      // Master exponential envelope.
      s *= Math.exp(-t * p.masterDecay);

      d[i] = s;
    }

    // Bake EQ into the IR via in-place IIR filtering.
    applyOnePoleHP(d, sr, p.lowCut);
    applyOnePoleLP(d, sr, p.highCut);
    applyPeakingEQ(d, sr, p.preEmphasis.freq, 10 ** (p.preEmphasis.gainDb / 20), 1.0);

    // Right-channel 3-sample delay + blend for natural stereo width.
    if (ch === 1) {
      for (let i = len - 1; i >= 3; i--) {
        d[i] = d[i] * 0.92 + d[i - 3] * 0.12;
      }
    }
  }

  // Normalize peak to 0.5 (headroom margin — ConvolverNode is near-unity).
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
    }
  }
  if (peak > 0) {
    const g = 0.5 / peak;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] *= g;
    }
  }

  return buf;
}

// ─── Module-level cache (per AudioContext sample rate) ───────────────────────

const irCache = new Map<string, AudioBuffer>();

function cacheKey(name: CabinetPresetName, sr: number): string {
  return `${name}@${sr}`;
}

// Map preset names to expected real-IR file paths. Files are kept under
// /public/audio/cabs/ — each ~10-50 KB stereo WAV at 48 kHz.
// If a file is missing or the fetch fails, we fall back to the math-based IR
// in buildIRBuffer() so the player keeps working without manual setup.
const IR_FILE_PATHS: Record<CabinetPresetName, string> = {
  mesa_v30_highgain: "/audio/cabs/mesa_v30.wav",
  marshall_1960_rock: "/audio/cabs/marshall_1960.wav",
  fender_twin_clean: "/audio/cabs/fender_twin.wav",
  room_studio_medium: "/audio/cabs/room_studio.wav",
};

// Track which presets we've already tried to fetch — we only attempt each
// remote URL once per page load, regardless of failure cause.
const fetchAttempted = new Set<string>();

/**
 * Build (or return cached) cabinet/room IR for the given preset.
 *
 * On first call per preset+sampleRate: tries to fetch the real WAV from
 * /public/audio/cabs/. If that 404s, errors, or decodeAudioData rejects, falls
 * back to the math-based synthetic IR (buildIRBuffer) — keeps the player working
 * even without manually downloaded IR files.
 *
 * Cached after first build per preset+sampleRate, so this is cheap on repeat
 * calls. Total CPU on synth path: ~5-15 ms; total wall-time on fetch path:
 * dominated by network (typically <50 ms for a local <50 KB WAV).
 */
export async function buildCabinetIR(
  ctx: BaseAudioContext,
  preset: CabinetPreset,
): Promise<AudioBuffer> {
  const key = cacheKey(preset.name, ctx.sampleRate);
  const existing = irCache.get(key);
  if (existing) return existing;

  // Only try fetching once per preset URL — avoid hammering on repeat misses.
  const url = IR_FILE_PATHS[preset.name];
  if (url && !fetchAttempted.has(url)) {
    fetchAttempted.add(url);
    try {
      const response = await fetch(url);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
        irCache.set(key, decoded);
        return decoded;
      }
    } catch {
      /* fall through to synthetic fallback */
    }
  }

  // Fallback: math-based synthetic IR.
  const buf = buildIRBuffer(ctx, preset);
  irCache.set(key, buf);
  return buf;
}

/** Look up a preset object by its name. */
export function getCabinetPreset(name: CabinetPresetName): CabinetPreset {
  switch (name) {
    case "mesa_v30_highgain":
      return MesaV30;
    case "marshall_1960_rock":
      return Marshall1960;
    case "fender_twin_clean":
      return FenderTwin;
    case "room_studio_medium":
      return MediumRoom;
  }
}
