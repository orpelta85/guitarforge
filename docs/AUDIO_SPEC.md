# GuitarForge Audio Engineering Specification

**Document status:** Implementation-ready. Every parameter is a final decision — no audio-engineering judgement remains for the Dev Engineer. If a value is unclear, default to the `Metal` preset since the primary user is a metal/rock guitarist.

**Scope:** Full audio overhaul across tab player, Jam Mode, Studio presets, metronome, Learning Center intervals, mixing controls, and dual-channel recording.

**Rationale (read first):** The current tab player uses random-noise-based "reverb" and synthetic oscillator cabinet modeling. That is why it sounds cheap compared to real Guitar Pro. Real Guitar Pro uses convolution against *real speaker impulse responses* captured from miked 4x12 cabs. We cannot ship with hosted IR dependencies (license + reliability issues), so we generate IRs *mathematically* using a physically-motivated model: a set of resonant peaks (speaker cone resonances), a notch pattern (cabinet comb filtering from mic placement), a short dense early-reflection tail (box interior), and a fast exponential decay. The result is 100–300 ms of deterministic buffer that behaves like a real cab IR in a `ConvolverNode`. This is the single most important change in the document.

---

## Signal conventions used throughout this spec

- All time values are in **seconds** unless suffixed `ms`.
- All frequencies are in **Hz**.
- All gains are in **linear** (0–1+) or **dB** — suffix explicit.
- Web Audio `DynamicsCompressorNode`: `threshold` in dB, `ratio` unitless, `attack`/`release` in seconds, `knee` in dB.
- All IR sample rates target **44100 Hz** (match AudioContext default; works for 48k contexts via the browser's built-in resampler in `ConvolverNode`).
- When this spec says "convert dB to linear gain": `linear = 10 ** (dB / 20)`.

---

## 1. Cabinet IRs — Programmatic Generation

We generate **4 cabinet IRs** and **1 room IR** at runtime (or build-time — either works, runtime is fine because total CPU is <50 ms).

Each IR is a stereo `AudioBuffer`, sample rate = `ctx.sampleRate`, channels = 2 (mono duplicated with a 3-sample offset on the right channel for natural stereo width, matching current code at `GpFileUploader.tsx:297`).

### 1.0 Shared IR builder — pseudo-code

This is the common scaffold every preset uses. Only the parameter table below changes between presets.

```ts
interface CabinetPreset {
  name: string;
  lengthSec: number;            // total IR length
  resonances: Array<{ freq: number; amp: number; decay: number }>; // sum of damped sines
  notches: Array<{ freq: number; depth: number; decay: number }>;  // subtracted (mic-placement combing)
  earlyReflections: Array<{ timeMs: number; amp: number; stereo: number }>; // stereo: +1 = L louder, -1 = R louder
  noiseAmp: number;             // broadband transient energy at t=0
  masterDecay: number;          // overall exponential envelope (1/sec)
  preEmphasis: { freq: number; gainDb: number }; // peak EQ baked into IR
  lowCut: number;               // Hz, one-pole HP baked in
  highCut: number;              // Hz, one-pole LP baked in
}

function buildCabinetIR(ctx: AudioContext, p: CabinetPreset): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * p.lengthSec);
  const buf = ctx.createBuffer(2, len, sr);

  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let s = 0;

      // Sum of damped sinusoidal resonances (speaker cone + cab body)
      for (const r of p.resonances) {
        s += Math.sin(2 * Math.PI * r.freq * t) * Math.exp(-t * r.decay) * r.amp;
      }

      // Subtract notches (mic placement combing)
      for (const n of p.notches) {
        s -= Math.sin(2 * Math.PI * n.freq * t) * Math.exp(-t * n.decay) * n.depth;
      }

      // Early reflections: discrete impulses at specific delays
      for (const e of p.earlyReflections) {
        const sampleIdx = Math.floor(e.timeMs * 0.001 * sr);
        if (i === sampleIdx) {
          // stereo: +1 means L gets 1.0x, R gets (1 - |stereo|*0.3)
          const chGain = ch === 0
            ? (e.stereo >= 0 ? 1 : 1 + e.stereo * 0.3)
            : (e.stereo <= 0 ? 1 : 1 - e.stereo * 0.3);
          s += e.amp * chGain;
        }
      }

      // Transient broadband noise (simulates initial air impulse)
      s += (Math.random() * 2 - 1) * Math.exp(-t * 400) * p.noiseAmp;

      // Master exponential envelope
      s *= Math.exp(-t * p.masterDecay);

      d[i] = s;
    }

    // Apply pre-emphasis peak EQ (biquad peaking, baked in via simple IIR)
    // one-pole HP at lowCut, one-pole LP at highCut — applied in-place
    applyOnePoleHP(d, sr, p.lowCut);
    applyOnePoleLP(d, sr, p.highCut);
    applyPeakingEQ(d, sr, p.preEmphasis.freq, 10 ** (p.preEmphasis.gainDb / 20), 1.0);

    // Natural stereo width: right channel delayed 3 samples + scaled
    if (ch === 1) {
      for (let i = len - 1; i >= 3; i--) {
        d[i] = d[i] * 0.92 + d[i - 3] * 0.12;
      }
    }
  }

  // Normalize so peak = 0.5 (leaves headroom; convolver is unity-ish)
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) if (Math.abs(d[i]) > peak) peak = Math.abs(d[i]);
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

// Helper filters (standard DSP — Dev can copy verbatim):
function applyOnePoleHP(data: Float32Array, sr: number, fc: number) {
  const rc = 1 / (2 * Math.PI * fc);
  const dt = 1 / sr;
  const a = rc / (rc + dt);
  let prevIn = 0, prevOut = 0;
  for (let i = 0; i < data.length; i++) {
    const out = a * (prevOut + data[i] - prevIn);
    prevIn = data[i];
    prevOut = out;
    data[i] = out;
  }
}
function applyOnePoleLP(data: Float32Array, sr: number, fc: number) {
  const rc = 1 / (2 * Math.PI * fc);
  const dt = 1 / sr;
  const a = dt / (rc + dt);
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    prev = prev + a * (data[i] - prev);
    data[i] = prev;
  }
}
function applyPeakingEQ(data: Float32Array, sr: number, f0: number, linearGain: number, Q: number) {
  // RBJ peaking biquad
  const A = Math.sqrt(linearGain);
  const w0 = 2 * Math.PI * f0 / sr;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw = Math.cos(w0);
  const b0 =  1 + alpha * A;
  const b1 = -2 * cosw;
  const b2 =  1 - alpha * A;
  const a0 =  1 + alpha / A;
  const a1 = -2 * cosw;
  const a2 =  1 - alpha / A;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    data[i] = y0;
  }
}
```

### 1.1 Preset A — `mesa_v30_highgain` (Mesa Rectifier 4x12 w/ V30, SM57 on-axis close)

Target: modern metal chug and scooped lead. Tight low end, aggressive upper-mid bite around 2.5 kHz, rolled-off highs past 6.5 kHz.

| Param | Value |
|---|---|
| `lengthSec` | `0.120` |
| `resonances` | `[{freq: 95, amp: 1.0, decay: 55}, {freq: 220, amp: 0.45, decay: 70}, {freq: 480, amp: 0.30, decay: 90}, {freq: 1100, amp: 0.55, decay: 110}, {freq: 2500, amp: 0.80, decay: 130}, {freq: 4200, amp: 0.35, decay: 180}]` |
| `notches` | `[{freq: 350, depth: 0.35, decay: 80}, {freq: 750, depth: 0.25, decay: 95}]` |
| `earlyReflections` | `[{timeMs: 1.2, amp: 0.25, stereo: 0}, {timeMs: 3.5, amp: 0.15, stereo: 0.4}, {timeMs: 7.8, amp: 0.10, stereo: -0.4}]` |
| `noiseAmp` | `0.18` |
| `masterDecay` | `28` |
| `preEmphasis` | `{freq: 2500, gainDb: +4.5}` |
| `lowCut` | `85` |
| `highCut` | `6500` |

### 1.2 Preset B — `marshall_1960_rock` (Marshall 1960A 4x12 w/ G12T-75, SM57 slightly off-axis)

Target: classic rock crunch, open and punchy, broader mids, not scooped.

| Param | Value |
|---|---|
| `lengthSec` | `0.140` |
| `resonances` | `[{freq: 110, amp: 0.85, decay: 50}, {freq: 260, amp: 0.55, decay: 65}, {freq: 680, amp: 0.60, decay: 85}, {freq: 1800, amp: 0.70, decay: 120}, {freq: 3600, amp: 0.45, decay: 160}, {freq: 5200, amp: 0.25, decay: 220}]` |
| `notches` | `[{freq: 420, depth: 0.20, decay: 75}]` |
| `earlyReflections` | `[{timeMs: 1.8, amp: 0.28, stereo: 0.3}, {timeMs: 4.2, amp: 0.18, stereo: -0.3}, {timeMs: 9.1, amp: 0.12, stereo: 0.5}]` |
| `noiseAmp` | `0.14` |
| `masterDecay` | `22` |
| `preEmphasis` | `{freq: 1800, gainDb: +3.0}` |
| `lowCut` | `80` |
| `highCut` | `7500` |

### 1.3 Preset C — `fender_twin_clean` (Fender Twin 2x12 w/ Jensen, condenser mid-cone)

Target: sparkling clean, tight low-mid, extended highs, no notching.

| Param | Value |
|---|---|
| `lengthSec` | `0.160` |
| `resonances` | `[{freq: 130, amp: 0.70, decay: 40}, {freq: 320, amp: 0.50, decay: 60}, {freq: 900, amp: 0.55, decay: 80}, {freq: 2200, amp: 0.60, decay: 110}, {freq: 4800, amp: 0.55, decay: 150}, {freq: 7800, amp: 0.30, decay: 200}]` |
| `notches` | `[]` |
| `earlyReflections` | `[{timeMs: 2.5, amp: 0.22, stereo: 0.2}, {timeMs: 5.8, amp: 0.15, stereo: -0.2}, {timeMs: 12.3, amp: 0.10, stereo: 0.4}]` |
| `noiseAmp` | `0.10` |
| `masterDecay` | `18` |
| `preEmphasis` | `{freq: 4500, gainDb: +2.5}` |
| `lowCut` | `75` |
| `highCut` | `10000` |

### 1.4 Preset D — `room_studio_medium` (Spatial room IR — used as send FX, not cabinet replacement)

Target: subtle studio room ambience to add dimension after cab. Keep short so it does not smear transients.

| Param | Value |
|---|---|
| `lengthSec` | `0.450` |
| `resonances` | `[]` |
| `notches` | `[]` |
| `earlyReflections` | `[{timeMs: 8, amp: 0.35, stereo: 0.6}, {timeMs: 14, amp: 0.28, stereo: -0.6}, {timeMs: 22, amp: 0.22, stereo: 0.3}, {timeMs: 31, amp: 0.18, stereo: -0.3}, {timeMs: 43, amp: 0.14, stereo: 0.5}, {timeMs: 58, amp: 0.10, stereo: -0.5}, {timeMs: 76, amp: 0.08, stereo: 0}]` |
| `noiseAmp` | `0` |
| `masterDecay` | `6` |
| `preEmphasis` | `{freq: 500, gainDb: -1.5}` |
| `lowCut` | `120` |
| `highCut` | `9000` |

For the late diffuse tail on the room IR only, add this after the discrete reflections loop:

```ts
// After the earlyReflections loop, for i > sampleRate * 0.060:
if (t > 0.060) {
  const decorr = ch === 0 ? 1 : -1;       // simple L/R decorrelation
  s += (Math.random() * 2 - 1) * decorr * Math.exp(-(t - 0.060) * 8) * 0.12;
}
```

### 1.5 Caching / generation strategy

- Build all 5 IRs **once** the first time `GpFileUploader` mounts in a session (total ≈30–50 ms CPU).
- Store in a module-level `Map<string, AudioBuffer>` keyed by `${presetName}@${sampleRate}`.
- Do **not** save to `/public/audio/ir/` — generation is cheap and avoids a build-step dependency. If later profiling shows a need, WAV-serialize at build time using the `audioBufferToWav` helper already present in `src/lib/audioMix.ts`.
- No external URLs. No npm dependencies.

---

## 2. Tab Player Effect Chain (`GpFileUploader.tsx`)

Replace the current chain in `enhanceAudioOutput` (lines 346-433) with the following. The wiring order is fixed; only the numeric parameters change per preset.

### 2.1 Fixed signal graph

```
alphaTab output
  -> HighPass (biquad, type "highpass")
  -> WaveShaper (saturation curve)
  -> Cabinet ConvolverNode (preset A / B / C)
  -> PostCabGain (trim after convolver — convolution changes level)
  -> DynamicsCompressor
  -> Split:
       dry -> DryGain ---------------> Sum
       wet -> Room ConvolverNode -> WetGain -> Sum
  -> Sum (implicit — both gains feed the limiter)
  -> Master DynamicsCompressor (limiter)
  -> ctx.destination
```

Remove the `lowpass 6000Hz` stage entirely — the cabinet IR's `highCut` now handles the top-end roll-off with far more character than a single biquad.

### 2.2 Preset matrix

| Param | Metal | Rock | Clean |
|---|---|---|---|
| Cabinet IR preset | `mesa_v30_highgain` | `marshall_1960_rock` | `fender_twin_clean` |
| HighPass `frequency` (Hz) | `95` | `80` | `70` |
| HighPass `Q` | `0.707` | `0.707` | `0.707` |
| WaveShaper curve formula | `tanh(x * 2.2) * 0.88` | `tanh(x * 1.6) * 0.92` | `tanh(x * 1.1) * 0.98` |
| WaveShaper `oversample` | `"4x"` | `"4x"` | `"2x"` |
| PostCabGain (linear) | `1.8` | `1.6` | `1.4` |
| Compressor `threshold` (dB) | `-14` | `-10` | `-8` |
| Compressor `ratio` | `4` | `3` | `2.5` |
| Compressor `attack` (s) | `0.003` | `0.006` | `0.010` |
| Compressor `release` (s) | `0.120` | `0.180` | `0.220` |
| Compressor `knee` (dB) | `6` | `8` | `10` |
| Room wet level default (linear) | `0.12` | `0.15` | `0.22` |
| Room dry level | `1.0 - (wet * 0.5)` | same | same |
| Limiter `threshold` (dB) | `-1.0` | `-1.0` | `-1.0` |
| Limiter `ratio` | `20` | `20` | `20` |
| Limiter `attack` (s) | `0.002` | `0.002` | `0.002` |
| Limiter `release` (s) | `0.050` | `0.050` | `0.050` |
| Limiter `knee` (dB) | `0` | `0` | `0` |

### 2.3 WaveShaper curve generation

Replace `createWarmSaturation` (lines 306–317). The curve table has `samples = 44100` entries. For preset `P` with shape formula `tanh(x * k) * s`:

```ts
const curve = new Float32Array(44100);
for (let i = 0; i < 44100; i++) {
  const x = (i * 2) / 44100 - 1;          // x in [-1, 1]
  curve[i] = Math.tanh(x * k) * s;        // k and s from preset table
}
shaper.curve = curve;
shaper.oversample = preset.oversample;    // "4x" for Metal/Rock, "2x" for Clean
```

### 2.4 Preset switching UI contract

- Default preset on first load: **Metal** (user is a metal/rock guitarist).
- Add a 3-position toggle (Metal / Rock / Clean) in the existing tab player toolbar near the reverb toggle.
- Preset choice persists in `localStorage` under key `gf.tabplayer.preset` (values: `"metal"` | `"rock"` | `"clean"`).
- On preset change while playing: crossfade parameters over 50 ms using `linearRampToValueAtTime`. Cabinet IR swap is instant (rebuild the convolver node — the <1ms audio gap is inaudible).

### 2.5 Reverb control mapping

The existing `reverbEnabled` + `reverbMix` controls now map to the Room IR wet level:

```ts
wetGain = reverbEnabled ? reverbMix * 1.5 : presetDefaultWet;  // cap at 0.9
dryGain = 1.0 - (wetGain * 0.5);
```

The `* 1.5` multiplier lets the user push reverb beyond the preset default when the toggle is on; the existing slider range `0.05..0.6` already caps effective wet at 0.9.

---

## 3. Studio Page Effect Presets (`StudioPage.tsx`)

Five presets applied per-track. Each preset is a JSON object the Dev can hand to an existing Tone.js channel strip. Pan values assume standard LTR — invert sign for RTL mixing if the user requests.

### 3.1 Universal channel strip topology

```
track source
  -> EQ3 (low/mid/high)
  -> Compressor
  -> Saturation (WaveShaper)
  -> Panner (equal-power)
  -> trackGain (see "target track level" per preset)
  -> master bus -> master reverb send (parallel) -> master limiter
```

### 3.2 Preset values

All dB values are in dB. All times in seconds unless suffixed `ms`. Saturation `amount` feeds the same `tanh(x*k)*s` curve from §2.3 with `s = 0.95`.

#### 3.2.1 `Clean`

| Layer | Param | Value |
|---|---|---|
| EQ3 | low gain / low freq split | `+1.0 dB` / `250 Hz` |
| EQ3 | mid gain | `0.0 dB` |
| EQ3 | high gain / high freq split | `+1.5 dB` / `3500 Hz` |
| Compressor | threshold / ratio | `-16 dB` / `2.0` |
| Compressor | attack / release / knee | `0.010 s` / `0.200 s` / `12 dB` |
| Reverb | decay / wet / pre-delay | `2.4 s` / `0.18` / `25 ms` |
| Saturation | curve `k` | `0.6` |
| Pan (Gtr L / Gtr R) | | `-0.15` / `+0.15` |
| Pan (Bass) | | `0.0` |
| Pan (Drums overheads) | | `-0.4` / `+0.4` |
| Target track level | | `-6 dBFS` RMS |

#### 3.2.2 `Rock`

| Layer | Param | Value |
|---|---|---|
| EQ3 | low / split | `+2.0 dB` / `220 Hz` |
| EQ3 | mid | `+1.0 dB` |
| EQ3 | high / split | `+2.5 dB` / `4000 Hz` |
| Compressor | threshold / ratio | `-12 dB` / `3.0` |
| Compressor | attack / release / knee | `0.006 s` / `0.180 s` / `8 dB` |
| Reverb | decay / wet / pre-delay | `1.8 s` / `0.14` / `20 ms` |
| Saturation | curve `k` | `1.2` |
| Pan (Gtr L / Gtr R) | | `-0.55` / `+0.55` |
| Pan (Bass) | | `0.0` |
| Pan (Drums overheads) | | `-0.65` / `+0.65` |
| Target track level | | `-8 dBFS` RMS |

#### 3.2.3 `Metal`

| Layer | Param | Value |
|---|---|---|
| EQ3 | low / split | `+3.0 dB` / `100 Hz` |
| EQ3 | mid (scooped) | `-2.5 dB` |
| EQ3 | high / split | `+3.5 dB` / `5000 Hz` |
| Compressor | threshold / ratio | `-10 dB` / `4.0` |
| Compressor | attack / release / knee | `0.003 s` / `0.120 s` / `6 dB` |
| Reverb | decay / wet / pre-delay | `1.2 s` / `0.10` / `15 ms` |
| Saturation | curve `k` | `2.2` |
| Pan (Gtr L / Gtr R dual-track) | | `-0.85` / `+0.85` |
| Pan (Bass) | | `0.0` (mono center, mandatory) |
| Pan (Drums overheads) | | `-0.80` / `+0.80` |
| Target track level | | `-9 dBFS` RMS (louder masters tolerated because of compression) |

#### 3.2.4 `Ambient`

| Layer | Param | Value |
|---|---|---|
| EQ3 | low / split | `-1.0 dB` / `180 Hz` |
| EQ3 | mid | `0.0 dB` |
| EQ3 | high / split | `+2.0 dB` / `6000 Hz` |
| Compressor | threshold / ratio | `-20 dB` / `1.5` |
| Compressor | attack / release / knee | `0.020 s` / `0.400 s` / `18 dB` |
| Reverb | decay / wet / pre-delay | `5.5 s` / `0.45` / `60 ms` |
| Saturation | curve `k` | `0.4` |
| Pan (Gtr L / Gtr R) | | `-0.70` / `+0.70` |
| Pan (Bass) | | `0.0` |
| Pan (Drums overheads) | | `-0.50` / `+0.50` |
| Target track level | | `-10 dBFS` RMS |

#### 3.2.5 `Lofi`

| Layer | Param | Value |
|---|---|---|
| EQ3 | low / split | `+1.5 dB` / `200 Hz` |
| EQ3 | mid | `-1.0 dB` |
| EQ3 | high / split | `-4.0 dB` / `3200 Hz` |
| Compressor | threshold / ratio | `-14 dB` / `3.5` |
| Compressor | attack / release / knee | `0.008 s` / `0.220 s` / `6 dB` |
| Reverb | decay / wet / pre-delay | `1.6 s` / `0.20` / `18 ms` |
| Saturation | curve `k` | `1.8` (more harmonic grit) |
| Pan (Gtr L / Gtr R) | | `-0.30` / `+0.30` |
| Pan (Bass) | | `0.0` |
| Pan (Drums overheads) | | `-0.45` / `+0.45` |
| Target track level | | `-12 dBFS` RMS |

### 3.3 Master bus

Same across all presets:

- Master reverb send uses Room IR from §1.4.
- Master limiter: `threshold -0.5 dB`, `ratio 20`, `attack 0.002 s`, `release 0.05 s`, `knee 0 dB`.
- LUFS target for exported mix: **−14 LUFS integrated** (Spotify / YouTube loudness target). The compressor / limiter stack above lands there without explicit LUFS metering if track levels follow the per-preset `target track level`.

---

## 4. Jam Mode Audio Fix (`JamLooper.tsx`)

**Root cause of "guitar sounds terrible":** `JamLooper` records mic input directly, decodes it to an `AudioBuffer`, and plays it back with `source.connect(gain).connect(ctx.destination)` (lines 205–213). There is zero processing — it is an un-miked, unprocessed dry guitar signal. No cab, no EQ, no compression.

### 4.1 Fix strategy

Apply the §2.1 effect chain to the **playback path only**. The recorded `AudioBuffer` is unchanged (so saving to library preserves the dry source). Effects are inserted between the `BufferSource` and `destination`.

### 4.2 New `startLoopPlayback` signal graph

```
per-layer BufferSource
  -> per-layer Gain (existing)
  -> per-layer HighPass (shared topology with tab player)
  -> per-layer WaveShaper (shared)
  -> SHARED Cabinet ConvolverNode (single instance reused across layers — saves CPU)
  -> SHARED PostCabGain
  -> SHARED Compressor
  -> Split: dry / Room IR wet
  -> SHARED Limiter
  -> ctx.destination
```

**CPU note:** With up to 6 layers playing simultaneously, share one `ConvolverNode` per IR. Each layer gets its own HP/WaveShaper (they are per-layer cheap) but all feed the same cabinet convolver via a merger gain node. This is correct because all layers of a Jam session use the same tone preset.

### 4.3 Default Jam preset

**`marshall_1960_rock`** — broader mid character is more forgiving of the variety of content users will loop (riffs, leads, chords, palette). Metal is too scooped for spoken/sung content some users will try.

### 4.4 Jam preset picker

Add a 3-button row in the Jam Looper header (compact, same style as the existing `BAR_OPTIONS` buttons around `JamLooper.tsx:588–603`):

- `Metal` / `Rock` / `Clean` → same preset matrix as §2.2.
- Persist in `localStorage` under `gf.jam.preset` (default `"rock"`).
- When user changes preset mid-playback: rebuild convolver + update shaper/compressor params. Expect a <5ms audible seam — mask by briefly fading the layer gains down over 20ms, swapping, then fading back up.

### 4.5 Non-destructive recording

The `recorder.onstop` handler at `JamLooper.tsx:303–335` must **not** apply any processing to the recorded buffer. The raw `AudioBuffer` is what gets stored in the layer and in the library. All effects are playback-time only.

**Rationale:** lets the user change presets retroactively, avoids double-processing when exporting through Studio, and keeps the WAV export faithful.

### 4.6 Library export

When `saveToLibrary` is called (line 467), the current `mergeLayersToWav` mixes dry buffers. **Change this** to offline-render the layers through the same §4.2 effect chain using `OfflineAudioContext`, so the exported WAV sounds like what the user heard. The dry buffers are still kept in memory for live preset switching during the session; the exported artifact is the processed version.

---

## 5. Metronome Synthesis (`MetronomeBox.tsx` + `JamLooper.tsx` `scheduleClick`)

Replace the current pure-oscillator clicks (`MetronomeBox.tsx:166–193`, `JamLooper.tsx:151–161`) with synthesized percussion. Two variants: **accent** (downbeat) and **normal** (other beats). Plus existing subdivision click for `MetronomeBox`.

### 5.1 Model — FM cowbell/woodblock hybrid

Each click is an `AudioBuffer` built once and played via a `BufferSource`. Pre-build at mount time and reuse for every tick (zero per-tick allocation).

### 5.2 Parameters

| Param | Accent (downbeat) | Normal | Sub-tick |
|---|---|---|---|
| Duration (ms) | `80` | `60` | `45` |
| Carrier freq (Hz) | `1050` | `820` | `1600` |
| Modulator freq (Hz) | `1580` | `1230` | `2200` |
| FM index | `2.8` | `2.0` | `1.2` |
| Envelope attack (ms) | `1` | `1` | `0.5` |
| Envelope decay (ms) | `70` | `52` | `40` |
| Transient noise amp | `0.35` | `0.22` | `0.12` |
| Transient noise decay (1/sec) | `260` | `300` | `400` |
| Body tone mix | `0.88` | `0.92` | `0.95` |
| Post filter (biquad peaking) | `freq 2400, gain +3 dB, Q 1.2` | `freq 1900, gain +2 dB, Q 1.2` | `freq 2800, gain +1.5 dB, Q 1.2` |
| Final peak normalize | `0.85` | `0.75` | `0.55` |

The final peak normalization values bake the existing loudness balance so `clickGain()` in `metronomeAudio.ts` can stay unchanged.

### 5.3 Pseudo-code — `buildClickBuffer`

```ts
function buildClickBuffer(ctx: AudioContext, p: ClickPreset): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * p.durationMs / 1000);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);

  const attackSamples = Math.max(1, Math.floor(sr * p.attackMs / 1000));
  const decayTau = (p.decayMs / 1000);

  for (let i = 0; i < len; i++) {
    const t = i / sr;

    // Linear attack / exponential decay envelope
    const env = i < attackSamples
      ? i / attackSamples
      : Math.exp(-(t - attackSamples / sr) / decayTau);

    // FM synthesis: carrier modulated by modulator
    const mod = Math.sin(2 * Math.PI * p.modFreq * t);
    const body = Math.sin(2 * Math.PI * p.carrierFreq * t + p.fmIndex * mod);

    // Transient noise burst
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * p.noiseDecay) * p.noiseAmp;

    d[i] = (body * p.bodyMix + noise * (1 - p.bodyMix)) * env;
  }

  // Apply post peaking EQ for click "bite"
  applyPeakingEQ(d, sr, p.postFilterFreq, 10 ** (p.postFilterGainDb / 20), p.postFilterQ);

  // Normalize to target peak
  let peak = 0;
  for (let i = 0; i < len; i++) if (Math.abs(d[i]) > peak) peak = Math.abs(d[i]);
  if (peak > 0) {
    const g = p.finalPeak / peak;
    for (let i = 0; i < len; i++) d[i] *= g;
  }

  return buf;
}
```

### 5.4 Playback change

`scheduleClick` currently creates an oscillator per tick. Change to:

```ts
const source = ctx.createBufferSource();
source.buffer = buffers[accent ? "accent" : subTick ? "sub" : "normal"];
const gain = ctx.createGain();
gain.gain.setValueAtTime(clickGain(kind, userVol), time);
source.connect(gain).connect(ctx.destination);
source.start(time);
```

No `exponentialRampToValueAtTime` is needed — the envelope is baked into the buffer.

### 5.5 Where to build the buffers

- Build once per `AudioContext` in `MetronomeBox` and `JamLooper` at context creation (inside `getOrCreateCtx`).
- Store in a `useRef<Record<ClickKind, AudioBuffer>>`.
- Rebuild if `ctx.sampleRate` differs from the build-time rate (rare — only if the context is replaced).

---

## 6. Learning Center / Interval Playback Sound Design (`LearningCenterPage.tsx`)

Current code at lines 523, 798, 815 uses `createOscillator` → `createGain` → `destination` with `triangle` or user-chosen `type` and `exponentialRampToValueAtTime` for decay. Result: thin beeps.

### 6.1 New voice — additive + ADSR + reverb send

Each note is synthesized from **3 oscillators detuned in cents**, summed through an ADSR envelope, fed into a shared small-room reverb send. Total CPU per note is negligible (single-shot, ~1 second lifetime).

### 6.2 Voice parameters

| Param | Value |
|---|---|
| Osc 1 type / detune | `sine` / `0 ¢` |
| Osc 2 type / detune | `triangle` / `+4 ¢` |
| Osc 3 type / detune | `sawtooth` / `-4 ¢` |
| Mix (1 : 2 : 3) | `0.55 : 0.35 : 0.10` |
| ADSR — attack (ms) | `12` |
| ADSR — decay (ms) | `180` |
| ADSR — sustain (linear) | `0.55` |
| ADSR — release (ms) | `320` |
| Note hold time (ms) | `520` (then release kicks in) |
| Reverb send (linear wet) | `0.18` |
| Reverb IR | `room_studio_medium` (§1.4) |
| Per-note lowpass (Hz / Q) | `5500` / `0.707` |
| Master velocity gain (linear) | `0.35` |

### 6.3 Pseudo-code

```ts
function playNote(ctx: AudioContext, midi: number, reverbNode: ConvolverNode) {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const now = ctx.currentTime;

  const specs: Array<[OscillatorType, number, number]> = [
    ["sine",     0,    0.55],
    ["triangle", +4,   0.35],
    ["sawtooth", -4,   0.10],
  ];

  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0, now);
  envGain.gain.linearRampToValueAtTime(1.0, now + 0.012);          // attack 12 ms
  envGain.gain.linearRampToValueAtTime(0.55, now + 0.012 + 0.180); // decay 180 ms to sustain 0.55
  envGain.gain.setValueAtTime(0.55, now + 0.520);                  // hold
  envGain.gain.linearRampToValueAtTime(0.0001, now + 0.520 + 0.320); // release 320 ms

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 5500;
  lp.Q.value = 0.707;

  const master = ctx.createGain();
  master.gain.value = 0.35;

  const wetSend = ctx.createGain();
  wetSend.gain.value = 0.18;

  for (const [type, cents, mix] of specs) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq * Math.pow(2, cents / 1200);
    const mixGain = ctx.createGain();
    mixGain.gain.value = mix;
    o.connect(mixGain).connect(envGain);
    o.start(now);
    o.stop(now + 0.520 + 0.320 + 0.05);
  }

  envGain.connect(lp).connect(master);
  master.connect(ctx.destination);
  master.connect(wetSend).connect(reverbNode).connect(ctx.destination);
}
```

### 6.4 Shared reverb node

- Build `room_studio_medium` convolver once per `AudioContext` and cache on the context.
- All interval / scale playback calls in `LearningCenterPage.tsx` route to the same convolver.
- This replaces the three separate call sites (`523`, `798`, `815`) with one `playNote` helper.

---

## 7. Mixing Best Practices — Volume Sliders and Meters

### 7.1 Logarithmic volume curve

Linear sliders feel jumpy because loudness perception is logarithmic. Apply a power curve between the UI 0–1 value and the underlying gain:

```ts
const EXPONENT = 2.5;
function uiToGain(ui: number): number {
  // ui in [0, 1], returns linear gain in [0, 1]
  if (ui <= 0) return 0;
  return Math.pow(ui, EXPONENT);
}
function gainToUi(gain: number): number {
  if (gain <= 0) return 0;
  return Math.pow(gain, 1 / EXPONENT);
}
```

Use **exponent = 2.5** everywhere volume UI meets audio gain (track volumes, master volume, metronome volume, layer volume, reverb mix, Suno backing level).

### 7.2 Equal-power panning law

For all stereo panning (per-track in Studio, drum overheads, guitar dual-tracks):

```ts
function equalPowerPan(pan: number): { left: number; right: number } {
  // pan in [-1, +1]
  const x = (pan + 1) * 0.5 * (Math.PI / 2);  // 0 .. pi/2
  return { left: Math.cos(x), right: Math.sin(x) };
}
```

This keeps perceived loudness constant as a sound pans across the stereo field (the `-3 dB at center` law). Prefer this over `StereoPannerNode` (which uses a linear-ish law) when mixing multiple tracks.

### 7.3 Smoothing via `setTargetAtTime`

Never assign directly to `gain.value` during playback — causes zipper noise. For every gain change driven by a UI slider or preset switch:

```ts
const SMOOTH_TAU = 0.015;   // seconds — ~15 ms, below perception of latency, above zipper
gain.gain.setTargetAtTime(newValue, ctx.currentTime, SMOOTH_TAU);
```

Use **`tau = 0.015 s`** uniformly. For preset crossfades (bigger jumps), use `linearRampToValueAtTime` over `0.050 s` instead.

### 7.4 Level meter ballistics

For any VU / peak meter drawn in the UI (Studio, Recorder):

| Param | Value |
|---|---|
| Sample interval | `20 ms` (50 Hz redraw) |
| Peak hold time | `1200 ms` after a peak, then decay |
| Peak decay rate | `20 dB / second` (linear in dB, so exponential in linear gain) |
| RMS window length | `300 ms` sliding window |
| Clip LED threshold | `-0.3 dBFS` for 2 consecutive samples, hold red `1500 ms` |

Pseudo-code for decay:

```ts
// Called every 20 ms with the newly measured peak (linear, 0..1)
let heldPeak = 0;
let peakHoldUntil = 0;
let displayedPeak = 0;

function tick(now: number, measuredPeak: number) {
  if (measuredPeak > displayedPeak) {
    displayedPeak = measuredPeak;
    heldPeak = measuredPeak;
    peakHoldUntil = now + 1.2;
  } else if (now > peakHoldUntil) {
    // decay at 20 dB/s: gain = displayedPeak * 10^(-20 * dt / 20) = displayedPeak * 10^(-dt)
    const dtSec = 0.020;
    displayedPeak *= Math.pow(10, -dtSec);  // -20 dB / sec = factor of 0.1 per second
  }
}
```

---

## 8. Dual-Channel Recording (`audioMix.ts` + recorder components)

The current `decodeBlobToBuffer` fallback at `audioMix.ts:25–102` uses `ScriptProcessorNode`, which is deprecated and runs on the main thread (glitches under load).

### 8.1 AudioWorklet migration — target behavior

Create a worklet processor that replaces the `ScriptProcessorNode` decode fallback **and** offers a realtime dual-channel mixer. The worklet itself is one small file; this spec describes what it does, not the full code.

**Worklet name:** `dual-channel-mixer-processor`

**Worklet inputs:** 2 stereo inputs (mic, browser tab).
**Worklet outputs:** 1 stereo output (the mix).
**Worklet parameters (AudioParams, k-rate):**

- `micGain` — default `1.0`, range `[0, 2]`
- `browserGain` — default `1.0`, range `[0, 2]`
- `micHighpassCutoff` — default `80` Hz (applied inside worklet with a simple 1-pole HP)
- `clipWarn` — automation signal: worklet posts a message to main thread when abs(sample) > 0.98 for >10ms cumulative in any 1s window.

**Process block behavior (per 128-sample render quantum):**

1. Read mic L/R and browser L/R from the two inputs.
2. Apply 1-pole HP at `micHighpassCutoff` to mic only.
3. Multiply each source by its gain.
4. Sum: `out = mic + browser`.
5. Apply `tanh(out * 0.95)` soft clip as a safety net.
6. Write to output.

### 8.2 Default mixing ratios

When both streams are present and the user has not set custom levels:

| Source | Default gain (linear) | Default gain (dB) |
|---|---|---|
| Mic (guitar) | `1.15` | `+1.2 dB` |
| Browser tab | `0.75` | `-2.5 dB` |

Rationale: the user wants their playing on top of the backing track. Guitar should sit slightly forward of the tab audio.

### 8.3 Record separately, mix later (preferred path)

Change the recorder architecture:

1. Record **two separate streams** in parallel with `MediaRecorder` (or two `MediaRecorder` instances — one per `MediaStream`).
2. Store both files in IndexedDB alongside a metadata blob `{ micLevel, browserLevel, preset }`.
3. On playback / export, feed both into the worklet mixer and render via `OfflineAudioContext`.

**Why:** lets the user rebalance mic vs. browser after the fact without re-recording. Also preserves the dry guitar so effects can be re-applied.

### 8.4 Live mix as fallback

When separate recording is not possible (browser permissions, single MediaRecorder codec limits), fall back to a live-mix path:

- Wire both streams into the worklet.
- Use `MediaStreamDestination` to capture the worklet output.
- Feed that into a single `MediaRecorder`.

### 8.5 Decode fallback

Keep the existing `decodeAudioData` primary path in `decodeBlobToBuffer`. Replace the `ScriptProcessorNode` fallback with a worklet-based tap: if `decodeAudioData` fails, play the blob through an `<audio>` element into a `MediaElementSource` → `AudioWorklet` capture node → post samples to main thread → rebuild AudioBuffer.

Acceptable alternative: ship the current `ScriptProcessorNode` fallback unchanged for now (its only role is decoding obscure container formats that never happen in practice), and only migrate if profiling shows a hit.

### 8.6 Acceptance test

After implementing §8.1 – §8.4:

- Record 60 seconds of guitar over a backing track.
- Verify two blobs saved separately (check IndexedDB).
- Verify the mixed export WAV contains both sources at the §8.2 default ratios within ±0.5 dB measured RMS.
- Verify no glitches during 60-second record (the ScriptProcessorNode path had occasional pops; worklet should have zero).

---

## Appendix A — Per-file change map

| File | Sections applicable |
|---|---|
| `src/components/GpFileUploader.tsx` | §1 IR builder, §2 tab player chain |
| `src/components/JamLooper.tsx` | §1 IR (shared), §4 jam effect chain, §5 metronome clicks |
| `src/components/MetronomeBox.tsx` | §5 metronome synthesis |
| `src/components/LearningCenterPage.tsx` | §1 room IR (shared), §6 interval playback |
| `src/components/StudioPage.tsx` | §3 studio presets, §7 volume/pan/meter |
| `src/lib/audioMix.ts` | §7 smoothing, §8 worklet migration |
| `src/lib/metronomeAudio.ts` | leave `clickGain` unchanged; buffer peaks (§5.2) already match |
| new: `src/lib/audioIr.ts` | house §1 `buildCabinetIR` + 4 presets + cache |
| new: `src/lib/audioPresets.ts` | house §2, §3, §4 preset tables as typed objects |
| new: `public/audio-worklets/dual-channel-mixer.js` | §8 worklet |

## Appendix B — Value sanity summary (for QA)

- All reverbs pre-delay ≤ 60 ms (prevents slapback).
- All compressor attacks ≤ 20 ms (fast enough for guitar transients).
- All HP filters ≤ 100 Hz (preserves bass body).
- All LP filters ≥ 5500 Hz (preserves presence).
- All limiter thresholds between `-0.5` and `-1.0 dB`.
- All IR lengths ≤ 450 ms (no convolution CPU spikes).
- All click durations ≤ 80 ms (tight metronome feel).
- Pan values never exceed ±0.85 (avoid "hole in the middle").
- Master LUFS target `-14` (streaming-platform-ready).
