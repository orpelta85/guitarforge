// ── Studio Zustand Store (Phase 7) ──
// Centralizes the Studio session's persistent business state — tracks, mixer,
// transport, project meta — so it can be read from outside StudioPage without
// drilling through 50+ props.  Transient UI state (modals, dropdowns, drag,
// dialogs, drum machine timing) stays as local useState in StudioPage.
//
// The setters intentionally mirror React's `useState` signature so the existing
// component code can keep its `setX(prev => ...)` patterns untouched — only the
// `useState(...)` declaration sites are swapped for store selectors.

"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { TrackRegion } from "@/components/studio/ClipRegion";
import type { StudioPresetId } from "@/lib/studioPresets";

// Mirrors the StudioTrack interface declared in StudioPage.tsx.  Kept here
// (rather than imported) so the store has no circular dependency on the page.
export interface StudioTrack {
  id: number;
  name: string;
  color: string;
  audioBlob: Blob | null;
  audioUrl: string | null;
  volume: number;
  muted: boolean;
  solo: boolean;
  /** Pan in [-1, +1]. */
  pan: number;
  type: "recording" | "import" | "suno" | "drum" | "youtube";
  drumPattern?: boolean[][];
  videoId?: string;
  videoTitle?: string;
  videoThumbnail?: string;
}

// React useState-compatible setter signature: accepts a value or an updater fn.
type SetState<T> = (next: T | ((prev: T) => T)) => void;

export interface StudioState {
  // ── Tracks ──
  tracks: StudioTrack[];
  setTracks: SetState<StudioTrack[]>;

  // ── Transport ──
  playing: boolean;
  setPlaying: SetState<boolean>;
  looping: boolean;
  setLooping: SetState<boolean>;
  currentTime: number;
  setCurrentTime: SetState<number>;
  duration: number;
  setDuration: SetState<number>;

  // ── Master / mixer ──
  bpm: number;
  setBpm: SetState<number>;
  masterVol: number;
  setMasterVol: SetState<number>;
  studioPresetId: StudioPresetId;
  setStudioPresetId: SetState<StudioPresetId>;
  metronomeOn: boolean;
  setMetronomeOn: SetState<boolean>;
  metronomeVolume: number;
  setMetronomeVolume: SetState<number>;

  // ── Project meta ──
  projectName: string;
  setProjectName: SetState<string>;
  projectCreatedAt: number;
  setProjectCreatedAt: SetState<number>;

  // ── Regions (clip-edit data) ──
  regions: TrackRegion[];
  setRegions: SetState<TrackRegion[]>;
}

/**
 * Helper: turn a React-style updater (`val | (prev => val)`) into a flat value
 * given the current value.  Pure helper, kept inline so the store has no
 * external utility dependency.  Exported so sibling stores (jamStore, etc.) can
 * reuse the same React-useState-compatible setter pattern.
 */
export function applyUpdater<T>(updater: T | ((prev: T) => T), prev: T): T {
  return typeof updater === "function"
    ? (updater as (prev: T) => T)(prev)
    : updater;
}

export const useStudioStore = create<StudioState>()(
  subscribeWithSelector((set) => ({
    // ── Tracks ──
    tracks: [],
    setTracks: (next) =>
      set((state) => ({ tracks: applyUpdater(next, state.tracks) })),

    // ── Transport ──
    playing: false,
    setPlaying: (next) =>
      set((state) => ({ playing: applyUpdater(next, state.playing) })),
    looping: false,
    setLooping: (next) =>
      set((state) => ({ looping: applyUpdater(next, state.looping) })),
    currentTime: 0,
    setCurrentTime: (next) =>
      set((state) => ({ currentTime: applyUpdater(next, state.currentTime) })),
    duration: 0,
    setDuration: (next) =>
      set((state) => ({ duration: applyUpdater(next, state.duration) })),

    // ── Master / mixer ──
    bpm: 120,
    setBpm: (next) =>
      set((state) => ({ bpm: applyUpdater(next, state.bpm) })),
    masterVol: 80,
    setMasterVol: (next) =>
      set((state) => ({ masterVol: applyUpdater(next, state.masterVol) })),
    studioPresetId: "rock" as StudioPresetId,
    setStudioPresetId: (next) =>
      set((state) => ({
        studioPresetId: applyUpdater(next, state.studioPresetId),
      })),
    metronomeOn: false,
    setMetronomeOn: (next) =>
      set((state) => ({ metronomeOn: applyUpdater(next, state.metronomeOn) })),
    metronomeVolume: 0.5,
    setMetronomeVolume: (next) =>
      set((state) => ({
        metronomeVolume: applyUpdater(next, state.metronomeVolume),
      })),

    // ── Project meta ──
    projectName: "Untitled",
    setProjectName: (next) =>
      set((state) => ({ projectName: applyUpdater(next, state.projectName) })),
    projectCreatedAt: Date.now(),
    setProjectCreatedAt: (next) =>
      set((state) => ({
        projectCreatedAt: applyUpdater(next, state.projectCreatedAt),
      })),

    // ── Regions ──
    regions: [],
    setRegions: (next) =>
      set((state) => ({ regions: applyUpdater(next, state.regions) })),
  })),
);
