/**
 * dual-channel-mixer-processor
 *
 * AudioWorklet processor that mixes two stereo inputs (mic + browser tab audio)
 * into a single stereo output with per-channel gain control.
 *
 * Inputs:
 *   inputs[0] = mic stream (stereo)
 *   inputs[1] = browser tab stream (stereo)
 *
 * Output:
 *   outputs[0] = mixed stereo (mic * micGain + browser * browserGain, soft-clipped)
 *
 * Parameters (k-rate via port.postMessage, overrideable at runtime):
 *   micGain      default 1.15  (+1.2 dB) — user on top of backing track
 *   browserGain  default 0.75  (-2.5 dB)
 *   micHpCutoff  default 80 Hz (1-pole high-pass applied to mic only)
 *
 * Messages out (to main thread):
 *   { type: "peak", micL, micR, browserL, browserR, outL, outR }
 *     - posted once per render quantum (~2.7ms at 48kHz) for UI level meters
 *   { type: "clip", channel: "out" }
 *     - posted when soft-clip kicks in (abs(out) > 0.98 for >10ms in any 1s)
 *
 * Messages in (from main thread):
 *   { type: "setGain", micGain?, browserGain? }
 *   { type: "setHpCutoff", cutoffHz }
 */

class DualChannelMixerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // Default mixing ratios per AUDIO_SPEC.md §8.2
    this._micGain = 1.15;      // +1.2 dB
    this._browserGain = 0.75;  // -2.5 dB
    this._hpCutoff = 80;       // Hz

    // 1-pole highpass state for mic channels (L/R)
    this._hpPrevInL = 0;
    this._hpPrevOutL = 0;
    this._hpPrevInR = 0;
    this._hpPrevOutR = 0;

    // Clip detection — count samples exceeding 0.98 in a rolling 1s window
    this._clipWindowSamples = Math.floor(sampleRate); // 1 second
    this._clipThresholdSamples = Math.floor(sampleRate * 0.010); // 10ms
    this._clipCount = 0;
    this._clipWindowStart = 0;
    this._currentSample = 0;
    this._lastClipWarnAt = 0;

    // Recompute HP filter coefficient from cutoff
    this._recomputeHp();

    // Allow main thread overrides
    this.port.onmessage = (ev) => {
      const msg = ev.data || {};
      if (msg.type === "setGain") {
        if (typeof msg.micGain === "number") this._micGain = msg.micGain;
        if (typeof msg.browserGain === "number") this._browserGain = msg.browserGain;
      } else if (msg.type === "setHpCutoff") {
        if (typeof msg.cutoffHz === "number" && msg.cutoffHz > 0) {
          this._hpCutoff = msg.cutoffHz;
          this._recomputeHp();
        }
      }
    };

    // Honor initial options.processorOptions if provided
    const opts = (options && options.processorOptions) || {};
    if (typeof opts.micGain === "number") this._micGain = opts.micGain;
    if (typeof opts.browserGain === "number") this._browserGain = opts.browserGain;
    if (typeof opts.hpCutoff === "number" && opts.hpCutoff > 0) {
      this._hpCutoff = opts.hpCutoff;
      this._recomputeHp();
    }
  }

  _recomputeHp() {
    // 1-pole highpass — standard RC formulation
    const rc = 1 / (2 * Math.PI * this._hpCutoff);
    const dt = 1 / sampleRate;
    this._hpAlpha = rc / (rc + dt);
  }

  _hpStepL(x) {
    // y[n] = a * (y[n-1] + x[n] - x[n-1])
    const y = this._hpAlpha * (this._hpPrevOutL + x - this._hpPrevInL);
    this._hpPrevInL = x;
    this._hpPrevOutL = y;
    return y;
  }

  _hpStepR(x) {
    const y = this._hpAlpha * (this._hpPrevOutR + x - this._hpPrevInR);
    this._hpPrevInR = x;
    this._hpPrevOutR = y;
    return y;
  }

  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length === 0) return true;

    const outL = out[0];
    const outR = out.length > 1 ? out[1] : out[0];
    const frames = outL.length; // typically 128

    // Input resolution — mic input may be absent if nothing is connected
    const micIn = inputs[0];
    const browserIn = inputs[1];

    const micL = (micIn && micIn[0]) ? micIn[0] : null;
    const micR = (micIn && micIn[1]) ? micIn[1] : (micL || null);
    const bL = (browserIn && browserIn[0]) ? browserIn[0] : null;
    const bR = (browserIn && browserIn[1]) ? browserIn[1] : (bL || null);

    // Track peak levels for meter postMessage
    let peakMicL = 0, peakMicR = 0;
    let peakBrowserL = 0, peakBrowserR = 0;
    let peakOutL = 0, peakOutR = 0;

    const mg = this._micGain;
    const bg = this._browserGain;

    for (let i = 0; i < frames; i++) {
      // Raw samples from inputs (0 if channel missing)
      const rawMicL = micL ? micL[i] : 0;
      const rawMicR = micR ? micR[i] : 0;
      const rawBL = bL ? bL[i] : 0;
      const rawBR = bR ? bR[i] : 0;

      // High-pass the mic to kill subsonic rumble / stand vibration
      const hMicL = this._hpStepL(rawMicL);
      const hMicR = this._hpStepR(rawMicR);

      // Per-channel gain
      const gMicL = hMicL * mg;
      const gMicR = hMicR * mg;
      const gBL = rawBL * bg;
      const gBR = rawBR * bg;

      // Sum
      let sumL = gMicL + gBL;
      let sumR = gMicR + gBR;

      // Safety soft-clip — tanh(x * 0.95) rounds hot peaks without hard clipping
      // Using Math.tanh directly; no lookup table needed per spec simplicity
      const sL = Math.tanh(sumL * 0.95);
      const sR = Math.tanh(sumR * 0.95);

      outL[i] = sL;
      if (outR !== outL) outR[i] = sR;

      // Peak tracking
      const aMicL = Math.abs(rawMicL); if (aMicL > peakMicL) peakMicL = aMicL;
      const aMicR = Math.abs(rawMicR); if (aMicR > peakMicR) peakMicR = aMicR;
      const aBL = Math.abs(rawBL); if (aBL > peakBrowserL) peakBrowserL = aBL;
      const aBR = Math.abs(rawBR); if (aBR > peakBrowserR) peakBrowserR = aBR;
      const aOL = Math.abs(sL); if (aOL > peakOutL) peakOutL = aOL;
      const aOR = Math.abs(sR); if (aOR > peakOutR) peakOutR = aOR;

      // Clip detection over rolling 1s window
      if (aOL > 0.98 || aOR > 0.98) this._clipCount++;
      this._currentSample++;
      if (this._currentSample - this._clipWindowStart >= this._clipWindowSamples) {
        if (this._clipCount >= this._clipThresholdSamples &&
            this._currentSample - this._lastClipWarnAt >= this._clipWindowSamples) {
          this.port.postMessage({ type: "clip", channel: "out" });
          this._lastClipWarnAt = this._currentSample;
        }
        this._clipCount = 0;
        this._clipWindowStart = this._currentSample;
      }
    }

    // Post peak levels once per render quantum (~2.7ms at 48kHz)
    // UI polls these for level meters — cheap and accurate enough
    this.port.postMessage({
      type: "peak",
      micL: peakMicL,
      micR: peakMicR,
      browserL: peakBrowserL,
      browserR: peakBrowserR,
      outL: peakOutL,
      outR: peakOutR,
    });

    return true;
  }
}

registerProcessor("dual-channel-mixer-processor", DualChannelMixerProcessor);
