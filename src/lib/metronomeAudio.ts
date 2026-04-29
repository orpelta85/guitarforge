/**
 * Shared metronome audio helpers.
 * - Persists user-controlled volume in localStorage under `gf-metronome-volume` (0.0 - 1.0).
 * - Provides a tuned `clickGain` helper that scales the historical per-click gain
 *   (accent / normal / sub) by user volume while clamping well below clipping (cap 0.9).
 */

export const METRONOME_VOL_KEY = "gf-metronome-volume";
export const BACKING_COUNTIN_KEY = "gf-backing-countin";

/** Default volume: louder than historical (~2.5x boost at 1.0). */
export const DEFAULT_METRONOME_VOLUME = 1.0;

export function loadMetronomeVolume(): number {
  if (typeof window === "undefined") return DEFAULT_METRONOME_VOLUME;
  try {
    const raw = localStorage.getItem(METRONOME_VOL_KEY);
    if (raw == null) return DEFAULT_METRONOME_VOLUME;
    const n = parseFloat(raw);
    if (!isFinite(n)) return DEFAULT_METRONOME_VOLUME;
    return Math.max(0, Math.min(1, n));
  } catch {
    return DEFAULT_METRONOME_VOLUME;
  }
}

export function saveMetronomeVolume(v: number) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(METRONOME_VOL_KEY, String(Math.max(0, Math.min(1, v)))); } catch { /* ok */ }
}

/**
 * Historical base gain values were: accent 0.4, normal 0.2, sub 0.1.
 * Boosted ~4x from historical (3x + extra 50%) and clamped just under 1.0.
 */
export function clickGain(kind: "accent" | "normal" | "sub", userVol: number): number {
  const base = kind === "accent" ? 1.65 : kind === "normal" ? 1.05 : 0.525;
  const v = Math.max(0, Math.min(1, userVol));
  return Math.min(0.98, base * v);
}

export function loadBackingCountIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(BACKING_COUNTIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveBackingCountIn(on: boolean) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(BACKING_COUNTIN_KEY, on ? "1" : "0"); } catch { /* ok */ }
}

/**
 * Play N metronome clicks in a row on a freshly-created AudioContext, then resolve.
 * Used for count-in before a backing track starts.
 *
 * Uses the shared `buildMetronomeClicks` buffer synth (wood-block FM) — same
 * timbre as MetronomeBox / LooperBox / Tab Player metronomes.
 */
export async function playCountIn(opts: { bpm?: number; beats?: number; volume?: number } = {}): Promise<void> {
  const bpm = opts.bpm && opts.bpm > 0 ? opts.bpm : 120;
  const beats = opts.beats ?? 4;
  const userVol = opts.volume ?? loadMetronomeVolume();
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx({ sampleRate: 48000, latencyHint: "interactive" });
  if (ctx.state === "suspended") { try { await ctx.resume(); } catch { /* ok */ } }
  // Lazy import to avoid widening the module's dep graph at SSR time.
  const { buildMetronomeClicks } = await import("./metronomeSynth");
  const buffers = buildMetronomeClicks(ctx);
  const secsPerBeat = 60 / bpm;
  const start = ctx.currentTime + 0.05;
  for (let i = 0; i < beats; i++) {
    const t = start + i * secsPerBeat;
    const accent = i === 0;
    const source = ctx.createBufferSource();
    source.buffer = accent ? buffers.accent : buffers.normal;
    const gain = ctx.createGain();
    gain.gain.value = clickGain(accent ? "accent" : "normal", userVol);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(t);
  }
  const totalMs = beats * secsPerBeat * 1000 + 120;
  await new Promise((r) => setTimeout(r, totalMs));
  try { await ctx.close(); } catch { /* ok */ }
}
