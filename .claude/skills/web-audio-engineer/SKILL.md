---
name: web-audio-engineer
description: Browser audio engineering for GuitarForge. Use when working on recording quality, effects chains, mixing, export, sound improvement, amp simulation, tab playback audio, or any audio-related code. Triggers on audio files (RecorderBox, SongRecorder, StudioPage, GpFileUploader, audioMix, JamLooper, LooperBox, AudioAnalyzer, MetronomeBox, DailyRecorderBox), or when user mentions "sound quality", "recording", "effects", "mixer", "export audio", "cabinet IR", "amp sim", "tone", "latency".
---

# Web Audio Engineer - GuitarForge

Expert knowledge for all audio engineering in the browser. Covers recording, effects, mixing, export, and tab playback sound quality.

---

## 1. Project Audio Architecture

### Audio Files Map

| File | Purpose | APIs Used |
|------|---------|-----------|
| `src/lib/audioMix.ts` | Decode blobs, mix 2 streams to WAV | AudioContext, OfflineAudioContext, ScriptProcessorNode (deprecated) |
| `src/components/RecorderBox.tsx` | Exercise recording (mic / dual mode) | getUserMedia, getDisplayMedia, MediaRecorder, GainNode |
| `src/components/SongRecorder.tsx` | Song-specific recording (near-identical to RecorderBox) | Same as RecorderBox |
| `src/components/DailyRecorderBox.tsx` | Full session recording with pause/resume | getUserMedia, MediaRecorder |
| `src/components/StudioPage.tsx` | Multi-track DAW: record, import, drums, mixdown | Tone.js (Player, Gain, MembraneSynth, Transport), wavesurfer.js, OfflineAudioContext |
| `src/components/StudioPage.old.tsx` | Previous DAW with full effects chain | Tone.js (EQ3, Distortion, Chorus, FeedbackDelay, Reverb, Channel) |
| `src/components/GpFileUploader.tsx` | Guitar Pro tab player with audio enhancement | alphaTab, Web Audio (BiquadFilter, DynamicsCompressor, ConvolverNode) |
| `src/components/LooperBox.tsx` | Layer looper | AudioContext, MediaRecorder, createOscillator |
| `src/components/JamLooper.tsx` | Jam mode looper | Same as LooperBox + WAV encoder |
| `src/components/MetronomeBox.tsx` | Standalone metronome | Web Audio oscillators |
| `src/components/AudioAnalyzer.tsx` | Pitch/timing analysis | AnalyserNode, autocorrelation |
| `src/components/FretboardChallenge.tsx` | Note playback | createOscillator (basic beeps) |

### Known Code Duplication
- **WAV encoder**: duplicated in 4 files (audioMix.ts, JamLooper.tsx, StudioPage.tsx, StudioPage.old.tsx)
- **Pitch detection**: duplicated in 3 files (AudioAnalyzer.tsx, PracticePage.tsx, LearningCenterPage.tsx)
- **Recording logic**: duplicated in 3 files (RecorderBox, SongRecorder, DailyRecorderBox)

---

## 2. Recording Best Practices

### getUserMedia Constraints for Guitar

```typescript
// Guitar-only recording (best quality)
const guitarConstraints: MediaStreamConstraints = {
  audio: {
    sampleRate: 48000,        // or 44100 - be explicit, don't rely on browser default
    channelCount: 1,          // mono is fine for single guitar
    echoCancellation: false,  // MUST be false for instrument recording
    noiseSuppression: false,  // MUST be false - degrades guitar tone
    autoGainControl: false,   // MUST be false - we want dynamic range
  }
};

// Dual mode (mic + tab audio) - echoCancellation degrades guitar sound
// Better approach: keep echoCancellation false, handle mixing in post
const dualConstraints: MediaStreamConstraints = {
  audio: {
    sampleRate: 48000,
    channelCount: 1,
    echoCancellation: false,  // even in dual mode, prefer false
    noiseSuppression: false,
    autoGainControl: false,
  }
};
```

### MediaRecorder Quality Settings

```typescript
const recorderOptions: MediaRecorderOptions = {
  mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/mp4',
  audioBitsPerSecond: 256000,  // 256kbps - high quality for music (default is often 128kbps)
};
```

### AudioContext Creation

```typescript
// Always specify sampleRate and latencyHint
const ctx = new AudioContext({
  sampleRate: 44100,           // consistent across all contexts
  latencyHint: 'interactive',  // lowest latency for monitoring
});
```

