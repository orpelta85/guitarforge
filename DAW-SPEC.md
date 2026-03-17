# GuitarForge DAW Studio — Comprehensive Technical Specification

## Research-Based Feature Specification for Browser-Based Guitar DAW

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Audio Input & Signal Chain](#2-audio-input--signal-chain)
3. [Effects & Processing](#3-effects--processing)
4. [Amp Simulator & Presets](#4-amp-simulator--presets)
5. [Mixer](#5-mixer)
6. [Recording Workflow](#6-recording-workflow)
7. [Transport & Timeline](#7-transport--timeline)
8. [Export Options](#8-export-options)
9. [Keyboard Shortcuts](#9-keyboard-shortcuts)
10. [UI Layout](#10-ui-layout)
11. [Feature Priority Matrix](#11-feature-priority-matrix)

---

## 1. Architecture Overview

### Web Audio API Core

The entire DAW runs on the Web Audio API — a directed graph of AudioNodes connected source → processing → destination.

```
Guitar Input (MediaStream)
  → MediaStreamSourceNode
  → GainNode (input gain staging)
  → [Effects Chain - see Section 3]
  → GainNode (channel fader)
  → ChannelMergerNode (mixer bus)
  → DynamicsCompressorNode (master bus limiter)
  → AnalyserNode (master metering)
  → AudioContext.destination
```

### Key Web Audio Nodes Used

| Node | Purpose |
|------|---------|
| `MediaStreamSourceNode` | Guitar/mic input from audio interface |
| `GainNode` | Volume control, gain staging, faders |
| `BiquadFilterNode` | EQ bands (lowshelf, peaking, highshelf), tone controls |
| `WaveShaperNode` | Distortion/overdrive (non-linear curve) |
| `ConvolverNode` | Cabinet IR simulation, reverb (impulse response) |
| `DynamicsCompressorNode` | Compressor, limiter |
| `DelayNode` | Delay effect, chorus (modulated short delay) |
| `StereoPannerNode` | Channel panning |
| `AnalyserNode` | Metering (FFT for spectrum, time-domain for waveform) |
| `OscillatorNode` | Metronome click, test tones |
| `MediaStreamDestinationNode` | Capture output for recording |
| `AudioWorkletNode` | Custom processing: noise gate, advanced effects |

### AudioContext Initialization

```typescript
const context = new AudioContext({ sampleRate: 44100 });

// Guitar input — disable all browser processing
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: false,
    autoGainControl: false,
    noiseSuppression: false,
    latency: 0
  }
});

const inputSource = context.createMediaStreamSource(stream);
```

**Critical:** Browser audio processing (echo cancellation, noise suppression, auto gain control) MUST be disabled for instrument input. These are designed for voice calls and destroy guitar signal quality.

### Latency Considerations

- **Target latency:** < 15ms round-trip (input → processing → output)
- **Windows Web Audio:** WASAPI driver only, minimum ~10ms latency
- **Buffer size:** Not directly controllable in Web Audio API; browser manages it
- **Monitoring:** Use direct monitoring on audio interface when possible (zero-latency hardware monitoring); software monitoring as fallback
- **Recommendation:** Display latency info to user, suggest using audio interface with hardware monitoring

---

## 2. Audio Input & Signal Chain

### Guitar Recording Signal Chain (Standard Order)

The signal chain follows established guitar production conventions. Effects are split into **pre-amp** (before distortion) and **post-amp** (after distortion/cabinet).

```
Guitar Input
  → Input Gain (staging to -12 to -6 dBFS peaks)
  → Noise Gate (remove hum/noise before amplification)
  → Compressor (optional, tighten dynamics before amp)
  → Overdrive/Boost (optional, push the amp harder)
  → Amp Simulator (gain + tonestack)
  → Cabinet Simulator (ConvolverNode with IR)
  → Post-EQ (sculpt final tone)
  → Chorus/Modulation (optional)
  → Delay
  → Reverb
  → Channel Fader (volume)
  → Pan
  → → Mixer Bus
```

### Pre-Amp Effects (before amp sim)
1. **Noise Gate** — removes hum, buzz, and noise floor
2. **Compressor** — evens out dynamics (optional for clean tones)
3. **Overdrive/Boost** — pushes amp harder, tightens low end

### Post-Amp Effects (after cabinet sim)
1. **EQ** — surgical tone shaping
2. **Chorus/Modulation** — thickening (clean tones)
3. **Delay** — rhythmic repeats
4. **Reverb** — space and ambience

### DI Recording Workflow

For maximum flexibility, record the **dry DI signal** (before any processing) alongside the processed signal:

```
Guitar Input → Splitter
  ├── DI Track (raw, unprocessed) — for re-amping later
  └── Processed Track (through effects chain) — for monitoring
```

**Implementation:** Use `MediaStreamSourceNode` connected to two paths:
1. Directly to a `MediaRecorderNode` for DI capture
2. Through the effects chain for live monitoring and processed recording

---

## 3. Effects & Processing

### 3.1 Noise Gate

**Priority:** Must-have

**Implementation:** AudioWorkletNode (no native noise gate in Web Audio)

**Parameters:**

| Parameter | Default | Min | Max | Unit | Description |
|-----------|---------|-----|-----|------|-------------|
| Threshold | -40 | -96 | 0 | dB | Level below which audio is muted |
| Attack | 0.5 | 0.1 | 20 | ms | Time to open gate when signal exceeds threshold |
| Hold | 50 | 0 | 500 | ms | Time to keep gate open after signal drops below threshold |
| Release | 50 | 5 | 500 | ms | Time to close gate after hold expires |

**Presets:**
- Light: threshold -50dB, attack 0.5ms, hold 100ms, release 100ms
- Medium: threshold -40dB, attack 0.5ms, hold 50ms, release 50ms
- Tight: threshold -30dB, attack 0.1ms, hold 20ms, release 20ms

---

### 3.2 Compressor

**Priority:** Must-have

**Implementation:** `DynamicsCompressorNode`

**Parameters (Web Audio API defaults and ranges):**

| Parameter | Default | Min | Max | Unit | Description |
|-----------|---------|-----|-----|------|-------------|
| Threshold | -24 | -100 | 0 | dB | Level above which compression begins |
| Knee | 30 | 0 | 40 | dB | Range over which compression smoothly transitions |
| Ratio | 12 | 1 | 20 | :1 | Input dB change needed for 1 dB output change |
| Attack | 0.003 | 0 | 1 | s | Time to reduce gain by 10 dB |
| Release | 0.25 | 0 | 1 | s | Time to increase gain by 10 dB |
| Makeup Gain | 0 | -12 | 24 | dB | Compensate for volume reduction (GainNode after) |

**Note:** `reduction` is a read-only property showing current gain reduction in dB — display on the UI meter.

**Presets:**
- Gentle: threshold -20dB, ratio 2:1, attack 10ms, release 200ms
- Guitar: threshold -18dB, ratio 4:1, attack 5ms, release 150ms
- Sustain: threshold -30dB, ratio 6:1, attack 2ms, release 300ms
- Limiter: threshold -6dB, ratio 20:1, attack 0.1ms, release 50ms

---

### 3.3 Parametric EQ (3-Band)

**Priority:** Must-have

**Implementation:** Three `BiquadFilterNode` instances in series

**Band Configuration:**

| Band | Type | Default Freq | Freq Range | Default Gain | Gain Range | Q Default | Q Range |
|------|------|-------------|------------|-------------|------------|-----------|---------|
| Low | lowshelf | 320 Hz | 20–500 Hz | 0 dB | -12 to +12 dB | — | — |
| Mid | peaking | 1000 Hz | 200–8000 Hz | 0 dB | -12 to +12 dB | 1.0 | 0.1–10 |
| High | highshelf | 3200 Hz | 1000–20000 Hz | 0 dB | -12 to +12 dB | — | — |

**Additional Filters (nice-to-have):**

| Filter | Type | Purpose |
|--------|------|---------|
| High-Pass | highpass | Remove rumble below 80 Hz |
| Low-Pass | lowpass | Remove fizz above 12 kHz |

**Implementation Note:** Use `setTargetAtTime()` for smooth parameter changes to avoid clicks:
```typescript
biquadNode.gain.setTargetAtTime(newValue, context.currentTime, 0.01);
```

---

### 3.4 Reverb

**Priority:** Must-have

**Implementation:** `ConvolverNode` with impulse response buffers

**Approach:** Generate algorithmic IRs or load pre-recorded IR files for different reverb types.

**Parameters:**

| Parameter | Default | Min | Max | Unit | Description |
|-----------|---------|-----|-----|------|-------------|
| Type | Room | — | — | enum | Room, Hall, Plate, Spring |
| Mix (Wet/Dry) | 25 | 0 | 100 | % | Blend of dry and reverb signal |
| Pre-Delay | 10 | 0 | 200 | ms | Delay before reverb onset |
| Decay / Size | 50 | 0 | 100 | % | Maps to different IR lengths |
| Damping | 50 | 0 | 100 | % | High-frequency rolloff (BiquadFilter on wet signal) |

**Reverb Type Characteristics:**

| Type | Character | Decay Range | Use Case |
|------|-----------|-------------|----------|
| Room | Tight, natural | 0.3–1.0s | Rhythm guitar, tight mixes |
| Hall | Spacious, lush | 1.0–3.0s | Lead guitar, solos |
| Plate | Bright, dense | 1.0–2.5s | Classic rock/metal leads |
| Spring | Bouncy, vintage | 0.5–2.0s | Clean guitar, surf, blues |

**Implementation:** Dry/wet mixing requires parallel routing:
```
Input → Dry GainNode ──────────────────────→ Output Merger
Input → Pre-Delay → ConvolverNode → Damping → Wet GainNode → Output Merger
```

---

### 3.5 Delay

**Priority:** Must-have

**Implementation:** `DelayNode` with feedback loop via `GainNode`

**Parameters:**

| Parameter | Default | Min | Max | Unit | Description |
|-----------|---------|-----|-----|------|-------------|
| Time | 375 | 1 | 2000 | ms | Delay time (or sync to BPM) |
| Feedback | 30 | 0 | 90 | % | Amount of signal fed back (90% max to prevent runaway) |
| Mix (Wet/Dry) | 25 | 0 | 100 | % | Blend of dry and delayed signal |
| Sync | Off | — | — | bool | Sync delay time to BPM |
| Subdivision | 1/4 | — | — | enum | 1/4, dotted 1/8, 1/8, 1/16 |
| Ping-Pong | Off | — | — | bool | Alternating L/R delays |
| High Cut | 8000 | 1000 | 20000 | Hz | Roll off highs on repeats (BiquadFilter in feedback loop) |

**BPM Sync Calculation:**
```typescript
const delayMs = (60000 / bpm) * subdivisionMultiplier;
// Subdivisions: 1/4 = 1.0, dotted 1/8 = 0.75, 1/8 = 0.5, 1/16 = 0.25
```

**Feedback Loop:**
```
Input → Dry Gain → Output
Input → DelayNode → Feedback Gain → DelayNode (loop)
                  → Wet Gain → Output
```

**Ping-Pong:** Use two `DelayNode`s panned hard left and right, feeding into each other.

---

### 3.6 Chorus

**Priority:** Nice-to-have

**Implementation:** Modulated short `DelayNode` (5–30ms) using an `OscillatorNode` controlling delay time via `GainNode`

**Parameters:**

| Parameter | Default | Min | Max | Unit | Description |
|-----------|---------|-----|-----|------|-------------|
| Rate | 1.5 | 0.1 | 10 | Hz | LFO speed |
| Depth | 5 | 1 | 20 | ms | Modulation amount |
| Mix | 50 | 0 | 100 | % | Dry/wet blend |

---

### 3.7 Overdrive / Distortion

**Priority:** Must-have (part of amp sim, also standalone)

**Implementation:** `GainNode` (drive) → `WaveShaperNode` (clipping curve) → `BiquadFilterNode` (tone)

**Parameters:**

| Parameter | Default | Min | Max | Unit | Description |
|-----------|---------|-----|-----|------|-------------|
| Drive | 50 | 0 | 100 | % | Input gain before waveshaper |
| Tone | 50 | 0 | 100 | % | Post-distortion tone (low-pass filter frequency) |
| Level | 50 | 0 | 100 | % | Output volume |

**Distortion Curves (WaveShaperNode):**

```typescript
// Soft clipping (overdrive) — smooth, warm saturation
function makeOverdriveCurve(amount: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// Hard clipping (distortion) — aggressive, tight
function makeDistortionCurve(amount: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = amount * 100;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 57.3) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// Tube-like saturation (amp sim) — tanh-based
function makeTubeCurve(amount: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}
```

**`oversample` property:** Set to `'4x'` on the WaveShaperNode to reduce aliasing artifacts from distortion.

---

## 4. Amp Simulator & Presets

### Amp Signal Chain

```
Input Gain (Drive/Gain knob)
  → Pre-EQ (BiquadFilterNode — optional bright cap, input filtering)
  → WaveShaperNode (tube saturation curve)
  → Tonestack (3x BiquadFilterNode: Bass, Mid, Treble)
  → Presence Filter (BiquadFilterNode: high shelf)
  → Master Volume (GainNode)
  → Cabinet Simulator (ConvolverNode with IR)
```

### Amp Controls

| Control | Default | Min | Max | Description |
|---------|---------|-----|-----|-------------|
| Gain | 5 | 0 | 10 | Input gain / overdrive amount |
| Bass | 5 | 0 | 10 | Low frequency EQ (lowshelf @ 200Hz) |
| Mid | 5 | 0 | 10 | Midrange EQ (peaking @ 800Hz) |
| Treble | 5 | 0 | 10 | High frequency EQ (highshelf @ 3200Hz) |
| Presence | 5 | 0 | 10 | Upper presence (highshelf @ 5000Hz) |
| Master | 5 | 0 | 10 | Output volume |

### Amp Presets

| Preset | Gain | Bass | Mid | Treble | Presence | Master | Curve Type | Use Case |
|--------|------|------|-----|--------|----------|--------|------------|----------|
| Clean | 2 | 5 | 6 | 6 | 5 | 7 | Soft (minimal) | Clean arpeggios, jazz |
| Clean Bright | 2 | 4 | 5 | 7 | 7 | 7 | Soft (minimal) | Funk, pop clean |
| Crunch | 5 | 6 | 6 | 6 | 5 | 5 | Soft overdrive | Blues, classic rock rhythm |
| Hard Rock | 6 | 6 | 7 | 6 | 6 | 5 | Overdrive | AC/DC, hard rock |
| High Gain | 8 | 6 | 5 | 6 | 6 | 4 | Tube distortion | Metal rhythm, thrash |
| Modern Metal | 9 | 7 | 4 | 7 | 7 | 4 | Hard clip | Djent, modern metal |
| Lead | 7 | 5 | 7 | 6 | 6 | 5 | Tube saturation | Solos, sustain |
| Shred | 8 | 5 | 6 | 7 | 7 | 5 | Tube distortion | Fast leads, neo-classical |
| Acoustic Sim | 1 | 6 | 4 | 7 | 5 | 7 | None (clean) | Piezo-like acoustic |

### Cabinet Simulation

**Implementation:** `ConvolverNode` loaded with impulse response (IR) files

**Cabinet IR Types to Include:**

| Cabinet | Character | Mic Position | File |
|---------|-----------|-------------|------|
| 1x12 Open | Bright, chimey | Center cone | `cab_1x12_open.wav` |
| 2x12 Closed | Balanced, punchy | Off-axis | `cab_2x12_closed.wav` |
| 4x12 Metal | Tight, aggressive | SM57 close | `cab_4x12_metal.wav` |
| 4x12 Vintage | Warm, classic | Ribbon room | `cab_4x12_vintage.wav` |
| Direct (No Cab) | Raw amp tone | — | None (bypass convolver) |

**IR Loading:**
```typescript
async function loadCabinetIR(context: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return context.decodeAudioData(arrayBuffer);
}

// Apply to ConvolverNode
convolver.buffer = await loadCabinetIR(context, '/audio/cabs/cab_4x12_metal.wav');
```

**Makeup Gain:** IRs often reduce volume. Add a `GainNode` after the convolver to compensate (typically +6 to +12 dB).

---

## 5. Mixer

### Channel Strip Layout (Top to Bottom)

Each track in the mixer follows this layout:

```
┌─────────────────┐
│  Track Name      │  ← Editable label
│  [Input Select]  │  ← Mic/DI/File/Bus
├─────────────────┤
│  [Record Arm] 🔴  │  ← Arm for recording
│  [Input Monitor] │  ← Toggle input monitoring
├─────────────────┤
│  ┌─── Inserts ──┐│  ← Effect slots (drag to reorder)
│  │ 1. Noise Gate ││
│  │ 2. Amp Sim   ││
│  │ 3. Cabinet   ││
│  │ 4. EQ        ││
│  │ 5. [empty]   ││
│  └──────────────┘│
├─────────────────┤
│  Send 1: [___]  │  ← Aux send level (to reverb bus)
│  Send 2: [___]  │  ← Aux send level (to delay bus)
├─────────────────┤
│  ┌── Meter ────┐ │
│  │ ▓▓▓▓▓▓░░░░ │ │  ← Peak + RMS meter (stereo)
│  │ -∞ ... 0dB │ │
│  └─────────────┘ │
├─────────────────┤
│  [Pan ◄──●──►]  │  ← Stereo pan knob/slider
├─────────────────┤
│  [S] [M]        │  ← Solo / Mute buttons
├─────────────────┤
│  ┌── Fader ───┐ │
│  │     │      │ │  ← Volume fader (vertical slider)
│  │     │      │ │     Range: -∞ to +6 dB
│  │     ●      │ │     Default: 0 dB (unity)
│  │     │      │ │
│  └─────────────┘ │
├─────────────────┤
│  [0.0 dB]       │  ← Numeric readout
└─────────────────┘
```

### Metering

**Peak Meter:**
- Use `AnalyserNode.getFloatTimeDomainData()` for peak detection
- Green: -∞ to -12 dB
- Amber: -12 to -3 dB
- Red: -3 to 0 dB
- Clip indicator: holds red for 2 seconds when 0 dB exceeded
- Peak hold: show peak line that slowly falls (1 dB/sec)

**RMS Meter (nice-to-have):**
- Calculate RMS from time-domain data
- Display as wider/dimmer bar behind peak meter
- Better represents perceived loudness

**Master Bus LUFS (future):**
- Implement integrated LUFS metering for loudness compliance
- Target: -14 LUFS for streaming platforms

### Bus / Send Routing

**Aux Buses (shared effects):**

| Bus | Default Effect | Purpose |
|-----|---------------|---------|
| Aux 1 | Reverb (Hall) | Shared reverb for all tracks |
| Aux 2 | Delay (1/4 note) | Shared delay for all tracks |

**Routing:**
```
Track → Send GainNode → Aux Bus Input → Effect Chain → Aux Bus Fader → Master
Track → Channel Fader → Direct to Master
```

**Benefit:** Shared reverb/delay saves CPU vs. per-track instances.

### Master Bus

```
All Channel Outputs → ChannelMergerNode
  → Master EQ (BiquadFilterNode x3)
  → Master Compressor/Limiter (DynamicsCompressorNode)
  → Master Gain (fader)
  → AnalyserNode (master meter)
  → AudioContext.destination
```

**Master Limiter Default:** threshold -1dB, ratio 20:1, attack 0.001s, release 0.1s

---

## 6. Recording Workflow

### 6.1 Track Arming

**Priority:** Must-have

- Click the record arm button (red circle) on a track
- Arming enables input monitoring through the track's effects chain
- Visual indicator: track header turns red/highlighted when armed
- Only armed tracks record when global record is pressed
- Multiple tracks can be armed simultaneously

### 6.2 Input Monitoring

**Priority:** Must-have

| Mode | Behavior | Latency | Implementation |
|------|----------|---------|----------------|
| Auto | Monitor when stopped/recording, mute during playback | Software | Connect/disconnect input based on transport state |
| Always On | Always hear input through effects | Software | Input always connected to effects chain |
| Off | No software monitoring (use hardware direct monitoring) | Zero | Input disconnected from output, only goes to recorder |

### 6.3 Count-In

**Priority:** Must-have

- Configurable: Off, 1 bar, 2 bars (default: 1 bar)
- Uses metronome/click sound
- Accented first beat of each bar
- Recording starts after count-in completes
- Visual countdown display (bar number or beat number)

**Implementation:**
```typescript
const counInBeats = countInBars * beatsPerBar;
// Schedule metronome clicks using OscillatorNode
// Start MediaRecorder after last count-in beat
```

### 6.4 Overdub Mode

**Priority:** Must-have

- Record new audio on an armed track while playing back existing tracks
- New recording creates a new region/clip on the track
- Previous recordings on the same track remain (stacked layers)
- Mix between takes using clip volume or muting

### 6.5 Punch-In / Punch-Out

**Priority:** Nice-to-have

- Set punch-in point (where recording starts) and punch-out point (where recording stops)
- Playback runs normally, recording activates only in the punched region
- Useful for fixing specific sections without re-recording entire take

### 6.6 Comping (Multiple Takes)

**Priority:** Future

- Record multiple takes on the same track
- Display takes as stacked lanes
- Select best sections from each take to create composite

### 6.7 Recording Implementation

```typescript
// Create MediaRecorder from the processed audio stream
const dest = context.createMediaStreamDestination();
channelOutput.connect(dest);

const recorder = new MediaRecorder(dest.stream, {
  mimeType: 'audio/webm;codecs=opus' // or 'audio/wav' if available
});

const chunks: Blob[] = [];
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: recorder.mimeType });
  // Convert to WAV for waveform display and editing
};
```

**DI Recording (parallel):**
```typescript
// Simultaneously record dry input (before effects)
const diDest = context.createMediaStreamDestination();
inputGainNode.connect(diDest);
const diRecorder = new MediaRecorder(diDest.stream);
```

---

## 7. Transport & Timeline

### 7.1 Transport Controls

| Control | Icon | Shortcut | Behavior |
|---------|------|----------|----------|
| Play / Pause | ▶ / ⏸ | `Space` | Toggle playback |
| Stop | ⏹ | `Space` (when playing, double-tap) | Stop and return to start/last position |
| Record | ⏺ | `R` | Start recording (with count-in if enabled) |
| Rewind to Start | ⏮ | `Home` | Move playhead to position 0 |
| Skip to End | ⏭ | `End` | Move playhead to end of last region |
| Loop Toggle | 🔁 | `L` | Toggle loop region playback |

### 7.2 Metronome / Click Track

**Priority:** Must-have

| Setting | Default | Options |
|---------|---------|---------|
| Enable | On | On / Off |
| Volume | 75% | 0–100% |
| Accented Beat | On | First beat louder/different pitch |
| Sound | Click | Click, Woodblock, Hi-Hat, Beep |
| Count-In | 1 bar | Off, 1 bar, 2 bars, 4 bars |
| Subdivision | None | None, 1/8, 1/16, triplet |

**Click Sound Implementation:**
```typescript
// Accent beat: 1000 Hz, 30ms
// Normal beat: 800 Hz, 20ms
// Subdivision: 600 Hz, 10ms
function scheduleClick(time: number, isAccent: boolean) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.frequency.value = isAccent ? 1000 : 800;
  gain.gain.setValueAtTime(isAccent ? 0.8 : 0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + (isAccent ? 0.03 : 0.02));
  osc.connect(gain).connect(metronomeOutput);
  osc.start(time);
  osc.stop(time + 0.05);
}
```

### 7.3 Timeline / Grid

**Priority:** Must-have

| Feature | Default | Options |
|---------|---------|---------|
| Snap to Grid | Beat | Off, Bar, Beat, 1/8, 1/16 |
| Time Display | Bars:Beats | Bars:Beats, Minutes:Seconds |
| Zoom | Fit to window | Per-beat, per-bar, per-4-bars, fit-to-window |

### 7.4 Loop Region

- Click+drag on timeline ruler to set loop region
- Visual: highlighted bar on timeline ruler
- `L` to toggle loop on/off
- When loop is on, playback jumps from loop end to loop start

### 7.5 Markers / Cue Points

**Priority:** Nice-to-have

- Place named markers on timeline (Intro, Verse, Chorus, Solo, etc.)
- Click marker to jump to that position
- Keyboard: `M` to place marker at current position
- Useful for song structure navigation

---

## 8. Export Options

### 8.1 Full Mix Export

**Priority:** Must-have

| Format | Settings | Default |
|--------|----------|---------|
| WAV | 16-bit / 24-bit, 44.1kHz / 48kHz | 24-bit, 44.1kHz |
| MP3 | 128 / 192 / 256 / 320 kbps | 320 kbps |

### 8.2 Stem Export

**Priority:** Nice-to-have

- Export each track as a separate audio file
- All stems same length (padded with silence)
- Naming: `{project}_{trackname}.wav`
- Useful for sharing with other DAWs or collaborators

### 8.3 Export Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Normalize | Off | Peak normalize to -0.3 dBFS |
| Dither | Off | Add dither when converting 24-bit to 16-bit (triangular PDF) |
| Tail | 2s | Extra seconds after last region (capture reverb/delay tails) |
| Range | Full | Full project / Selection only / Loop region |

### 8.4 Implementation

```typescript
// Offline rendering for export (faster than real-time)
const offlineContext = new OfflineAudioContext({
  numberOfChannels: 2,
  length: durationInSamples,
  sampleRate: 44100
});

// Reconstruct audio graph in offline context
// ... connect all nodes ...

const renderedBuffer = await offlineContext.startRendering();

// Convert AudioBuffer to WAV
function audioBufferToWav(buffer: AudioBuffer, bitDepth: 16 | 24): ArrayBuffer {
  // PCM encoding implementation
}

// Convert to MP3 using lamejs
import lamejs from 'lamejs';
function audioBufferToMp3(buffer: AudioBuffer, bitrate: number): Blob {
  const encoder = new lamejs.Mp3Encoder(2, buffer.sampleRate, bitrate);
  // Encode left/right channels
}
```

---

## 9. Keyboard Shortcuts

### Transport

| Shortcut | Action |
|----------|--------|
| `Space` | Play / Pause |
| `R` | Toggle Record |
| `Home` | Go to start |
| `End` | Go to end |
| `L` | Toggle Loop |
| `,` | Nudge playhead left |
| `.` | Nudge playhead right |

### Editing

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Delete` | Delete selected region |
| `S` | Split region at playhead |
| `Ctrl+D` | Duplicate selected region |
| `Ctrl+A` | Select all |

### Tracks

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New track |
| `M` (on track) | Toggle Mute |
| `Shift+M` | Solo selected track |

### View

| Shortcut | Action |
|----------|--------|
| `Ctrl+Plus` | Zoom in (horizontal) |
| `Ctrl+Minus` | Zoom out (horizontal) |
| `Ctrl+0` | Zoom to fit |
| `Tab` | Toggle mixer panel |

### Metronome

| Shortcut | Action |
|----------|--------|
| `K` | Toggle metronome on/off |

---

## 10. UI Layout

### Three-Panel Layout

```
┌────────────────────────────────────────────────────────┐
│  Toolbar: [◀ ⏹ ▶ ⏺] BPM [120▲▼] [4/4] [🔁 Loop] [🎵 Click] │ Transport Bar
├────────────────────────────────────────────────────────┤
│  Timeline Ruler: |1   |2   |3   |4   |5   |6   |7   | │ Time Ruler
├─────────┬──────────────────────────────────────────────┤
│ Track   │  Waveform / Region Display                   │
│ Headers │                                              │ Arrange
│         │  Track 1: ████████░░░░████████               │ Panel
│ [Name]  │  Track 2: ░░░░████████████░░░░               │
│ [Arm]   │  Track 3: ████████████████████               │
│ [M] [S] │                                              │
├─────────┴──────────────────────────────────────────────┤
│  Mixer (collapsible bottom panel)                       │
│  [Ch1][Ch2][Ch3][Ch4]...[Aux1][Aux2][Master]           │ Mixer
│   │    │    │    │        │     │      │               │ Panel
│  [==] [==] [==] [==]    [==]  [==]   [==]             │
└────────────────────────────────────────────────────────┘
```

### Effect Chain Editor (Side Panel or Modal)

```
┌─────────────────────────┐
│ Track 1: Guitar          │
│ ─────────────────────── │
│ 1. [⚡ Noise Gate    ] ☑ │  ← Toggle bypass
│    Threshold: [-40 dB]  │
│    Attack:    [0.5 ms]  │
│    Hold:      [50 ms]   │
│    Release:   [50 ms]   │
│ ─────────────────────── │
│ 2. [🎸 Amp Sim       ] ☑ │
│    Preset: [High Gain ▼]│
│    Gain:   [●────────]  │
│    Bass:   [──●──────]  │
│    Mid:    [────●────]  │
│    Treble: [──────●──]  │
│    Presence:[────●───]  │
│    Master: [──●──────]  │
│    Cabinet: [4x12 ▼]   │
│ ─────────────────────── │
│ 3. [🎛 EQ            ] ☑ │
│ 4. [🔊 Reverb        ] ☑ │
│ 5. [⏱ Delay         ] ☐ │  ← Bypassed
│ ─────────────────────── │
│ [+ Add Effect]          │
└─────────────────────────┘
```

---

## 11. Feature Priority Matrix

### Must-Have (MVP)

| Feature | Notes |
|---------|-------|
| Audio input from interface | `getUserMedia` with processing disabled |
| Multi-track recording | Record on armed tracks while playing back others |
| Transport controls | Play, stop, record, loop |
| Metronome with count-in | OscillatorNode-based click |
| Amp simulator (5 presets) | WaveShaperNode + BiquadFilterNode tonestack |
| Cabinet simulation | ConvolverNode with 3-4 IR files |
| Noise gate | AudioWorkletNode |
| Compressor | DynamicsCompressorNode |
| 3-band parametric EQ | 3x BiquadFilterNode |
| Reverb (4 types) | ConvolverNode with IR files |
| Delay (BPM sync) | DelayNode with feedback loop |
| Mixer with faders | GainNode per channel + StereoPannerNode |
| Solo / Mute per track | Connect/disconnect from bus |
| Peak metering | AnalyserNode |
| Waveform display | wavesurfer.js or Canvas rendering |
| WAV export | OfflineAudioContext + PCM encoding |
| MP3 export | lamejs library |
| Snap to grid | Beat, bar, off |
| Keyboard shortcuts | Space, R, L, K |
| Input monitoring | Auto / Always / Off |
| DI recording | Parallel dry signal capture |

### Nice-to-Have (Post-MVP)

| Feature | Notes |
|---------|-------|
| Overdrive/Boost pedal | Standalone pre-amp effect |
| Chorus effect | Modulated delay |
| Punch-in/punch-out | Record in specific region only |
| Stem export | Each track as separate file |
| Aux send/return buses | Shared reverb/delay |
| Markers / cue points | Named positions on timeline |
| Normalize on export | Peak normalization |
| RMS metering | Perceived loudness display |
| Snap subdivisions | 1/8, 1/16 grid |
| Zoom levels | Per-beat, per-bar, fit-to-window |
| Effect presets | Save/load effect chain presets |
| Undo/Redo | Audio edit history |

### Future

| Feature | Notes |
|---------|-------|
| Comping (multi-take) | Record lanes, select best parts |
| LUFS metering | Integrated loudness measurement |
| Dithering on export | Triangular PDF dither for 16-bit |
| Stereo widener | Master bus stereo processing |
| User-uploaded IRs | Load custom cabinet impulse responses |
| MIDI recording | Piano roll, drum machine |
| Virtual instruments | Synths, drums via Tone.js |
| Sidechain compression | Ducking effect |
| Automation lanes | Draw parameter changes over time |
| Audio time-stretching | Change tempo without pitch |

---

## Appendix A: Web Audio API Node Reference

### Complete Node Chain Per Track

```typescript
interface TrackAudioChain {
  // Input
  input: MediaStreamSourceNode;      // From getUserMedia
  inputGain: GainNode;               // Input gain staging

  // DI split
  diSplitter: GainNode;              // Parallel dry capture

  // Pre-amp effects
  noiseGate: AudioWorkletNode;       // Custom noise gate
  preCompressor: DynamicsCompressorNode;

  // Amp sim
  ampInputGain: GainNode;            // Drive/gain control
  ampWaveshaper: WaveShaperNode;     // Tube saturation
  ampBass: BiquadFilterNode;         // Tonestack low shelf
  ampMid: BiquadFilterNode;          // Tonestack mid peak
  ampTreble: BiquadFilterNode;       // Tonestack high shelf
  ampPresence: BiquadFilterNode;     // Presence high shelf
  ampMasterGain: GainNode;           // Master volume
  cabinetConvolver: ConvolverNode;   // Cabinet IR
  cabinetMakeupGain: GainNode;       // IR volume compensation

  // Post effects
  eqLow: BiquadFilterNode;          // Low shelf
  eqMid: BiquadFilterNode;          // Mid peak
  eqHigh: BiquadFilterNode;         // High shelf

  // Time-based effects (parallel wet/dry)
  delayNode: DelayNode;
  delayFeedback: GainNode;
  delayWet: GainNode;
  delayDry: GainNode;

  reverbConvolver: ConvolverNode;
  reverbWet: GainNode;
  reverbDry: GainNode;

  // Channel output
  channelGain: GainNode;            // Fader
  channelPan: StereoPannerNode;     // Pan
  channelAnalyser: AnalyserNode;    // Metering

  // Sends
  send1Gain: GainNode;              // To Aux 1
  send2Gain: GainNode;              // To Aux 2
}
```

### Master Bus Chain

```typescript
interface MasterBusChain {
  inputMerger: ChannelMergerNode;    // All channels merge here
  masterEqLow: BiquadFilterNode;
  masterEqMid: BiquadFilterNode;
  masterEqHigh: BiquadFilterNode;
  masterCompressor: DynamicsCompressorNode;  // Limiter
  masterGain: GainNode;              // Master fader
  masterAnalyser: AnalyserNode;     // Master metering
  destination: AudioDestinationNode;

  // For recording/export
  recorderDest: MediaStreamDestinationNode;
}
```

---

## Appendix B: Default IR Files Needed

Generate or source these impulse response files (public domain / CC0):

| File | Type | Duration | Description |
|------|------|----------|-------------|
| `cab_1x12_open.wav` | Cabinet | 0.5s | Bright open-back combo |
| `cab_2x12_closed.wav` | Cabinet | 0.5s | Balanced closed-back |
| `cab_4x12_metal.wav` | Cabinet | 0.5s | Tight modern metal 4x12 |
| `cab_4x12_vintage.wav` | Cabinet | 0.5s | Warm vintage 4x12 |
| `reverb_room.wav` | Reverb | 1.0s | Small room |
| `reverb_hall.wav` | Reverb | 3.0s | Concert hall |
| `reverb_plate.wav` | Reverb | 2.5s | Plate reverb |
| `reverb_spring.wav` | Reverb | 2.0s | Spring reverb |

**Format:** WAV, 44.1kHz, 24-bit, mono or stereo

---

## Appendix C: Sources

- [Soundtrap Online DAW Features](https://www.soundtrap.com/content/product/online-daw-features)
- [BandLab Creation Features](https://www.bandlab.com/creation-features)
- [4 Best Online DAWs 2025 - MIDINation](https://midination.com/daw/best-online-daw/)
- [5 Best Online DAWs - Musicfy](https://musicfy.lol/blog/best-online-daw)
- [Web Audio for Electric Guitar: Cabinet Emulation - Bobrov Dev](https://bobrov.dev/blog/web-audio-for-electric-guitar-cabinet-emulation/)
- [Web Audio for Electric Guitar: How to Connect Instrument - Bobrov Dev](https://bobrov.dev/blog/web-audio-for-electric-guitar-how-to-connect-instrument/)
- [WebAudio Guitar Amplifier Simulator - GitHub](https://github.com/micbuffa/WebAudio-Guitar-Amplifier-Simulator)
- [Complete Guide to Recording Guitar with Amp Sims - Home Music Creator](https://homemusiccreator.com/the-complete-guide-to-recording-guitar-with-amp-sims/)
- [How to Chain Guitar Amp Sim with Effects - MusicRadar](https://www.musicradar.com/how-to/how-to-chain-a-guitar-amp-sim-with-other-effects-in-your-daw)
- [DynamicsCompressorNode - MDN](https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode)
- [Web Audio API Specification](https://webaudio.github.io/web-audio-api/)
- [How to Add Effects to Audio - web.dev](https://web.dev/patterns/media/audio-effects)
- [Audio Mixer Channel Strip Guide - Audio University](https://audiouniversityonline.com/channel-strip/)
- [DAW Keyboard Shortcuts - Production Expert](https://www.production-expert.com/daw-keyboard-shortcuts)
- [Real-Time Emulation of Marshall JCM 800 - ACM](https://dl.acm.org/doi/fullHtml/10.1145/3184558.3186973)
