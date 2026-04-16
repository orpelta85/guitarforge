// Studio-page per-track effect presets.
// Source of truth: docs/AUDIO_SPEC.md Section 3.
//
// Universal channel-strip topology (§3.1):
//   track source -> EQ3 (low/mid/high) -> Compressor -> Saturation (WaveShaper)
//                -> Panner (equal-power) -> trackGain -> master bus
//                -> master reverb send (parallel) -> master limiter
//
// Saturation uses the same tanh(x*k)*s curve as the tab player (§2.3) with
// s = 0.95 fixed across all Studio presets.

export type StudioPresetId = "clean" | "rock" | "metal" | "ambient" | "lofi";

/** Per-role panning values — "Gtr L" left-panned track, "Gtr R" right-panned. */
export interface StudioPresetPans {
  guitarL: number; // typically negative
  guitarR: number; // typically positive
  bass: number;
  drumsOverheadL: number;
  drumsOverheadR: number;
}

export interface StudioPresetEq {
  lowGainDb: number;
  lowFreqHz: number;   // EQ3 low/mid crossover
  midGainDb: number;
  highGainDb: number;
  highFreqHz: number;  // EQ3 mid/high crossover
}

export interface StudioPresetCompressor {
  thresholdDb: number;
  ratio: number;
  attackSec: number;
  releaseSec: number;
  kneeDb: number;
}

export interface StudioPresetReverb {
  decaySec: number;
  wet: number;
  preDelayMs: number;
}

export interface StudioPreset {
  id: StudioPresetId;
  label: string;

  eq: StudioPresetEq;
  compressor: StudioPresetCompressor;
  reverb: StudioPresetReverb;

  // Saturation: curve[i] = tanh(x * shaperK) * shaperS, x ∈ [-1, 1].
  shaperK: number;
  shaperS: number;

  pans: StudioPresetPans;

  /** Target RMS level in dBFS for each track — used as a reference, not enforced. */
  targetTrackLevelDbfs: number;
}

// Shared saturation amplitude scalar (§3.2: "s = 0.95").
const SHAPER_S = 0.95;

// ─── Clean ───────────────────────────────────────────────────────────────────
export const StudioClean: StudioPreset = {
  id: "clean",
  label: "Clean",
  eq: {
    lowGainDb: 1.0,
    lowFreqHz: 250,
    midGainDb: 0.0,
    highGainDb: 1.5,
    highFreqHz: 3500,
  },
  compressor: {
    thresholdDb: -16,
    ratio: 2.0,
    attackSec: 0.010,
    releaseSec: 0.200,
    kneeDb: 12,
  },
  reverb: { decaySec: 2.4, wet: 0.18, preDelayMs: 25 },
  shaperK: 0.6,
  shaperS: SHAPER_S,
  pans: {
    guitarL: -0.15,
    guitarR: 0.15,
    bass: 0,
    drumsOverheadL: -0.4,
    drumsOverheadR: 0.4,
  },
  targetTrackLevelDbfs: -6,
};

// ─── Rock ────────────────────────────────────────────────────────────────────
export const StudioRock: StudioPreset = {
  id: "rock",
  label: "Rock",
  eq: {
    lowGainDb: 2.0,
    lowFreqHz: 220,
    midGainDb: 1.0,
    highGainDb: 2.5,
    highFreqHz: 4000,
  },
  compressor: {
    thresholdDb: -12,
    ratio: 3.0,
    attackSec: 0.006,
    releaseSec: 0.180,
    kneeDb: 8,
  },
  reverb: { decaySec: 1.8, wet: 0.14, preDelayMs: 20 },
  shaperK: 1.2,
  shaperS: SHAPER_S,
  pans: {
    guitarL: -0.55,
    guitarR: 0.55,
    bass: 0,
    drumsOverheadL: -0.65,
    drumsOverheadR: 0.65,
  },
  targetTrackLevelDbfs: -8,
};

// ─── Metal ───────────────────────────────────────────────────────────────────
export const StudioMetal: StudioPreset = {
  id: "metal",
  label: "Metal",
  eq: {
    lowGainDb: 3.0,
    lowFreqHz: 100,
    midGainDb: -2.5, // scooped mids
    highGainDb: 3.5,
    highFreqHz: 5000,
  },
  compressor: {
    thresholdDb: -10,
    ratio: 4.0,
    attackSec: 0.003,
    releaseSec: 0.120,
    kneeDb: 6,
  },
  reverb: { decaySec: 1.2, wet: 0.10, preDelayMs: 15 },
  shaperK: 2.2,
  shaperS: SHAPER_S,
  pans: {
    guitarL: -0.85,
    guitarR: 0.85,
    bass: 0, // mono-centre, mandatory
    drumsOverheadL: -0.80,
    drumsOverheadR: 0.80,
  },
  targetTrackLevelDbfs: -9,
};

// ─── Ambient ─────────────────────────────────────────────────────────────────
export const StudioAmbient: StudioPreset = {
  id: "ambient",
  label: "Ambient",
  eq: {
    lowGainDb: -1.0,
    lowFreqHz: 180,
    midGainDb: 0.0,
    highGainDb: 2.0,
    highFreqHz: 6000,
  },
  compressor: {
    thresholdDb: -20,
    ratio: 1.5,
    attackSec: 0.020,
    releaseSec: 0.400,
    kneeDb: 18,
  },
  reverb: { decaySec: 5.5, wet: 0.45, preDelayMs: 60 },
  shaperK: 0.4,
  shaperS: SHAPER_S,
  pans: {
    guitarL: -0.70,
    guitarR: 0.70,
    bass: 0,
    drumsOverheadL: -0.50,
    drumsOverheadR: 0.50,
  },
  targetTrackLevelDbfs: -10,
};

// ─── Lofi ────────────────────────────────────────────────────────────────────
export const StudioLofi: StudioPreset = {
  id: "lofi",
  label: "Lofi",
  eq: {
    lowGainDb: 1.5,
    lowFreqHz: 200,
    midGainDb: -1.0,
    highGainDb: -4.0, // roll off brightness
    highFreqHz: 3200,
  },
  compressor: {
    thresholdDb: -14,
    ratio: 3.5,
    attackSec: 0.008,
    releaseSec: 0.220,
    kneeDb: 6,
  },
  reverb: { decaySec: 1.6, wet: 0.20, preDelayMs: 18 },
  shaperK: 1.8, // extra harmonic grit
  shaperS: SHAPER_S,
  pans: {
    guitarL: -0.30,
    guitarR: 0.30,
    bass: 0,
    drumsOverheadL: -0.45,
    drumsOverheadR: 0.45,
  },
  targetTrackLevelDbfs: -12,
};

export const STUDIO_PRESETS: Record<StudioPresetId, StudioPreset> = {
  clean: StudioClean,
  rock: StudioRock,
  metal: StudioMetal,
  ambient: StudioAmbient,
  lofi: StudioLofi,
};

export const STUDIO_PRESET_LIST: StudioPreset[] = [
  StudioClean,
  StudioRock,
  StudioMetal,
  StudioAmbient,
  StudioLofi,
];

/**
 * Build a 44100-sample WaveShaper curve for a Studio preset.
 * Matches the tab-player helper in `audioPresets.ts` so Studio + tab player
 * share a single saturation model.
 */
export function buildStudioShaperCurve(preset: StudioPreset): Float32Array<ArrayBuffer> {
  const samples = 44100;
  // Fresh ArrayBuffer — required by TS 5.7+ WaveShaperNode.curve typing.
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const k = preset.shaperK;
  const s = preset.shaperS;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * k) * s;
  }
  return curve;
}