### Input Level Meter Pattern

```typescript
// Create an AnalyserNode for visual level metering (does NOT play audio back)
const analyser = ctx.createAnalyser();
analyser.fftSize = 2048;
const source = ctx.createMediaStreamSource(stream);
source.connect(analyser);
// DO NOT connect analyser to destination - avoids feedback

const dataArray = new Float32Array(analyser.fftSize);
function getLevel(): number {
  analyser.getFloatTimeDomainData(dataArray);
  let peak = 0;
  for (let i = 0; i < dataArray.length; i++) {
    peak = Math.max(peak, Math.abs(dataArray[i]));
  }
  return peak; // 0.0 to 1.0
}
```

### Latency Notes
- Browser audio has ~10-30ms latency minimum. ASIO/WASAPI not accessible from Web Audio.
- For real-time monitoring: tell users to use their audio interface's direct monitoring feature.
- The browser should record, not be the monitor - sidesteps latency entirely.
- `latencyHint: 'interactive'` helps but won't match native apps.

---

## 3. Effects Chain - Guitar Signal Path

### Correct Order (input to output)

```
Input -> Noise Gate -> Input Gain -> Compressor -> EQ Pre ->
Distortion (WaveShaperNode) -> Cabinet IR (ConvolverNode) ->
EQ Post -> Delay -> Reverb -> Master Limiter -> Output
```

### WaveShaperNode Distortion (Amp Simulation)

```typescript
function makeDistortionCurve(amount: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Soft clipping - tube-like warmth
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) /
               (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

const waveshaper = ctx.createWaveShaper();
waveshaper.curve = makeDistortionCurve(50); // 0-100 range
waveshaper.oversample = '4x'; // Anti-aliasing, reduces digital harshness
```

### Cabinet Impulse Response (BIGGEST sound quality win)

The current `createImpulseResponse()` in GpFileUploader generates random noise with exponential decay - this sounds like generic reverb, NOT a guitar cabinet.

**A real cabinet IR transforms thin SoundFont/MIDI output into amp-like tone.**

```typescript
// Load a real cabinet IR (small WAV file, 10-50KB, stored in /public/audio/)
async function loadCabinetIR(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

// Use it
const cabConvolver = ctx.createConvolver();
cabConvolver.buffer = await loadCabinetIR(ctx, '/audio/cab-mesa-v30.wav');
// Connect: distortion -> cabConvolver -> next node
```

**Free IR sources**: Celestion (official), Ownhammer (free packs), GuitarHack, Kalthallen.
Store as small WAV files in `/public/audio/` - typically 10-50KB each.

**Recommended IRs to include:**
- Clean cabinet (for clean/crunch tones)
- High-gain cabinet (Mesa/Marshall style for metal)
- Room reverb IR (for realistic spatial sound)

### Master Limiter (Prevents Clipping)

```typescript
// MUST be on every output path - playback and export
function createMasterLimiter(ctx: BaseAudioContext): DynamicsCompressorNode {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1;    // dBFS - catches only peaks
  limiter.knee.value = 0;          // hard knee for limiting
  limiter.ratio.value = 20;        // 20:1 = brick wall limiter
  limiter.attack.value = 0.003;    // 3ms - fast catch
  limiter.release.value = 0.01;    // 10ms - quick release
  return limiter;
}
```

### Tone.js Effects (for StudioPage)

The old StudioPage had these per track - restore them:

```typescript
import * as Tone from 'tone';

// Per-track effects chain
const eq = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
const compressor = new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.003, release: 0.25 });
const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.2 });
const channel = new Tone.Channel({ volume: 0, pan: 0 }); // volume in dB, pan -1 to 1

// Chain: player -> eq -> compressor -> reverb -> channel -> destination
player.chain(eq, compressor, reverb, channel, Tone.getDestination());

// Presets (from old StudioPage)
const PRESETS = {
  clean:   { eq: { low: 0, mid: 0, high: 0 }, dist: 0, chorus: 0, delay: 0, reverb: 0.15 },
  rock:    { eq: { low: 2, mid: 1, high: 3 }, dist: 0.3, chorus: 0, delay: 0.1, reverb: 0.2 },
  metal:   { eq: { low: 4, mid: -2, high: 5 }, dist: 0.6, chorus: 0, delay: 0, reverb: 0.15 },
  ambient: { eq: { low: -2, mid: 0, high: 2 }, dist: 0, chorus: 0.5, delay: 0.4, reverb: 0.6 },
  lofi:    { eq: { low: 3, mid: -3, high: -4 }, dist: 0.1, chorus: 0.3, delay: 0.15, reverb: 0.3 },
};
```

