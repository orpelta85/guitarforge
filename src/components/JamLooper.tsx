"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { idbSaveRecording, idbLoadRecordings } from "@/lib/recorderIdb";
import type { SavedRecording } from "@/lib/types";

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

// Merge all unmuted layers into a single mono WAV blob
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

export default function JamLooper({ bpm, jamPlaying }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [bars, setBars] = useState<1 | 2 | 4 | 8>(2);
  const [layers, setLayers] = useState<LoopLayer[]>([]);
  const [state, setState] = useState<LooperState>("idle");
  const [countInBeat, setCountInBeat] = useState(-1);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // Refs - audio objects must live in refs to avoid stale closures
  const ctxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextClickTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const layerIdRef = useRef(0);
  const loopSourcesRef = useRef<{ layerId: number; source: AudioBufferSourceNode; gain: GainNode }[]>([]);
  const stateRef = useRef<LooperState>("idle");
  const layersRef = useRef(layers);
  const bpmRef = useRef(bpm);
  const barsRef = useRef(bars);
  const recordStartRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { barsRef.current = bars; }, [bars]);

  const loopDuration = (bars * BEATS_PER_BAR * 60) / bpm;
  const totalBeats = bars * BEATS_PER_BAR;

  function getOrCreateCtx(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
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

  // Schedule a click sound for metronome
  const scheduleClick = useCallback((ctx: AudioContext, time: number, accent: boolean) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = accent ? 1200 : 900;
    gain.gain.setValueAtTime(accent ? 0.25 : 0.12, time);
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

  // Stop loop playback - disconnect all playing sources
  const stopLoopPlayback = useCallback(() => {
    loopSourcesRef.current.forEach(({ source }) => {
      try { source.stop(); } catch { /* already stopped */ }
    });
    loopSourcesRef.current = [];
  }, []);

  // Start loop playback of layers (reads from layersRef for freshness)
  const startLoopPlayback = useCallback((ctx: AudioContext, startTime: number) => {
    stopLoopPlayback();

    const current = layersRef.current;
    const anySolo = current.some(l => l.solo);

    current.forEach((layer) => {
      const audible = !layer.muted && (!anySolo || layer.solo);
      if (!audible) return;

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = layer.buffer;
      source.loop = true;
      gain.gain.value = layer.volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(startTime);
      loopSourcesRef.current.push({ layerId: layer.id, source, gain });
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

    // Request mic access
    if (!mediaStreamRef.current) {
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 2,
            sampleRate: 48000,
            sampleSize: 24,
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

      const recorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType,
        ...(pcmOk ? {} : { audioBitsPerSecond: 320000 }),
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

  // Layer controls - uses layerId to find the correct playing source
  const setLayerVolume = useCallback((layerId: number, vol: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, volume: vol } : l));
    // Update the live gain node directly for instant feedback
    const entry = loopSourcesRef.current.find(s => s.layerId === layerId);
    if (entry) {
      entry.gain.gain.value = vol;
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

  // Save to Library
  const saveToLibrary = useCallback(async () => {
    const currentLayers = layersRef.current;
    if (currentLayers.length === 0) return;
    setSaving(true);
    try {
      const ctx = getOrCreateCtx();
      const blob = mergeLayersToWav(currentLayers, ctx.sampleRate);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stateRef.current = "idle";
      clearScheduler();
      loopSourcesRef.current.forEach(({ source }) => {
        try { source.stop(); } catch { /* noop */ }
      });
      loopSourcesRef.current = [];
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
    <div className="mt-4 sm:mt-6 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
        style={{
          borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none",
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
          <span className="text-sm font-bold text-[#e8e4dc] font-heading tracking-wide">LOOPER</span>
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
                className="rounded-lg p-6 text-center"
                style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
              >
                <div className="text-[11px] text-[#555] font-label mb-1">No layers yet</div>
                <div className="text-[9px] text-[#444] font-label">
                  Press Record to start your first loop
                  {jamPlaying && " - synced to Jam Mode BPM"}
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
            {/* Record / Overdub */}
            <button
              onClick={canRecord ? startRecording : state === "recording" ? stopAll : undefined}
              disabled={state === "countIn" || state === "playing"}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-label transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: state === "recording" ? "#C41E3A"
                  : "rgba(196,30,58,0.1)",
                color: state === "recording" ? "#fff" : "#C41E3A",
                border: `1px solid ${state === "recording" ? "#C41E3A" : "rgba(196,30,58,0.3)"}`,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
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
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-label transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: "rgba(212,168,67,0.1)",
                  color: "#D4A843",
                  border: "1px solid rgba(212,168,67,0.3)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
                Play
              </button>
            ) : (
              <button
                onClick={stopPlaying}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-label transition-all"
                style={{
                  background: "rgba(212,168,67,0.2)",
                  color: "#D4A843",
                  border: "1px solid rgba(212,168,67,0.4)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
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
