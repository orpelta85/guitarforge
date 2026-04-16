"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { idbSaveRecording, idbLoadRecordings } from "@/lib/recorderIdb";
import type { SavedRecording } from "@/lib/types";
import { loadMetronomeVolume, saveMetronomeVolume, clickGain } from "@/lib/metronomeAudio";
import { buildCabinetIR, getCabinetPreset } from "@/lib/audioIr";
import {
  TAB_PLAYER_PRESETS,
  TAB_PLAYER_PRESET_LIST,
  buildShaperCurve,
  type TabPlayerPreset,
  type TabPlayerPresetId,
} from "@/lib/audioPresets";
import { sliderToGain, smoothParam } from "@/lib/audioMixHelpers";

interface Props {
  bpm: number;
  jamPlaying: boolean;
}

interface LoopLayer {
  id: number;
  buffer: AudioBuffer;
  volume: number;
  muted: boolean;
  solo: boolean;
}

type LooperState = "idle" | "countIn" | "recording" | "playing";

const MAX_LAYERS = 6;
const BAR_OPTIONS = [1, 2, 4, 8] as const;
const BEATS_PER_BAR = 4;
const COUNT_IN_BEATS = 4;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

// Encode a rendered AudioBuffer (mono or stereo) as 16-bit PCM WAV.
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = Math.min(buffer.numberOfChannels, 2);
  const sr = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = length * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

// Offline-render all audible layers through the playback-time effect chain
// (§4.6).  Result is stereo because the cabinet IR is stereo.  The dry layer
// buffers remain unchanged in state so live preset switching still works.
async function renderLayersWithChainOffline(
  layers: LoopLayer[],
  preset: TabPlayerPreset,
): Promise<AudioBuffer> {
  const audible = layers.filter(l => !l.muted);
  const src = audible.length > 0 ? audible : layers;
  if (src.length === 0) throw new Error("no layers");

  const sampleRate = src[0].buffer.sampleRate;
  const length = src[0].buffer.length;
  // Stereo output so the cabinet IR width survives.
  const offline = new OfflineAudioContext(2, length, sampleRate);

  // Rebuild the FX chain inside the offline context (IR cache keys by sample
  // rate so this is cheap even if the graph is reconstructed).
  const chainEntry = offline.createGain();
  const cabinet = offline.createConvolver();
  cabinet.normalize = false;
  cabinet.buffer = buildCabinetIR(offline as unknown as AudioContext, getCabinetPreset(preset.cabinet));
  const postCabGain = offline.createGain();
  postCabGain.gain.value = preset.postCabGain;
  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = preset.compThresholdDb;
  compressor.ratio.value = preset.compRatio;
  compressor.attack.value = preset.compAttackSec;
  compressor.release.value = preset.compReleaseSec;
  compressor.knee.value = preset.compKneeDb;
  const drySum = offline.createGain();
  drySum.gain.value = 1.0 - (preset.roomWetDefault * 0.5);
  const roomSend = offline.createGain();
  roomSend.gain.value = preset.roomWetDefault;
  const room = offline.createConvolver();
  room.normalize = false;
  room.buffer = buildCabinetIR(offline as unknown as AudioContext, getCabinetPreset(preset.room));
  const wetSum = offline.createGain();
  const limiter = offline.createDynamicsCompressor();
  limiter.threshold.value = preset.limiterThresholdDb;
  limiter.ratio.value = preset.limiterRatio;
  limiter.attack.value = preset.limiterAttackSec;
  limiter.release.value = preset.limiterReleaseSec;
  limiter.knee.value = preset.limiterKneeDb;

  chainEntry.connect(cabinet);
  cabinet.connect(postCabGain);
  postCabGain.connect(compressor);
  compressor.connect(drySum);
  compressor.connect(roomSend);
  roomSend.connect(room);
  drySum.connect(wetSum);
  room.connect(wetSum);
  wetSum.connect(limiter);
  limiter.connect(offline.destination);

  // Feed each layer through its own HP + WaveShaper into the chain entry.
  for (const layer of src) {
    const source = offline.createBufferSource();
    source.buffer = layer.buffer;
    const gain = offline.createGain();
    gain.gain.value = sliderToGain(layer.volume);
    const hp = offline.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = preset.highPassHz;
    hp.Q.value = preset.highPassQ;
    const shaper = offline.createWaveShaper();
    shaper.curve = buildShaperCurve(preset);
    shaper.oversample = preset.shaperOversample;
    source.connect(gain);
    gain.connect(hp);
    hp.connect(shaper);
    shaper.connect(chainEntry);
    source.start(0);
  }

  return offline.startRendering();
}

