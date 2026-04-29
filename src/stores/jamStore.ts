// ── Jam Mode Zustand Store (Phase 7 Part 4) ──
// Centralizes the Jam page's persistent settings (key, scale, style,
// progression, BPM, mixer, instrument toggles, AI track config) so they can be
// read/persisted without prop-drilling through the 2,200-line JamModePage.
//
// Transient state stays as local useState in JamModePage:
//   - chordFlash, currentBeat, currentChordIdx (real-time playback state)
//   - playing, paused, toneLoaded (audio engine state)
//   - isRecordingJam, recordElapsed, jam-save-dialog (recording session)
//   - showSettings dropdown (UI transient)
//   - aiPanelOpen, aiLoading, aiError, aiPlaying (Suno UI ephemeral state)
//
// AI track *content* (url, title) is currently transient — it is not lifted
// here either, because it lives only for the active session.
//
// The setters mirror React's `useState` signature so existing component code
// can keep `setSettings(prev => ...)` patterns untouched.

"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { applyUpdater } from "./studioStore";
import type { JamStyleKey } from "@/lib/constants";

// String-literal unions duplicated from JamModePage.  Kept local to avoid a
// circular dependency: JamModePage already imports from this store, so this
// file cannot import types declared inside JamModePage.tsx.
export type GrooveStyleName =
  | "rock"
  | "metal"
  | "blues"
  | "jazz"
  | "funk"
  | "punk"
  | "ballad"
  | "latin"
  | "reggae"
  | "country";

export type DrumStyleName =
  | "rock"
  | "metal"
  | "blues_shuffle"
  | "jazz"
  | "funk"
  | "punk"
  | "ballad"
  | "latin"
  | "reggae"
  | "country";

export type BassStyleName =
  | "rock"
  | "metal"
  | "blues"
  | "jazz"
  | "funk"
  | "punk"
  | "ballad"
  | "reggae";

// Mirrors the JamSettings interface inside JamModePage.tsx.  Keep in sync.
export interface JamSettings {
  key: string;
  style: JamStyleKey;
  progressionIndex: number;
  bpm: number;
  barsPerChord: number;
  loop: boolean;
  randomMode: boolean;
  metronomeVol: number;
  bassVol: number;
  drumVol: number;
  guitarVol: number;
  aiTrackVol: number;
  bassEnabled: boolean;
  drumEnabled: boolean;
  guitarEnabled: boolean;
  aiTrackEnabled: boolean;
  grooveStyle: GrooveStyleName;
  scaleType: "natural" | "pentatonic" | "blues";
  // Legacy fields kept for backwards compatibility with existing localStorage
  drumStyle?: DrumStyleName;
  bassStyle?: BassStyleName;
  genre?: string;
}

export const DEFAULT_JAM_SETTINGS: JamSettings = {
  key: "Am",
  style: "blues",
  progressionIndex: 0,
  bpm: 100,
  barsPerChord: 2,
  loop: true,
  randomMode: false,
  metronomeVol: 0.9,
  bassVol: 0.4,
  drumVol: 0.3,
  guitarVol: 0.5,
  aiTrackVol: 0.6,
  bassEnabled: false,
  drumEnabled: false,
  guitarEnabled: false,
  aiTrackEnabled: false,
  grooveStyle: "blues",
  scaleType: "pentatonic",
};

type SetState<T> = (next: T | ((prev: T) => T)) => void;

export interface JamState {
  settings: JamSettings;
  setSettings: SetState<JamSettings>;
  /** Convenience: update a single field while preserving the rest. */
  updateSetting: <K extends keyof JamSettings>(
    key: K,
    value: JamSettings[K],
  ) => void;
}

export const useJamStore = create<JamState>()(
  subscribeWithSelector((set) => ({
    settings: DEFAULT_JAM_SETTINGS,
    setSettings: (next) =>
      set((state) => ({ settings: applyUpdater(next, state.settings) })),
    updateSetting: (key, value) =>
      set((state) => ({ settings: { ...state.settings, [key]: value } })),
  })),
);