---

## 4. Mixing Best Practices

### Gain Staging
- Each track should have headroom. Start with -6dB per track.
- Sum of all tracks should not exceed 0dBFS before the master limiter.
- Use the master limiter as a safety net, not as the primary volume control.

### Pan Law
- StereoPannerNode uses equal-power panning by default (correct for music).
- Typical guitar mix: rhythm guitars hard left/right (0.7-1.0), lead center, bass center, drums center.

### Per-Track Metering

```typescript
// Create meter for each track using AnalyserNode
const meter = ctx.createAnalyser();
meter.fftSize = 256;
// Insert in chain: ... -> meter -> channel -> destination
// Read peak level in animation frame for UI display
```

### Offline Rendering (Export)

```typescript
// Mirror the EXACT same effects chain as live playback
const offlineCtx = new OfflineAudioContext(2, totalSamples, 44100);

// For each track: source -> effects -> gain -> pan -> master limiter -> destination
// The master limiter is CRITICAL for export to prevent clipping
const limiter = createMasterLimiter(offlineCtx);
limiter.connect(offlineCtx.destination);
// Connect all track outputs to limiter instead of destination
```

---

## 5. WAV Export Quality

### Current Issues
- 16-bit only, no dithering, no normalization
- WAV encoder duplicated across 4 files

### Improved WAV Encoder Pattern

```typescript
interface WavOptions {
  sampleRate?: number;    // default 44100
  bitDepth?: 16 | 24;    // default 16
  normalize?: boolean;    // default false - peak normalize to -0.3dBFS
  dither?: boolean;       // default false - TPDF dithering for 16-bit
}

function encodeWav(buffer: AudioBuffer, options: WavOptions = {}): Blob {
  const { sampleRate = 44100, bitDepth = 16, normalize = false, dither = false } = options;
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const bytesPerSample = bitDepth / 8;

  // Get interleaved samples
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  // Optional normalization
  if (normalize) {
    let peak = 0;
    for (const ch of channels) {
      for (let i = 0; i < ch.length; i++) {
        peak = Math.max(peak, Math.abs(ch[i]));
      }
    }
    const target = 0.97; // -0.3dBFS
    if (peak > 0) {
      const gain = target / peak;
      for (const ch of channels) {
        for (let i = 0; i < ch.length; i++) {
          ch[i] *= gain;
        }
      }
    }
  }

  // Encode to WAV with optional dithering
  const dataLength = length * numChannels * bytesPerSample;
  const headerLength = 44;
  const arrayBuffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(arrayBuffer);

  // WAV header...
  // (standard RIFF/WAVE header writing)

  // Sample writing with optional TPDF dithering
  let offset = headerLength;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];

      if (dither && bitDepth === 16) {
        // TPDF dithering - removes quantization artifacts
        const ditherNoise = (Math.random() - Math.random()) / 32768;
        sample += ditherNoise;
      }

      // Clamp
      sample = Math.max(-1, Math.min(1, sample));

      if (bitDepth === 16) {
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      } else if (bitDepth === 24) {
        const intSample = sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF;
        view.setUint8(offset, intSample & 0xFF);
        view.setUint8(offset + 1, (intSample >> 8) & 0xFF);
        view.setUint8(offset + 2, (intSample >> 16) & 0xFF);
        offset += 3;
      }
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
```

### MP3 Export (lamejs already in project)

```typescript
// lamejs types already exist at src/types/lamejs.d.ts
import lamejs from 'lamejs';

function encodeMP3(buffer: AudioBuffer, bitrate = 320): Blob {
  const encoder = new lamejs.Mp3Encoder(buffer.numberOfChannels, buffer.sampleRate, bitrate);
  // ... encode samples in chunks of 1152
  // Return Blob with type 'audio/mp3'
}
```

---

## 6. Tab Playback Enhancement (alphaTab)

### Current Chain in GpFileUploader
```
alphaTab output -> Lowpass 5kHz -> HighShelf -6dB@3kHz -> Compressor -> Reverb (synthetic) -> Master Gain
```

