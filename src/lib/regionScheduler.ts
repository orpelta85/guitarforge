// ── RegionScheduler ──
// Region-aware playback for Studio tracks (Phase 3c — was deferred).
//
// A track in Studio can be split into multiple `TrackRegion`s after trim/split/
// move edits.  Before this module the audio side was region-blind: a single
// `Tone.Player.start(when, offset)` call played the entire buffer regardless of
// the regions the user had carved out, so trims and splits were visual-only.
//
// This scheduler fixes that by spawning one `ToneBufferSource` per region per
// playback pass, scheduling each at its `startTime` on the AudioContext clock
// and giving it the correct buffer `offset`+`duration`.  Regions are one-shot:
// each `scheduleRegions` call creates a fresh batch of sources connected to the
// pre-existing FX chain (the same `eq` node the legacy `Tone.Player` used to
// feed into).  Cancellation stops + disposes the active batch.
//
// Why per-region one-shot sources rather than reusing `Tone.Player`?
// `Tone.Player.start()` interrupts any ongoing playback on the same player;
// you cannot schedule N independent sub-region segments on a single Player.
// `ToneBufferSource` is built for exactly this kind of per-event playback and
// is what most DAW timeline engines use under the hood.
//
// Tracks with no regions fall back to the legacy single-`Player.start()` path
// in StudioPage so existing behaviour is preserved.

import type * as ToneNS from "tone";

type ToneModule = typeof ToneNS;

export interface SchedulableRegion {
  startTime: number; // when in the track timeline (seconds)
  duration: number;  // how long to play (seconds)
  offset: number;    // where in the source buffer to start (seconds)
}

export interface RegionScheduler {
  /**
   * Stop any in-flight region sources and schedule a fresh batch.
   * `transportOffset` is the current playhead position in track-timeline
   * seconds — regions ending before that point are skipped, regions
   * straddling it are played from the appropriate buffer offset.
   */
  scheduleRegions(regions: SchedulableRegion[], transportOffset: number): void;
  /** Stop all currently scheduled region sources. */
  cancelAll(): void;
  /** Cancel + permanently release Tone resources. */
  dispose(): void;
}

interface ActiveSource {
  source: ToneNS.ToneBufferSource;
}

/**
 * Build a region scheduler for a single track.
 *
 * @param Tone     The dynamically-imported Tone module (already started).
 * @param buffer   The decoded `ToneAudioBuffer` for this track's audio.
 * @param destination  Tone node that the region sources should connect into —
 *                     this is the head of the per-track FX chain (the `eq`
 *                     node in `SimpleToneNodes`).  Connecting here ensures
 *                     trim/move/split playback gets the same EQ, compression,
 *                     saturation, panning, and volume as the legacy path.
 */
export function createRegionScheduler(
  Tone: ToneModule,
  buffer: ToneNS.ToneAudioBuffer,
  destination: ToneNS.ToneAudioNode,
): RegionScheduler {
  const active: ActiveSource[] = [];

  function stopAndClear(when?: number) {
    for (const a of active) {
      try { a.source.stop(when); } catch { /* already stopped */ }
      try { a.source.dispose(); } catch { /* ok */ }
    }
    active.length = 0;
  }

  return {
    scheduleRegions(regions, transportOffset) {
      stopAndClear();
      if (!buffer || !buffer.loaded) return;
      const bufDur = buffer.duration;
      const now = Tone.now();
      for (const r of regions) {
        // Region wholly in the past — skip.
        const regionEnd = r.startTime + r.duration;
        if (regionEnd <= transportOffset) continue;

        // If transport is inside the region, start from where the playhead is.
        const playOffsetIntoRegion = Math.max(0, transportOffset - r.startTime);
        const bufOffset = r.offset + playOffsetIntoRegion;
        const playDuration = r.duration - playOffsetIntoRegion;
        if (playDuration <= 0.005) continue;

        // Clamp the buffer offset so we never read past the end of the buffer.
        if (bufOffset >= bufDur) continue;
        const safeDuration = Math.min(playDuration, bufDur - bufOffset);

        // Schedule on the AudioContext clock — the rest of StudioPage's
        // playback uses `Tone.now()` directly (not Tone.Transport), so we
        // align with that to keep tracks phase-locked.
        const when = now + Math.max(0, r.startTime - transportOffset);

        const source = new Tone.ToneBufferSource({
          url: buffer,
          fadeIn: 0,
          fadeOut: 0,
        }).connect(destination);
        try {
          source.start(when, bufOffset, safeDuration);
          active.push({ source });
        } catch {
          try { source.dispose(); } catch { /* ok */ }
        }
      }
    },
    cancelAll() {
      stopAndClear();
    },
    dispose() {
      stopAndClear();
    },
  };
}
