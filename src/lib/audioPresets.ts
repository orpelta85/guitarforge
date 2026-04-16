// Tab-player effect-chain presets.
// See docs/AUDIO_SPEC.md Section 2 for the signal graph + per-preset values.

import type { CabinetPresetName } from "./audioIr";

export type TabPlayerPresetId = "metal" | "rock" | "clean";

export interface TabPlayerPreset {
  id: TabPlayerPresetId;
  label: string;

  // Cabinet + room IR selection.
  cabinet: CabinetPresetName;
  room: CabinetPresetName; // always "room_studio_medium" for now, typed wider for flexibility

  // Input high-pass (before the shaper).
  highPassHz: number;
  highPassQ: number;

  // WaveShaper curve: curve[i] = tanh(x * shaperK) * shaperS, x in [-1, 1].
  shaperK: number;
  shaperS: number;
  shaperOversample: OverSampleType;

  // Level trim after the cabinet convolver — convolution changes level.
  postCabGain: number;

  // Dynamics compressor (main tone compressor, not the master limiter).
  compThresholdDb: number;
  compRatio: number;
  compAttackSec: number;
  compReleaseSec: number;
  compKneeDb: number;

  // Default room send wet level (linear). Dry = 1 - (wet * 0.5).
  roomWetDefault: number;

  // Master brick-wall limiter (identical across presets, but kept per-preset so
  // future tweaks stay local).
  limiterThresholdDb: number;
  limiterRatio: number;
  limiterAttackSec: number;
  limiterReleaseSec: number;
  limiterKneeDb: number;
}

// ─── Metal ───────────────────────────────────────────────────────────────────
export const MetalPreset: TabPlayerPreset = {
  id: "metal",
  label: "Metal",
  cabinet: "mesa_v30_highgain",
  room: "room_studio_medium",
  highPassHz: 95,
  highPassQ: 0.707,
  shaperK: 2.2,
  shaperS: 0.88,
  shaperOversample: "4x",
  postCabGain: 1.8,
  compThresholdDb: -14,
  compRatio: 4,
  compAttackSec: 0.003,
  compReleaseSec: 0.120,
  compKneeDb: 6,
  roomWetDefault: 0.12,
  limiterThresholdDb: -1.0,
  limiterRatio: 20,
  limiterAttackSec: 0.002,
  limiterReleaseSec: 0.050,
  limiterKneeDb: 0,
};

// ─── Rock ────────────────────────────────────────────────────────────────────
export const RockPreset: TabPlayerPreset = {
  id: "rock",
  label: "Rock",
  cabinet: "marshall_1960_rock",
  room: "room_studio_medium",
  highPassHz: 80,
  highPassQ: 0.707,
  shaperK: 1.6,
  shaperS: 0.92,
  shaperOversample: "4x",
  postCabGain: 1.6,
  compThresholdDb: -10,
  compRatio: 3,
  compAttackSec: 0.006,
  compReleaseSec: 0.180,
  compKneeDb: 8,
  roomWetDefault: 0.15,
  limiterThresholdDb: -1.0,
  limiterRatio: 20,
  limiterAttackSec: 0.002,
  limiterReleaseSec: 0.050,
  limiterKneeDb: 0,
};

// ─── Clean ───────────────────────────────────────────────────────────────────
export const CleanPreset: TabPlayerPreset = {
  id: "clean",
  label: "Clean",
  cabinet: "fender_twin_clean",
  room: "room_studio_medium",
  highPassHz: 70,
  highPassQ: 0.707,
  shaperK: 1.1,
  shaperS: 0.98,
  shaperOversample: "2x",
  postCabGain: 1.4,
  compThresholdDb: -8,
  compRatio: 2.5,
  compAttackSec: 0.010,
  compReleaseSec: 0.220,
  compKneeDb: 10,
  roomWetDefault: 0.22,
  limiterThresholdDb: -1.0,
  limiterRatio: 20,
  limiterAttackSec: 0.002,
  limiterReleaseSec: 0.050,
  limiterKneeDb: 0,
};

export const TAB_PLAYER_PRESETS: Record<TabPlayerPresetId, TabPlayerPreset> = {
  metal: MetalPreset,
  rock: RockPreset,
  clean: CleanPreset,
};

export const TAB_PLAYER_PRESET_LIST: TabPlayerPreset[] = [
  MetalPreset,
  RockPreset,
  CleanPreset,
];

/** Build the WaveShaper curve for a given preset. 44100-sample table. */
export function buildShaperCurve(preset: TabPlayerPreset): Float32Array<ArrayBuffer> {
  const samples = 44100;
  // Allocate a fresh ArrayBuffer so the result is Float32Array<ArrayBuffer>
  // (required by lib.dom `WaveShaperNode.curve` in TS 5.7+ — not ArrayBufferLike).
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const k = preset.shaperK;
  const s = preset.shaperS;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * k) * s;
  }
  return curve;
}
