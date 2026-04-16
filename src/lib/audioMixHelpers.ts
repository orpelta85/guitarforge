// Shared mixing helpers: log volume curve, equal-power pan law, param smoothing,
// and peak-meter ballistics.  See docs/AUDIO_SPEC.md Section 7 for the rationale
// behind each function and the exact numeric constants.

/**
 * Logarithmic slider → linear gain map.
 *
 * Human loudness perception is roughly logarithmic, so a linear UI slider
 * feels top-heavy — small drags near the top cause huge audible jumps, and
 * the bottom half feels dead.  Applying `gain = slider^exponent` with
 * `exponent ≈ 2.5` makes the fader feel natural at every position.
 *
 * @param sliderValue UI slider position in [0, 1] (clamped).
 * @param exponent    Curve steepness (2.5 recommended by AUDIO_SPEC §7.1).
 * @returns Linear gain in [0, 1].
 */
export function sliderToGain(sliderValue: number, exponent = 2.5): number {
  if (sliderValue <= 0) return 0;
  if (sliderValue >= 1) return 1;
  return Math.pow(sliderValue, exponent);
}

/**
 * Equal-power pan law — constant perceived loudness across the stereo field.
 *
 * `StereoPannerNode` uses a linear-ish law that causes an audible -3 dB dip
 * as a sound pans through the centre.  Equal-power sine/cosine weighting
 * avoids the "hole in the middle" and is the industry standard for music
 * mixing.
 *
 * @param panValue Pan in [-1, +1] (clamped).  -1 = full left, 0 = centre,
 *                 +1 = full right.
 * @returns Pair of linear channel gains.
 */
export function equalPowerPan(panValue: number): { left: number; right: number } {
  const clamped = Math.max(-1, Math.min(1, panValue));
  // Map [-1, +1] → [0, π/2].  At pan=0 both channels = cos(π/4) = sin(π/4) ≈ 0.707 (-3 dB).
  const x = ((clamped + 1) * 0.5) * (Math.PI / 2);
  return { left: Math.cos(x), right: Math.sin(x) };
}

/**
 * Smooth a Web-Audio `AudioParam` towards a target using `setTargetAtTime`.
 *
 * Assigning to `gain.value` during playback causes zipper noise because the
 * change is applied instantaneously on every audio tick.  Using an exponential
 * approach with a short time constant (tau ~ 15 ms) is inaudible latency-wise
 * but completely removes the zipper artefact.
 *
 * @param param   The AudioParam to update.
 * @param target  New target value in the param's native units.
 * @param now     `ctx.currentTime` at the call site.
 * @param tauMs   Time constant in milliseconds (15 ms recommended).
 */
export function smoothParam(
  param: AudioParam,
  target: number,
  now: number,
  tauMs = 15,
): void {
  const tauSec = tauMs / 1000;
  // Cancel any previously scheduled automations so the new target wins.
  try {
    param.cancelScheduledValues(now);
  } catch {
    /* some older engines throw on empty automation lists — safe to ignore */
  }
  param.setTargetAtTime(target, now, tauSec);
}

/**
 * Peak-meter ballistics with a 1200 ms hold + 20 dB/sec decay.
 *
 * Call once per UI frame (typically 20 ms / 50 Hz) with the latest measured
 * peak.  Returns the value the meter should actually display and the updated
 * "peak-hold" reading (drawn as a stationary tick above the bar).
 *
 * @param currentDb       Latest measured peak in linear gain [0, 1+].
 * @param peakHeldDb      Previous held-peak value in linear gain.
 * @param now             Current wall time in seconds (e.g. `performance.now() / 1000`).
 * @param lastPeakTimeMs  Wall time (ms) at which the last peak hit — used to
 *                        decide when the 1200 ms hold window expires.
 * @returns Display value + updated held-peak snapshot for the next frame.
 */
export function peakMeterDecay(
  currentDb: number,
  peakHeldDb: number,
  now: number,
  lastPeakTimeMs: number,
): { display: number; newPeakHeld: number } {
  const HOLD_SEC = 1.2;
  const DECAY_DB_PER_SEC = 20;
  const DT_SEC = 0.020; // 20 ms assumed per tick (50 Hz redraw).

  const nowMs = now * 1000;
  const holdExpired = nowMs - lastPeakTimeMs > HOLD_SEC * 1000;

  // New absolute peak overrides everything.
  if (currentDb > peakHeldDb) {
    return { display: currentDb, newPeakHeld: currentDb };
  }

  // Inside the hold window: freeze the held value, display it.
  if (!holdExpired) {
    return { display: peakHeldDb, newPeakHeld: peakHeldDb };
  }

  // After the hold window expires: decay linearly in dB, which is an
  // exponential multiply in linear gain.  -20 dB/sec = x0.1 per second.
  const factor = Math.pow(10, (-DECAY_DB_PER_SEC * DT_SEC) / 20);
  const decayed = peakHeldDb * factor;
  return { display: decayed, newPeakHeld: decayed };
}