### Improved Chain
```
alphaTab output -> HighPass 80Hz (remove mud) -> Lowpass 6kHz ->
WaveShaperNode (mild saturation, warmth) -> Cabinet IR (ConvolverNode with real IR) ->
Compressor -> Room Reverb (ConvolverNode with room IR, dry/wet mix) -> Master Limiter -> Output
```

### Key Improvements
1. Replace synthetic impulse with real cabinet IR file (BIGGEST win)
2. Add mild WaveShaperNode saturation before cabinet (adds harmonics/body)
3. Add high-pass at 80Hz to remove low-end mud
4. Raise lowpass from 5kHz to 6kHz for cleaner tones (keep 5kHz for metal)
5. Add master limiter to prevent clipping

---

## 7. Metronome Sound Quality

### Current: oscillator beeps (1200Hz accent, 900Hz normal)

### Better: synthesized percussion samples

```typescript
// Create once, cache as AudioBuffer
function createClickSample(ctx: AudioContext, frequency: number, decay: number): AudioBuffer {
  const length = ctx.sampleRate * decay;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    // Short pitched click with fast exponential decay
    data[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 30);
    // Add a bit of noise for attack transient
    if (t < 0.002) data[i] += (Math.random() * 2 - 1) * 0.3 * (1 - t / 0.002);
  }
  return buffer;
}

const accentClick = createClickSample(ctx, 1500, 0.05);  // higher pitch, shorter
const normalClick = createClickSample(ctx, 1000, 0.04);   // lower pitch
```

---

## 8. Browser Compatibility Notes

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| MediaRecorder | webm/opus | webm/opus | mp4/aac (14.0+) | webm/opus |
| AudioWorklet | Yes | Yes | 14.1+ | Yes |
| ConvolverNode | Yes | Yes | Yes | Yes |
| WaveShaperNode | Yes | Yes | Yes | Yes |
| getDisplayMedia | Yes | Yes | 13+ | Yes |
| OfflineAudioContext | Yes | Yes | Yes | Yes |
| StereoPannerNode | Yes | Yes | 14.1+ | Yes |

### Safari Gotchas
- AudioContext requires user gesture to start (call `ctx.resume()` on click)
- No webm support - always fall back to mp4
- getDisplayMedia may not capture tab audio (system audio only)

---

## 9. Anti-Patterns to Avoid

- **ScriptProcessorNode** - deprecated, use AudioWorklet instead
- **Connecting mic to destination without headphones** - instant feedback loop
- **Not specifying sampleRate** on AudioContext - varies per system (22050 to 96000)
- **Not specifying audioBitsPerSecond** on MediaRecorder - browser defaults to low quality
- **Multiple AudioContext instances** - browsers limit to ~6, reuse contexts
- **Forgetting to disconnect nodes** - memory leak, nodes stay in graph
- **No master limiter** - summed tracks clip above 0dBFS, produces harsh digital distortion
- **Echo cancellation for instruments** - designed for voice, degrades guitar tone significantly

---

## 10. Priority Improvement Checklist

When improving audio quality in GuitarForge, follow this order:

### P0 - Quick Wins (minutes each)
- [ ] Add `audioBitsPerSecond: 256000` to all MediaRecorder instances
- [ ] Specify `sampleRate: 44100` on all AudioContext creations
- [ ] Add `latencyHint: 'interactive'` to AudioContext options
- [ ] Add master limiter to StudioPage export chain

### P1 - High Impact (hours each)
- [ ] Add real cabinet IR files to `/public/audio/` and use in GpFileUploader ConvolverNode
- [ ] Add WaveShaperNode saturation to GpFileUploader chain
- [ ] Restore per-track effects (EQ3, Reverb, Channel/Pan) from StudioPage.old.tsx
- [ ] Add pan control per track in current StudioPage

### P2 - Medium Impact
- [ ] Extract shared WAV encoder to `src/lib/wavEncoder.ts`
- [ ] Add normalization and dithering to WAV export
- [ ] Add MP3 export option using lamejs
- [ ] Add input level meter component for recording
- [ ] Better metronome sounds (synthesized percussion instead of beeps)

### P3 - Advanced
- [ ] Replace ScriptProcessorNode with AudioWorklet in audioMix.ts
- [ ] Build real-time guitar effects chain for monitoring
- [ ] Add per-track compressor to Studio
- [ ] Add solo button per track
- [ ] Custom SoundFont with better guitar patches for alphaTab