// Merge all unmuted layers into a single mono WAV blob (dry, unprocessed).
// Kept for backwards compatibility with existing callers.
function mergeLayersToWav(layers: LoopLayer[], sampleRate: number): Blob {
  const active = layers.filter(l => !l.muted);
  if (active.length === 0) return new Blob();

  const length = active[0].buffer.length;
  const mixed = new Float32Array(length);

  for (const layer of active) {
    const data = layer.buffer.getChannelData(0);
    for (let i = 0; i < Math.min(data.length, length); i++) {
      mixed[i] += data[i] * layer.volume;
    }
  }

  // Normalize if clipping
  let peak = 0;
  for (let i = 0; i < mixed.length; i++) {
    const abs = Math.abs(mixed[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 1) {
    for (let i = 0; i < mixed.length; i++) mixed[i] /= peak;
  }

  // Encode as 16-bit PCM WAV (always mono - we mix down to channel 0)
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = mixed.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < mixed.length; i++) {
    const s = Math.max(-1, Math.min(1, mixed[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

// Default Jam preset per AUDIO_SPEC §4.3 — Rock (broader mids are more
// forgiving of varied loop content: riffs, leads, chords, vocals).
const JAM_PRESET_STORAGE_KEY = "gf.jam.preset";
const DEFAULT_JAM_PRESET: TabPlayerPresetId = "rock";

function loadJamPreset(): TabPlayerPresetId {
  if (typeof window === "undefined") return DEFAULT_JAM_PRESET;
  const raw = localStorage.getItem(JAM_PRESET_STORAGE_KEY);
  if (raw && raw in TAB_PLAYER_PRESETS) return raw as TabPlayerPresetId;
  return DEFAULT_JAM_PRESET;
}

/** Nodes that make up the shared playback-time effect chain (AUDIO_SPEC §4.2). */
interface JamFxChain {
  // Input sink — per-layer sources connect here; each layer owns its own
  // highpass + waveshaper (cheap) and feeds this entry gain.
  chainEntry: GainNode;
  // Shared (post-per-layer) nodes.
  cabinet: ConvolverNode;
  postCabGain: GainNode;
  compressor: DynamicsCompressorNode;
  drySum: GainNode;
  roomSend: GainNode;
  room: ConvolverNode;
  wetSum: GainNode;
  limiter: DynamicsCompressorNode;
  // Name this chain was built for, so we can rebuild on preset swap.
  presetId: TabPlayerPresetId;
}

export default function JamLooper({ bpm, jamPlaying }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [bars, setBars] = useState<1 | 2 | 4 | 8>(2);
  const [layers, setLayers] = useState<LoopLayer[]>([]);
  const [state, setState] = useState<LooperState>("idle");
  const [countInBeat, setCountInBeat] = useState(-1);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [metVolume, setMetVolume] = useState(1);
  const [presetId, setPresetId] = useState<TabPlayerPresetId>(DEFAULT_JAM_PRESET);
  useEffect(() => { setMetVolume(loadMetronomeVolume()); }, []);
  useEffect(() => { setPresetId(loadJamPreset()); }, []);
  useEffect(() => { metVolumeRef.current = metVolume; }, [metVolume]);
  useEffect(() => { presetIdRef.current = presetId; }, [presetId]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(JAM_PRESET_STORAGE_KEY, presetId); } catch { /* ignore */ }
  }, [presetId]);

  // Refs - audio objects must live in refs to avoid stale closures
  const ctxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextClickTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const layerIdRef = useRef(0);
  // Per playing layer: the BufferSource, its own volume gain, and the HP/shaper
  // nodes that sit before the shared cabinet chain.  All disposed together.
  const loopSourcesRef = useRef<{
    layerId: number;
    source: AudioBufferSourceNode;
    gain: GainNode;
    highpass: BiquadFilterNode;
    shaper: WaveShaperNode;
  }[]>([]);
  const stateRef = useRef<LooperState>("idle");
  const layersRef = useRef(layers);
  const bpmRef = useRef(bpm);
  const barsRef = useRef(bars);
  const recordStartRef = useRef(0);
  const presetIdRef = useRef<TabPlayerPresetId>(DEFAULT_JAM_PRESET);
  const fxChainRef = useRef<JamFxChain | null>(null);

  // Keep refs in sync with state
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { barsRef.current = bars; }, [bars]);

  const loopDuration = (bars * BEATS_PER_BAR * 60) / bpm;
  const totalBeats = bars * BEATS_PER_BAR;

  function getOrCreateCtx(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctx({ sampleRate: 44100, latencyHint: "interactive" });
    }
    return ctxRef.current;
  }

  // Build (or reuse) the shared playback-time FX chain.  Layers all feed the
  // single cabinet convolver — this saves CPU vs one convolver per layer,
  // which is the correct architecture for a Jam session where every layer
  // shares the same tone.  See AUDIO_SPEC §4.2 "CPU note".
  function disposeFxChain(chain: JamFxChain) {
    try { chain.chainEntry.disconnect(); } catch { /* ok */ }
    try { chain.cabinet.disconnect(); } catch { /* ok */ }
    try { chain.postCabGain.disconnect(); } catch { /* ok */ }
    try { chain.compressor.disconnect(); } catch { /* ok */ }
    try { chain.drySum.disconnect(); } catch { /* ok */ }
    try { chain.roomSend.disconnect(); } catch { /* ok */ }
    try { chain.room.disconnect(); } catch { /* ok */ }
    try { chain.wetSum.disconnect(); } catch { /* ok */ }
    try { chain.limiter.disconnect(); } catch { /* ok */ }
  }

  function buildFxChain(ctx: AudioContext, preset: TabPlayerPreset): JamFxChain {
    const chainEntry = ctx.createGain();
    chainEntry.gain.value = 1;

    // Cabinet convolver — generated once per preset via math IR (§1).
    const cabinet = ctx.createConvolver();
    cabinet.normalize = false;
    cabinet.buffer = buildCabinetIR(ctx, getCabinetPreset(preset.cabinet));

    const postCabGain = ctx.createGain();
    postCabGain.gain.value = preset.postCabGain;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = preset.compThresholdDb;
    compressor.ratio.value = preset.compRatio;
    compressor.attack.value = preset.compAttackSec;
    compressor.release.value = preset.compReleaseSec;
    compressor.knee.value = preset.compKneeDb;

    const drySum = ctx.createGain();
    drySum.gain.value = 1.0 - (preset.roomWetDefault * 0.5);

    const roomSend = ctx.createGain();
    roomSend.gain.value = preset.roomWetDefault;

    const room = ctx.createConvolver();
    room.normalize = false;
    room.buffer = buildCabinetIR(ctx, getCabinetPreset(preset.room));

    const wetSum = ctx.createGain();
    wetSum.gain.value = 1;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = preset.limiterThresholdDb;
    limiter.ratio.value = preset.limiterRatio;
    limiter.attack.value = preset.limiterAttackSec;
    limiter.release.value = preset.limiterReleaseSec;
    limiter.knee.value = preset.limiterKneeDb;

    // Wire: chainEntry -> cabinet -> postCabGain -> compressor
    //       compressor -> drySum ---------------\
    //                                             wetSum -> limiter -> destination
    //       compressor -> roomSend -> room ----/
    chainEntry.connect(cabinet);
    cabinet.connect(postCabGain);
    postCabGain.connect(compressor);
    compressor.connect(drySum);
    compressor.connect(roomSend);
    roomSend.connect(room);
    drySum.connect(wetSum);
    room.connect(wetSum);
    wetSum.connect(limiter);
    limiter.connect(ctx.destination);

    return {
      chainEntry, cabinet, postCabGain, compressor,
      drySum, roomSend, room, wetSum, limiter,
      presetId: preset.id,
    };
  }

  function getOrBuildFxChain(ctx: AudioContext): JamFxChain {
    const preset = TAB_PLAYER_PRESETS[presetIdRef.current];
    const existing = fxChainRef.current;
    if (existing && existing.presetId === preset.id) return existing;
    if (existing) disposeFxChain(existing);
    const next = buildFxChain(ctx, preset);
    fxChainRef.current = next;
    return next;
  }

  // Check if any layer is soloed
  const hasSolo = layers.some(l => l.solo);

  function isLayerAudible(l: LoopLayer): boolean {
    if (l.muted) return false;
    if (hasSolo && !l.solo) return false;
    return true;
  }

  function clearScheduler() {
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
  }

  const metVolumeRef = useRef(1);
  // Schedule a click sound for metronome
  const scheduleClick = useCallback((ctx: AudioContext, time: number, accent: boolean) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = accent ? 1200 : 900;
    gain.gain.setValueAtTime(clickGain(accent ? "accent" : "normal", metVolumeRef.current), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.start(time);
    osc.stop(time + 0.05);
  }, []);

  // Metronome scheduler during recording
  const metronomeScheduler = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || stateRef.current !== "recording") return;

    const total = barsRef.current * BEATS_PER_BAR;
    const secsPerBeat = 60 / bpmRef.current;

    while (nextClickTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
      const beatIdx = currentBeatRef.current % total;
      scheduleClick(ctx, nextClickTimeRef.current, beatIdx === 0);

      const delay = Math.max(0, (nextClickTimeRef.current - ctx.currentTime) * 1000);
      const snap = beatIdx;
      setTimeout(() => setCurrentBeat(snap), delay);

      nextClickTimeRef.current += secsPerBeat;
      currentBeatRef.current++;
    }

    schedulerRef.current = setTimeout(metronomeScheduler, LOOKAHEAD_MS);
  }, [scheduleClick]);

  // Stop loop playback - disconnect all playing sources + per-layer FX nodes.
  const stopLoopPlayback = useCallback(() => {
    loopSourcesRef.current.forEach(({ source, gain, highpass, shaper }) => {
      try { source.stop(); } catch { /* already stopped */ }
      try { source.disconnect(); } catch { /* ok */ }
      try { gain.disconnect(); } catch { /* ok */ }
      try { highpass.disconnect(); } catch { /* ok */ }
      try { shaper.disconnect(); } catch { /* ok */ }
    });
    loopSourcesRef.current = [];
  }, []);

  // Start loop playback routed through the playback-time FX chain.
  // Per AUDIO_SPEC §4.2:
  //   BufferSource -> layer Gain -> layer HighPass -> layer WaveShaper
  //     -> SHARED cabinet -> postCabGain -> compressor -> split (dry/wet)
  //     -> limiter -> destination.
  // The recorded AudioBuffer is never modified — effects are playback-time
  // only, so preset swaps are retroactive and Save-to-Library can decide
  // whether to export dry or processed.
  const startLoopPlayback = useCallback((ctx: AudioContext, startTime: number) => {
    stopLoopPlayback();

    const current = layersRef.current;
    const anySolo = current.some(l => l.solo);
    const preset = TAB_PLAYER_PRESETS[presetIdRef.current];
    const chain = getOrBuildFxChain(ctx);

    current.forEach((layer) => {
      const audible = !layer.muted && (!anySolo || layer.solo);
      if (!audible) return;

      const source = ctx.createBufferSource();
      source.buffer = layer.buffer;
      source.loop = true;

      const gain = ctx.createGain();
      // Layer volume uses log slider curve (AUDIO_SPEC §7.1).
      gain.gain.value = sliderToGain(layer.volume);

      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = preset.highPassHz;
      highpass.Q.value = preset.highPassQ;

      const shaper = ctx.createWaveShaper();
      shaper.curve = buildShaperCurve(preset);
      shaper.oversample = preset.shaperOversample;

      // Wire: source -> gain -> HP -> shaper -> shared chain entry.
      source.connect(gain);
      gain.connect(highpass);
      highpass.connect(shaper);
      shaper.connect(chain.chainEntry);
      source.start(startTime);

      loopSourcesRef.current.push({
        layerId: layer.id, source, gain, highpass, shaper,
      });
    });
  }, [stopLoopPlayback]);

  // Beat scheduler for playback mode (no metronome clicks, just visual beat)
  const playBeatScheduler = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || stateRef.current !== "playing") return;

    const total = barsRef.current * BEATS_PER_BAR;
    const secsPerBeat = 60 / bpmRef.current;

    while (nextClickTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
      const beatIdx = currentBeatRef.current % total;
      const delay = Math.max(0, (nextClickTimeRef.current - ctx.currentTime) * 1000);
      const snap = beatIdx;
      setTimeout(() => setCurrentBeat(snap), delay);

      nextClickTimeRef.current += secsPerBeat;
      currentBeatRef.current++;
    }

    schedulerRef.current = setTimeout(playBeatScheduler, LOOKAHEAD_MS);
  }, []);

  // Record (with count-in)
  const startRecording = useCallback(async () => {
    if (layersRef.current.length >= MAX_LAYERS) return;

    const ctx = getOrCreateCtx();
    if (ctx.state === "suspended") await ctx.resume();

    // Request mic access — force mono 48kHz, all processing OFF
    // (echoCancellation/noiseSuppression/autoGainControl destroy guitar tone).
    if (!mediaStreamRef.current) {
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 48000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch (err) {
        console.error("Mic access denied:", err);
        return;
      }
    }

    setState("countIn");
    stateRef.current = "countIn";
    setCountInBeat(0);

    const secsPerBeat = 60 / bpmRef.current;

    // Count-in clicks
    const countInStart = ctx.currentTime;
    for (let i = 0; i < COUNT_IN_BEATS; i++) {
      scheduleClick(ctx, countInStart + i * secsPerBeat, i === 0);
      const snap = i;
      setTimeout(() => setCountInBeat(snap), i * secsPerBeat * 1000);
    }

    const countInDuration = COUNT_IN_BEATS * secsPerBeat;

    setTimeout(() => {
      // Verify we're still in countIn state (user may have stopped)
      if (stateRef.current !== "countIn") return;

      setState("recording");
      stateRef.current = "recording";
      setCountInBeat(-1);

      if (!mediaStreamRef.current) return;

      const pcmOk = MediaRecorder.isTypeSupported("audio/webm;codecs=pcm");
      const mimeType = pcmOk ? "audio/webm;codecs=pcm" :
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";

      // PCM is lossless; Opus fallback @ 256 kbps
      const recorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType,
        ...(pcmOk ? {} : { audioBitsPerSecond: 256000 }),
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        try {
          const arrayBuf = await blob.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(arrayBuf);

          // Trim/pad to exact loop length
          const loopSamples = Math.round(((barsRef.current * BEATS_PER_BAR * 60) / bpmRef.current) * ctx.sampleRate);
          const trimmed = ctx.createBuffer(audioBuf.numberOfChannels, loopSamples, ctx.sampleRate);
          for (let ch = 0; ch < audioBuf.numberOfChannels; ch++) {
            const src = audioBuf.getChannelData(ch);
            const dst = trimmed.getChannelData(ch);
            dst.set(src.subarray(0, Math.min(src.length, dst.length)));
          }

          const newLayer: LoopLayer = {
            id: ++layerIdRef.current,
            buffer: trimmed,
            volume: 1,
            muted: false,
            solo: false,
          };
          setLayers(prev => [...prev, newLayer]);
        } catch (err) {
          console.error("Failed to decode recorded audio:", err);
        }

        setState("idle");
        stateRef.current = "idle";
        clearScheduler();
        setCurrentBeat(-1);
        stopLoopPlayback();
      };

      recorderRef.current = recorder;
      recorder.start();

      recordStartRef.current = ctx.currentTime;

      // Start metronome during recording
      currentBeatRef.current = 0;
      nextClickTimeRef.current = ctx.currentTime;
      metronomeScheduler();

      // Play existing layers during overdub
      if (layersRef.current.length > 0) {
        startLoopPlayback(ctx, ctx.currentTime);
      }

      // Auto-stop after loop duration
      const dur = (barsRef.current * BEATS_PER_BAR * 60) / bpmRef.current;
      setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state === "recording") {
          recorderRef.current.stop();
          stopLoopPlayback();
        }
      }, dur * 1000 + 100);
    }, countInDuration * 1000);
  }, [scheduleClick, metronomeScheduler, startLoopPlayback, stopLoopPlayback]);

  // Play all layers
  const startPlaying = useCallback(async () => {
    if (layersRef.current.length === 0) return;
    const ctx = getOrCreateCtx();
    if (ctx.state === "suspended") await ctx.resume();

    setState("playing");
    stateRef.current = "playing";
    startLoopPlayback(ctx, ctx.currentTime);

    currentBeatRef.current = 0;
    nextClickTimeRef.current = ctx.currentTime;
    playBeatScheduler();
  }, [startLoopPlayback, playBeatScheduler]);

  // Stop playback
  const stopPlaying = useCallback(() => {
    setState("idle");
    stateRef.current = "idle";
    setCurrentBeat(-1);
    stopLoopPlayback();
    clearScheduler();
  }, [stopLoopPlayback]);

  // Stop everything (recording or playback)
  const stopAll = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    setState("idle");
    stateRef.current = "idle";
    setCountInBeat(-1);
    setCurrentBeat(-1);
    stopLoopPlayback();
    clearScheduler();
  }, [stopLoopPlayback]);

  // Clear all layers
  const clearAll = useCallback(() => {
    stopAll();
    setLayers([]);
  }, [stopAll]);

  // Layer controls - uses layerId to find the correct playing source.
  // Volume slider uses log curve (AUDIO_SPEC §7.1) and 15 ms smoothing (§7.3).
  const setLayerVolume = useCallback((layerId: number, vol: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, volume: vol } : l));
    const entry = loopSourcesRef.current.find(s => s.layerId === layerId);
    const ctx = ctxRef.current;
    if (entry && ctx) {
      smoothParam(entry.gain.gain, sliderToGain(vol), ctx.currentTime);
    }
  }, []);

  const toggleMute = useCallback((layerId: number) => {
    setLayers(prev => {
      const next = prev.map(l => l.id === layerId ? { ...l, muted: !l.muted } : l);
      // Immediately update ref so startLoopPlayback sees updated layers
      if (stateRef.current === "playing") {
        layersRef.current = next;
        const ctx = ctxRef.current;
        if (ctx) {
          stopLoopPlayback();
          startLoopPlayback(ctx, ctx.currentTime);
        }
      }
      return next;
    });
  }, [stopLoopPlayback, startLoopPlayback]);

  const toggleSolo = useCallback((layerId: number) => {
    setLayers(prev => {
      const next = prev.map(l => l.id === layerId ? { ...l, solo: !l.solo } : l);
      if (stateRef.current === "playing") {
        layersRef.current = next;
        const ctx = ctxRef.current;
        if (ctx) {
          stopLoopPlayback();
          startLoopPlayback(ctx, ctx.currentTime);
        }
      }
      return next;
    });
  }, [stopLoopPlayback, startLoopPlayback]);

  const deleteLayer = useCallback((layerId: number) => {
    const wasPlaying = stateRef.current === "playing";
    if (wasPlaying) stopLoopPlayback();
    setLayers(prev => {
      const next = prev.filter(l => l.id !== layerId);
      if (wasPlaying && next.length > 0) {
        layersRef.current = next;
        const ctx = ctxRef.current;
        if (ctx) startLoopPlayback(ctx, ctx.currentTime);
      } else if (next.length === 0) {
        setState("idle");
        stateRef.current = "idle";
        setCurrentBeat(-1);
        clearScheduler();
      }
      return next;
    });
  }, [stopLoopPlayback, startLoopPlayback]);

  // Save to Library — offline-renders layers through the active effect chain
  // (AUDIO_SPEC §4.6) so the exported WAV matches what the user heard during
  // playback.  Dry layer buffers remain in state for live preset switching.
  const saveToLibrary = useCallback(async () => {
    const currentLayers = layersRef.current;
    if (currentLayers.length === 0) return;
    setSaving(true);
    try {
      const ctx = getOrCreateCtx();
      const preset = TAB_PLAYER_PRESETS[presetIdRef.current];
      let blob: Blob;
      try {
        const rendered = await renderLayersWithChainOffline(currentLayers, preset);
        blob = audioBufferToWav(rendered);
      } catch {
        // Fallback: dry merge (old behaviour) if offline rendering fails
        // (e.g. browser lacks OfflineAudioContext.convolver support).
        blob = mergeLayersToWav(currentLayers, ctx.sampleRate);
      }
      if (blob.size === 0) {
        setSaving(false);
        return;
      }

      const now = new Date();
      const dt = now.toISOString();
      const name = `Jam Loop ${barsRef.current}bar ${bpmRef.current}bpm ${currentLayers.length}L`;

      const { list: existingList, blobs: existingBlobs } = await idbLoadRecordings("jam");
      const newIdx = Date.now();
      existingBlobs.set(newIdx, blob);

      const newRec: SavedRecording = {
        dt,
        d: URL.createObjectURL(blob),
        name,
      };
      const newList = [newRec, ...existingList];
      await idbSaveRecording("jam", newList, existingBlobs);

      setSavedMsg(`Saved: ${name}`);
      setTimeout(() => setSavedMsg(""), 3000);
    } catch {
      setSavedMsg("Save failed");
      setTimeout(() => setSavedMsg(""), 3000);
    }
    setSaving(false);
  }, []);

  // Swap effect preset live.  Per AUDIO_SPEC §4.4: the <5 ms seam is masked
  // by fading layer gains down 20 ms, swapping, then fading back up.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (stateRef.current !== "playing") {
      // Not playing — drop the old chain so the next play picks up the new preset.
      if (fxChainRef.current) {
        disposeFxChain(fxChainRef.current);
        fxChainRef.current = null;
      }
      return;
    }
    const now = ctx.currentTime;
    // Fade down.
    loopSourcesRef.current.forEach(({ gain }) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.020);
    });
    // After fade, rebuild chain + restart sources (smoother than per-node swap).
    window.setTimeout(() => {
      if (!ctxRef.current || stateRef.current !== "playing") return;
      if (fxChainRef.current) {
        disposeFxChain(fxChainRef.current);
        fxChainRef.current = null;
      }
      startLoopPlayback(ctxRef.current, ctxRef.current.currentTime);
    }, 25);
  }, [presetId, startLoopPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stateRef.current = "idle";
      clearScheduler();
      loopSourcesRef.current.forEach(({ source }) => {
        try { source.stop(); } catch { /* noop */ }
      });
      loopSourcesRef.current = [];
      if (fxChainRef.current) {
        disposeFxChain(fxChainRef.current);
        fxChainRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (recorderRef.current && recorderRef.current.state === "recording") {
        try { recorderRef.current.stop(); } catch { /* noop */ }
      }
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const canRecord = layers.length < MAX_LAYERS && state === "idle";
  const canPlay = layers.length > 0 && state === "idle";
  const isActive = state !== "idle";

  return (
    <div
      className="mt-4 sm:mt-6 rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #1a1a1e 0%, #141418 100%)",
        border: "1px solid #2a2a2e",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-[rgba(255,255,255,0.02)]"
        style={{
          borderBottom: expanded ? "1px solid #2a2a2e" : "none",
          borderLeft: `3px solid ${state === "recording" ? "#C41E3A" : state === "playing" || state === "countIn" ? "#D4A843" : "#333"}`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: state === "recording" ? "#C41E3A"
                : state === "playing" ? "#D4A843"
                : state === "countIn" ? "#D4A843"
                : "#444",
              boxShadow: state === "recording" ? "0 0 10px rgba(196,30,58,0.7)"
                : state === "playing" ? "0 0 10px rgba(212,168,67,0.6)"
                : "none",
            }}
          />
          <span className="text-sm font-bold text-[#e8e4dc] font-heading tracking-[0.12em]">LOOPER</span>
          {state === "recording" && (
            <span className="text-[10px] text-[#C41E3A] font-label animate-pulse">REC</span>
          )}
          {state === "countIn" && (
            <span className="text-[10px] text-[#D4A843] font-label animate-pulse">COUNT IN</span>
          )}
          {state === "playing" && (
            <span className="text-[10px] text-[#D4A843] font-label">PLAYING</span>
          )}
          {layers.length > 0 && (
            <span className="text-[9px] text-[#6b6560] font-label">{layers.length}/{MAX_LAYERS} layers</span>
          )}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b6560" strokeWidth="2"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 sm:px-4 py-3 sm:py-4">
          {/* Loop length + BPM display */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-[#6b6560] font-label uppercase tracking-wider">Loop</span>
            <div className="flex gap-1">
              {BAR_OPTIONS.map(b => (
                <button
                  key={b}
                  onClick={() => setBars(b)}
                  disabled={isActive || layers.length > 0}
                  className="text-[10px] px-2 py-1 rounded font-label transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: bars === b ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.05)",
                    color: bars === b ? "#D4A843" : "#6b6560",
                    border: `1px solid ${bars === b ? "rgba(212,168,67,0.4)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {b} {b === 1 ? "bar" : "bars"}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[10px] text-[#D4A843] font-mono font-bold">{bpm} BPM</span>
              <span className="text-[10px] text-[#555] font-mono">{loopDuration.toFixed(1)}s</span>
              <div className="flex items-center gap-1" title={`Metronome volume ${Math.round(metVolume * 100)}%`}>
                <span className="text-[9px] text-[#6b6560] font-label uppercase">Vol</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={metVolume}
                  onChange={(e) => { const v = parseFloat(e.target.value); setMetVolume(v); saveMetronomeVolume(v); }}
                  className="w-[60px] accent-[#D4A843]"
                />
              </div>
            </div>
          </div>

          {/* Tone preset selector — Metal / Rock / Clean.  Applied at playback
              time to every layer (AUDIO_SPEC §4.4); dry buffers stay in memory. */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-[#6b6560] font-label uppercase tracking-wider">Tone</span>
            <div className="flex gap-1">
              {TAB_PLAYER_PRESET_LIST.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPresetId(p.id)}
                  className="text-[10px] px-2 py-1 rounded font-label transition-all"
                  style={{
                    background: presetId === p.id ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.05)",
                    color: presetId === p.id ? "#D4A843" : "#6b6560",
                    border: `1px solid ${presetId === p.id ? "rgba(212,168,67,0.4)" : "rgba(255,255,255,0.08)"}`,
                  }}
                  title={`${p.label} cabinet + saturation preset`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Beat indicators */}
          {(state === "countIn" || state === "recording" || state === "playing") && (
            <div className="flex gap-1.5 justify-center mb-3 py-2 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
              {state === "countIn" ? (
                Array.from({ length: COUNT_IN_BEATS }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all"
                    style={{
                      width: 12,
                      height: 12,
                      background: countInBeat === i ? "#D4A843" : "#333",
                      transform: countInBeat === i ? "scale(1.3)" : "scale(1)",
                      boxShadow: countInBeat === i ? "0 0 10px rgba(212,168,67,0.6)" : "none",
                    }}
                  />
                ))
              ) : (
                Array.from({ length: totalBeats }).map((_, i) => {
                  const isDownbeat = i % BEATS_PER_BAR === 0;
                  const isCurrent = currentBeat === i;
                  return (
                    <div
                      key={i}
                      className="rounded-full transition-all"
                      style={{
                        width: isDownbeat ? 12 : 8,
                        height: isDownbeat ? 12 : 8,
                        background: isCurrent
                          ? isDownbeat ? "#D4A843" : "rgba(212,168,67,0.7)"
                          : isDownbeat ? "rgba(212,168,67,0.2)" : "#333",
                        transform: isCurrent ? "scale(1.3)" : "scale(1)",
                        boxShadow: isCurrent ? `0 0 8px rgba(212,168,67,${isDownbeat ? 0.6 : 0.3})` : "none",
                      }}
                    />
                  );
                })
              )}
            </div>
          )}

          {/* Count-in overlay */}
          {state === "countIn" && (
            <div className="flex items-center justify-center py-4 mb-3">
              <div
                className="text-5xl font-bold font-mono animate-pulse"
                style={{ color: "#D4A843", textShadow: "0 0 30px rgba(212,168,67,0.5)" }}
              >
                {COUNT_IN_BEATS - countInBeat}
              </div>
            </div>
          )}

          {/* Layers list */}
          <div className="space-y-1.5 mb-3">
            {layers.map((layer, i) => {
              const audible = isLayerAudible(layer);
              return (
                <div
                  key={layer.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderLeft: `3px solid ${audible ? "#D4A843" : "#333"}`,
                  }}
                >
                  <span className="text-[10px] text-[#6b6560] font-label w-14 flex-shrink-0">
                    Layer {i + 1}
                  </span>

                  {/* Waveform */}
                  <div className="flex-1 h-4">
                    <LayerWaveform buffer={layer.buffer} dimmed={!audible} />
                  </div>

                  {/* Volume */}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(layer.volume * 100)}
                    onChange={e => setLayerVolume(layer.id, Number(e.target.value) / 100)}
                    className="w-14 accent-[#D4A843] h-1 cursor-pointer"
                    title={`Volume: ${Math.round(layer.volume * 100)}%`}
                  />

                  {/* Mute */}
                  <button
                    onClick={() => toggleMute(layer.id)}
                    className="text-[9px] font-label px-2 py-1 rounded transition-all min-w-[32px] min-h-[28px]"
                    style={{
                      background: layer.muted ? "rgba(196,30,58,0.15)" : "rgba(255,255,255,0.05)",
                      color: layer.muted ? "#C41E3A" : "#6b6560",
                      border: `1px solid ${layer.muted ? "rgba(196,30,58,0.3)" : "rgba(255,255,255,0.1)"}`,
                    }}
                    title={layer.muted ? "Unmute" : "Mute"}
                  >
                    M
                  </button>

                  {/* Solo */}
                  <button
                    onClick={() => toggleSolo(layer.id)}
                    className="text-[9px] font-label px-2 py-1 rounded transition-all min-w-[32px] min-h-[28px]"
                    style={{
                      background: layer.solo ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.05)",
                      color: layer.solo ? "#D4A843" : "#6b6560",
                      border: `1px solid ${layer.solo ? "rgba(212,168,67,0.4)" : "rgba(255,255,255,0.1)"}`,
                    }}
                    title={layer.solo ? "Unsolo" : "Solo"}
                  >
                    S
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteLayer(layer.id)}
                    className="text-[#555] hover:text-[#C41E3A] transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
                    title="Delete layer"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              );
            })}

            {/* Empty state */}
            {layers.length === 0 && state === "idle" && (
              <div
                className="rounded-lg p-6 text-center flex flex-col items-center gap-2"
                style={{
                  border: "1px dashed rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.015)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(196,30,58,0.1)",
                    border: "1px solid rgba(196,30,58,0.25)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#C41E3A">
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                </div>
                <div className="text-[12px] text-[#9a9590] font-label font-semibold mt-1">No layers yet</div>
                <div className="text-[10px] text-[#6b6560] font-label">
                  Press <span className="text-[#ef4b63]">Record</span> to capture your first loop
                  {jamPlaying && " — synced to Jam BPM"}
                </div>
              </div>
            )}

            {/* Next empty slot indicator */}
            {layers.length > 0 && layers.length < MAX_LAYERS && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[#444]"
                style={{ border: "1px dashed rgba(255,255,255,0.06)" }}
              >
                <span className="text-[10px] font-label">Layer {layers.length + 1}: (empty)</span>
              </div>
            )}
          </div>

          {/* Main controls */}
          <div className="flex gap-2 mb-2">
            {/* Record / Overdub - prominent red gradient */}
            <button
              onClick={canRecord ? startRecording : state === "recording" ? stopAll : undefined}
              disabled={state === "countIn" || state === "playing"}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[12px] font-semibold font-label transition-all duration-150 active:scale-[0.98] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: state === "recording"
                  ? "linear-gradient(135deg, #dc2f4a, #9f152d)"
                  : "linear-gradient(135deg, rgba(196,30,58,0.18), rgba(196,30,58,0.08))",
                color: state === "recording" ? "#fff" : "#ef4b63",
                border: `1px solid ${state === "recording" ? "#dc2f4a" : "rgba(196,30,58,0.35)"}`,
                boxShadow: state === "recording"
                  ? "0 4px 18px rgba(196,30,58,0.4), inset 0 1px 0 rgba(255,255,255,0.2)"
                  : "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                {state === "recording" ? (
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                ) : (
                  <circle cx="12" cy="12" r="8" />
                )}
              </svg>
              {state === "recording" ? "Stop Rec"
                : layers.length === 0 ? "Record"
                : "Overdub"
              }
            </button>

            {/* Play / Stop */}
            {state !== "playing" ? (
              <button
                onClick={canPlay ? startPlaying : undefined}
                disabled={!canPlay}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[12px] font-semibold font-label transition-all duration-150 active:scale-[0.98] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, rgba(212,168,67,0.18), rgba(212,168,67,0.08))",
                  color: "#D4A843",
                  border: "1px solid rgba(212,168,67,0.35)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
                Play
              </button>
            ) : (
              <button
                onClick={stopPlaying}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-[12px] font-semibold font-label transition-all duration-150 active:scale-[0.98] hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, rgba(212,168,67,0.25), rgba(212,168,67,0.12))",
                  color: "#D4A843",
                  border: "1px solid rgba(212,168,67,0.45)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stop
              </button>
            )}
          </div>

          {/* Secondary controls: Clear All + Save to Library */}
          <div className="flex gap-2">
            {layers.length > 0 && (
              <button
                onClick={clearAll}
                disabled={state === "recording" || state === "countIn"}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-label transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: "transparent",
                  color: "#555",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Clear All
              </button>
            )}

            {layers.length > 0 && (
              <button
                onClick={saveToLibrary}
                disabled={saving || state === "recording" || state === "countIn"}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-label transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: "rgba(34,197,94,0.08)",
                  color: "#22c55e",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17,21 17,13 7,13 7,21" />
                  <polyline points="7,3 7,8 15,8" />
                </svg>
                {saving ? "Saving..." : "Save to Library"}
              </button>
            )}
          </div>

          {/* Saved message */}
          {savedMsg && (
            <div className="mt-2 text-center text-[10px] font-label" style={{ color: savedMsg.includes("failed") ? "#C41E3A" : "#22c55e" }}>
              {savedMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Mini waveform preview for a layer
function LayerWaveform({ buffer, dimmed }: { buffer: AudioBuffer; dimmed: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const color = dimmed ? "#333" : "#D4A843";

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    for (let i = 0; i < width; i++) {
      let min = 1;
      let max = -1;
      for (let j = 0; j < step; j++) {
        const idx = i * step + j;
        if (idx < data.length) {
          if (data[idx] < min) min = data[idx];
          if (data[idx] > max) max = data[idx];
        }
      }
      const yMin = ((1 + min) / 2) * height;
      const yMax = ((1 + max) / 2) * height;
      ctx.moveTo(i, yMin);
      ctx.lineTo(i, yMax);
    }
    ctx.stroke();
  }, [buffer, dimmed]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={16}
      className="w-full h-4 rounded"
      style={{ opacity: dimmed ? 0.3 : 0.8 }}
    />
  );
}
