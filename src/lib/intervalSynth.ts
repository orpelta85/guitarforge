// Learning Center interval / note playback voice.
// 3-oscillator detuned blend → ADSR → low-pass → master + shared room-reverb send.
// See docs/AUDIO_SPEC.md Section 6 for parameter rationale.

import { buildCabinetIR, MediumRoom } from "./audioIr";

// ─── Voice parameters (§6.2) ─────────────────────────────────────────────────

const OSC_SPECS: Array<{ type: OscillatorType; cents: number; mix: number }> = [
  { type: "sine", cents: 0, mix: 0.55 },
  { type: "triangle", cents: 4, mix: 0.35 },
  { type: "sawtooth", cents: -4, mix: 0.10 },
];

const ATTACK_SEC = 0.012; // 12 ms
const DECAY_SEC = 0.180; // 180 ms to sustain
const SUSTAIN_LEVEL = 0.55;
const RELEASE_SEC = 0.320; // 320 ms
const HOLD_SEC = 0.520; // note-on time before release kicks in

const LP_FREQ = 5500;
const LP_Q = 0.707;
const MASTER_GAIN = 0.35;
const WET_SEND = 0.18;

// ─── Shared room convolver cache (per AudioContext) ──────────────────────────

const reverbCache = new WeakMap<AudioContext, ConvolverNode>();
const reverbBufferPending = new WeakSet<AudioContext>();

// Returns a ConvolverNode synchronously (so callers can wire it inline).
// The IR buffer is loaded asynchronously on first request — until it lands,
// the convolver passes signal through with an empty buffer (no reverb yet).
// In practice this is inaudible: the wet send is only 0.18, and IR fetch /
// synth completes in well under 100 ms.
function getRoomReverb(ctx: AudioContext): ConvolverNode {
  const existing = reverbCache.get(ctx);
  if (existing) return existing;
  const conv = ctx.createConvolver();
  reverbCache.set(ctx, conv);
  if (!reverbBufferPending.has(ctx)) {
    reverbBufferPending.add(ctx);
    void buildCabinetIR(ctx, MediumRoom).then((buf) => {
      try { conv.buffer = buf; } catch { /* ctx closed */ }
    });
  }
  return conv;
}

// ─── Single-note voice ───────────────────────────────────────────────────────

export interface PlayNoteOptions {
  // Total note-on time (ms) before release starts. Default: 520 ms per spec.
  holdMs?: number;
  // Reverb wet level (linear). Default: 0.18 per spec.
  wet?: number;
}

/**
 * Play a single note through the Learning Center voice (3-osc blend + ADSR + reverb send).
 *
 * `destination` is where dry + wet land. Pass `ctx.destination` for straightforward
 * routing; pass a custom gain node to meter or further process the output.
 */
export function playNote(
  ctx: AudioContext,
  destination: AudioNode,
  frequencyHz: number,
  durationMs?: number,
  options: PlayNoteOptions = {},
): void {
  const now = ctx.currentTime;
  const holdSec = durationMs != null ? durationMs / 1000 : options.holdMs != null ? options.holdMs / 1000 : HOLD_SEC;
  const wet = options.wet ?? WET_SEND;

  // ADSR envelope — single gain node rides the attack/decay/sustain/release curve.
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0, now);
  envGain.gain.linearRampToValueAtTime(1.0, now + ATTACK_SEC);
  envGain.gain.linearRampToValueAtTime(
    SUSTAIN_LEVEL,
    now + ATTACK_SEC + DECAY_SEC,
  );
  envGain.gain.setValueAtTime(SUSTAIN_LEVEL, now + holdSec);
  envGain.gain.linearRampToValueAtTime(0.0001, now + holdSec + RELEASE_SEC);

  // Per-note low-pass — tames oscillator harshness at higher pitches.
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = LP_FREQ;
  lp.Q.value = LP_Q;

  // Master velocity gain (constant) — spec §6.2.
  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN;

  // Reverb wet send into shared room convolver.
  const wetSend = ctx.createGain();
  wetSend.gain.value = wet;

  // Build the 3 detuned oscillators, sum into envGain through per-oscillator mix.
  const stopTime = now + holdSec + RELEASE_SEC + 0.05;
  for (const spec of OSC_SPECS) {
    const o = ctx.createOscillator();
    o.type = spec.type;
    o.frequency.value = frequencyHz * Math.pow(2, spec.cents / 1200);
    const mixGain = ctx.createGain();
    mixGain.gain.value = spec.mix;
    o.connect(mixGain).connect(envGain);
    o.start(now);
    o.stop(stopTime);
  }

  // Dry + wet routing.
  envGain.connect(lp).connect(master);
  master.connect(destination);
  const reverb = getRoomReverb(ctx);
  master.connect(wetSend).connect(reverb).connect(destination);
}

// ─── Interval helper ─────────────────────────────────────────────────────────

export type IntervalMode = "harmonic" | "melodic";

/**
 * Play two notes either simultaneously (harmonic) or sequentially (melodic).
 * `durationMs` is the per-note hold time; melodic mode schedules the 2nd note
 * after the 1st has had ~1.1x its hold time on the timeline.
 */
export function playInterval(
  ctx: AudioContext,
  destination: AudioNode,
  freq1: number,
  freq2: number,
  mode: IntervalMode,
  durationMs = 600,
): void {
  if (mode === "harmonic") {
    playNote(ctx, destination, freq1, durationMs);
    playNote(ctx, destination, freq2, durationMs);
    return;
  }
  // Melodic — second note starts after the first's hold time plus a small gap.
  playNote(ctx, destination, freq1, durationMs);
  const gapSec = 0.7; // matches LearningCenterPage.tsx historical 0.7s spacing
  setTimeout(() => {
    // Context may have been closed while we waited — guard.
    if (ctx.state === "closed") return;
    playNote(ctx, destination, freq2, durationMs);
  }, gapSec * 1000);
}
