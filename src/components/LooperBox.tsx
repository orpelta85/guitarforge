"use client";
import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  startBpm?: number;
  standalone?: boolean;
}

interface Layer {
  id: number;
  buffer: AudioBuffer;
  volume: number;
  muted: boolean;
  sourceNode?: AudioBufferSourceNode;
  gainNode?: GainNode;
}

const MAX_LAYERS = 6;
const BAR_OPTIONS = [1, 2, 4, 8] as const;
const BEATS_PER_BAR = 4;
const COUNT_IN_BEATS = 4;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

export default function LooperBox({ startBpm, standalone }: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextClickTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const isRecordingRef = useRef(false);
  const isPlayingRef = useRef(false);
  const loopSourcesRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode }[]>([]);
  const recordStartTimeRef = useRef(0);
  const layerIdRef = useRef(0);

  const [bpm, setBpm] = useState(startBpm ?? 120);
  const [bars, setBars] = useState<1 | 2 | 4 | 8>(2);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [countingIn, setCountingIn] = useState(false);
  const [countInBeat, setCountInBeat] = useState(-1);
  const [currentBeat, setCurrentBeat] = useState(-1);

  const bpmRef = useRef(bpm);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  const barsRef = useRef(bars);
  useEffect(() => { barsRef.current = bars; }, [bars]);

  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  const loopDuration = (bars * BEATS_PER_BAR * 60) / bpm;
  const totalBeats = bars * BEATS_PER_BAR;

  function getOrCreateCtx(): AudioContext {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }

  // Schedule a metronome click
  const scheduleClick = useCallback((time: number, accent: boolean) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = accent ? 1200 : 900;
    gain.gain.setValueAtTime(accent ? 0.3 : 0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.start(time);
    osc.stop(time + 0.05);
  }, []);

  // Metronome scheduler during recording
  const metronomeScheduler = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !isRecordingRef.current) return;

    const totalB = barsRef.current * BEATS_PER_BAR;
    const secsPerBeat = 60 / bpmRef.current;

    while (nextClickTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
      const beatIdx = currentBeatRef.current % totalB;
      const isDownbeat = beatIdx === 0;
      scheduleClick(nextClickTimeRef.current, isDownbeat);

      const delay = Math.max(0, (nextClickTimeRef.current - ctx.currentTime) * 1000);
      const snap = beatIdx;
      setTimeout(() => setCurrentBeat(snap), delay);

      nextClickTimeRef.current += secsPerBeat;
      currentBeatRef.current++;
    }

    schedulerRef.current = setTimeout(metronomeScheduler, LOOKAHEAD_MS);
  }, [scheduleClick]);

  // Start all loop sources for playback
  const startLoopPlayback = useCallback((ctx: AudioContext, startTime: number) => {
    // Stop any existing sources
    loopSourcesRef.current.forEach(({ source }) => {
      try { source.stop(); } catch {}
    });
    loopSourcesRef.current = [];

    const currentLayers = layersRef.current;
    currentLayers.forEach((layer) => {
      if (layer.muted) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = layer.buffer;
      source.loop = true;
      gain.gain.value = layer.volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(startTime);
      loopSourcesRef.current.push({ source, gain });
    });
  }, []);

  // Stop loop playback
  const stopLoopPlayback = useCallback(() => {
    loopSourcesRef.current.forEach(({ source }) => {
      try { source.stop(); } catch {}
    });
    loopSourcesRef.current = [];
  }, []);

  // Start recording (with count-in)
  const startRecording = useCallback(async () => {
    const ctx = getOrCreateCtx();
    if (ctx.state === "suspended") await ctx.resume();

    // Request microphone
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
      } catch {
        return; // User denied mic access
      }
    }

    setCountingIn(true);
    setCountInBeat(0);

    // Count-in: 4 beats
    const secsPerBeat = 60 / bpmRef.current;
    for (let i = 0; i < COUNT_IN_BEATS; i++) {
      scheduleClick(ctx.currentTime + i * secsPerBeat, i === 0);
      const snap = i;
      setTimeout(() => setCountInBeat(snap), i * secsPerBeat * 1000);
    }

    // After count-in, start recording
    const countInDuration = COUNT_IN_BEATS * secsPerBeat;
    setTimeout(() => {
      setCountingIn(false);
      setCountInBeat(-1);

      if (!mediaStreamRef.current) return;

      const pcmOk = MediaRecorder.isTypeSupported("audio/webm;codecs=pcm");
      const recorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType: pcmOk ? "audio/webm;codecs=pcm" :
          MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
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
          // Trim or pad to exact loop length
          const loopSamples = Math.round(loopDuration * ctx.sampleRate);
          const trimmed = ctx.createBuffer(
            audioBuf.numberOfChannels,
            loopSamples,
            ctx.sampleRate
          );
          for (let ch = 0; ch < audioBuf.numberOfChannels; ch++) {
            const src = audioBuf.getChannelData(ch);
            const dst = trimmed.getChannelData(ch);
            const len = Math.min(src.length, dst.length);
            dst.set(src.subarray(0, len));
          }

          const newLayer: Layer = {
            id: ++layerIdRef.current,
            buffer: trimmed,
            volume: 1,
            muted: false,
          };
          setLayers((prev) => [...prev, newLayer]);
        } catch {
          // Decoding failed
        }
        setRecording(false);
        isRecordingRef.current = false;
        if (schedulerRef.current) {
          clearTimeout(schedulerRef.current);
          schedulerRef.current = null;
        }
        setCurrentBeat(-1);
      };

      recorderRef.current = recorder;
      recorder.start();
      isRecordingRef.current = true;
      setRecording(true);
      recordStartTimeRef.current = ctx.currentTime;

      // Start metronome during recording
      currentBeatRef.current = 0;
      nextClickTimeRef.current = ctx.currentTime;
      metronomeScheduler();

      // Start loop playback of existing layers during overdub
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
      }, dur * 1000 + 50);
    }, countInDuration * 1000);
  }, [scheduleClick, metronomeScheduler, loopDuration, startLoopPlayback, stopLoopPlayback]);

  // Play all layers looped
  const startPlaying = useCallback(async () => {
    if (layers.length === 0) return;
    const ctx = getOrCreateCtx();
    if (ctx.state === "suspended") await ctx.resume();

    isPlayingRef.current = true;
    setPlaying(true);
    startLoopPlayback(ctx, ctx.currentTime);

    // Beat indicator scheduler
    currentBeatRef.current = 0;
    nextClickTimeRef.current = ctx.currentTime;

    const playBeatScheduler = () => {
      if (!isPlayingRef.current || !ctxRef.current) return;
      const total = barsRef.current * BEATS_PER_BAR;
      const secsPerBeat = 60 / bpmRef.current;

      while (nextClickTimeRef.current < ctxRef.current.currentTime + SCHEDULE_AHEAD_S) {
        const beatIdx = currentBeatRef.current % total;
        const delay = Math.max(0, (nextClickTimeRef.current - ctxRef.current.currentTime) * 1000);
        const snap = beatIdx;
        setTimeout(() => setCurrentBeat(snap), delay);
        nextClickTimeRef.current += secsPerBeat;
        currentBeatRef.current++;
      }
      schedulerRef.current = setTimeout(playBeatScheduler, LOOKAHEAD_MS);
    };
    playBeatScheduler();
  }, [layers.length, startLoopPlayback]);

  // Stop playback
  const stopPlaying = useCallback(() => {
    isPlayingRef.current = false;
    setPlaying(false);
    setCurrentBeat(-1);
    stopLoopPlayback();
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
  }, [stopLoopPlayback]);

  // Stop everything
  const stopAll = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    isRecordingRef.current = false;
    setRecording(false);
    setCountingIn(false);
    setCountInBeat(-1);
    stopPlaying();
  }, [stopPlaying]);

  // Clear all layers
  const clearAll = useCallback(() => {
    stopAll();
    setLayers([]);
  }, [stopAll]);

  // Update layer volume
  const setLayerVolume = useCallback((layerId: number, vol: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, volume: vol } : l))
    );
    // Update live gain if playing
    const idx = layersRef.current.findIndex((l) => l.id === layerId);
    if (idx >= 0 && loopSourcesRef.current[idx]) {
      loopSourcesRef.current[idx].gain.gain.value = vol;
    }
  }, []);

  // Toggle layer mute
  const toggleLayerMute = useCallback((layerId: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, muted: !l.muted } : l))
    );
    // If currently playing, need to restart playback
    if (isPlayingRef.current) {
      // Defer to next tick after state update
      setTimeout(() => {
        stopLoopPlayback();
        const ctx = ctxRef.current;
        if (ctx) startLoopPlayback(ctx, ctx.currentTime);
      }, 0);
    }
  }, [stopLoopPlayback, startLoopPlayback]);

  // Delete layer
  const deleteLayer = useCallback((layerId: number) => {
    const wasPlaying = isPlayingRef.current;
    if (wasPlaying) stopLoopPlayback();
    setLayers((prev) => {
      const next = prev.filter((l) => l.id !== layerId);
      if (wasPlaying && next.length > 0) {
        setTimeout(() => {
          const ctx = ctxRef.current;
          if (ctx) startLoopPlayback(ctx, ctx.currentTime);
        }, 0);
      } else if (next.length === 0) {
        stopAll();
      }
      return next;
    });
  }, [stopLoopPlayback, startLoopPlayback, stopAll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      isPlayingRef.current = false;
      if (schedulerRef.current) clearTimeout(schedulerRef.current);
      loopSourcesRef.current.forEach(({ source }) => {
        try { source.stop(); } catch {}
      });
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const canRecord = layers.length < MAX_LAYERS && !recording && !countingIn;
  const canPlay = layers.length > 0 && !recording && !countingIn;

  return (
    <div className={`panel p-4 ${standalone ? "" : "mb-3"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-label text-[10px] text-[#D4A843] flex items-center gap-2">
          <div className={`led ${recording ? "led-red" : playing ? "led-gold" : "led-off"}`} />
          LOOPER
          {recording && <span className="text-[#C41E3A] animate-pulse">REC</span>}
          {countingIn && <span className="text-[#D4A843] animate-pulse">COUNT IN...</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label text-[9px] text-[#555]">BPM</span>
          <input
            type="number"
            value={bpm}
            min={30}
            max={300}
            onChange={(e) => setBpm(Math.max(30, Math.min(300, Number(e.target.value))))}
            disabled={recording || playing}
            className="input !w-16 text-center !py-1 text-xs disabled:opacity-30"
          />
        </div>
      </div>

      {/* Loop length selector */}
      <div className="flex items-center gap-2 mb-3">
        <span className="font-label text-[9px] text-[#555]">Loop:</span>
        <div className="flex gap-1">
          {BAR_OPTIONS.map((b) => (
            <button
              key={b}
              onClick={() => setBars(b)}
              disabled={recording || playing || layers.length > 0}
              className={`font-label text-[10px] px-2.5 py-1 rounded cursor-pointer border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                bars === b
                  ? "bg-[#D4A843] text-[#121214] border-[#D4A843]"
                  : "border-[#333] text-[#666] hover:border-[#555]"
              }`}
            >
              {b} {b === 1 ? "bar" : "bars"}
            </button>
          ))}
        </div>
        <span className="font-readout text-[10px] text-[#444] ml-auto">
          {loopDuration.toFixed(1)}s
        </span>
      </div>

      {/* Layers */}
      <div className="space-y-1.5 mb-3">
        {layers.map((layer, i) => (
          <div
            key={layer.id}
            className="flex items-center gap-2 bg-[var(--bg-secondary)] rounded-lg px-3 py-2"
            style={{ borderLeft: `3px solid ${layer.muted ? "#333" : "#D4A843"}` }}
          >
            <span className="font-label text-[10px] text-[var(--text-secondary)] w-16 flex-shrink-0">
              Layer {i + 1}
            </span>

            {/* Waveform indicator */}
            <div className="flex-1 h-4 flex items-center">
              <WaveformPreview buffer={layer.buffer} muted={layer.muted} />
            </div>

            {/* Volume slider */}
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(layer.volume * 100)}
              onChange={(e) => setLayerVolume(layer.id, Number(e.target.value) / 100)}
              className="w-16 accent-[#D4A843] h-1 cursor-pointer"
              title={`Volume: ${Math.round(layer.volume * 100)}%`}
            />

            {/* Mute toggle */}
            <button
              onClick={() => toggleLayerMute(layer.id)}
              className={`font-label text-[9px] px-2 py-1 rounded cursor-pointer border transition-all min-w-[44px] min-h-[34px] ${
                layer.muted
                  ? "border-[#C41E3A] text-[#C41E3A] bg-[#C41E3A15]"
                  : "border-[#333] text-[#888]"
              }`}
              title={layer.muted ? "Unmute" : "Mute"}
            >
              {layer.muted ? "M" : "S"}
            </button>

            {/* Delete */}
            <button
              onClick={() => deleteLayer(layer.id)}
              className="text-[#555] hover:text-[#C41E3A] cursor-pointer transition-colors min-w-[34px] min-h-[34px] flex items-center justify-center"
              title="Delete layer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        ))}

        {/* Empty layer slots */}
        {layers.length < MAX_LAYERS && layers.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 border border-dashed border-[#222] text-[#333]">
            <span className="font-label text-[10px]">
              Layer {layers.length + 1}: (empty)
            </span>
          </div>
        )}

        {layers.length === 0 && !recording && !countingIn && (
          <div className="border border-dashed border-[#222] rounded-lg p-6 text-center">
            <div className="font-label text-[11px] text-[#444] mb-1">No layers yet</div>
            <div className="font-label text-[9px] text-[#333]">Press Record to start your first loop</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-3">
        {/* Record / Overdub */}
        <button
          onClick={canRecord ? startRecording : undefined}
          disabled={!canRecord}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-label text-[11px] cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
            recording
              ? "bg-[#C41E3A] text-white"
              : "bg-[#C41E3A20] text-[#C41E3A] border border-[#C41E3A40] hover:bg-[#C41E3A30]"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="8" />
          </svg>
          {layers.length === 0 ? "Record" : "Overdub"}
        </button>

        {/* Play / Stop */}
        {!playing ? (
          <button
            onClick={canPlay ? startPlaying : undefined}
            disabled={!canPlay}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-label text-[11px] cursor-pointer transition-all bg-[#D4A84320] text-[#D4A843] border border-[#D4A84340] hover:bg-[#D4A84330] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,4 20,12 6,20" />
            </svg>
            Play
          </button>
        ) : (
          <button
            onClick={stopPlaying}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-label text-[11px] cursor-pointer transition-all bg-[#D4A843] text-[#121214]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop
          </button>
        )}
      </div>

      {/* Stop + Clear row */}
      <div className="flex gap-2">
        {(recording || countingIn) && (
          <button
            onClick={stopAll}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-label text-[10px] cursor-pointer transition-all border border-[#333] text-[#888] hover:border-[#555]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop Recording
          </button>
        )}
        {layers.length > 0 && (
          <button
            onClick={clearAll}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-label text-[10px] cursor-pointer transition-all border border-[#333] text-[#555] hover:border-[#C41E3A40] hover:text-[#C41E3A]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Clear All
          </button>
        )}
      </div>

      {/* Beat indicators */}
      {(recording || playing || countingIn) && (
        <div className="flex gap-1.5 justify-center mt-3">
          {countingIn ? (
            Array.from({ length: COUNT_IN_BEATS }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  countInBeat === i ? "bg-[#D4A843] scale-125" : "bg-[#333]"
                }`}
                style={{ width: 10, height: 10 }}
              />
            ))
          ) : (
            Array.from({ length: totalBeats }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  currentBeat === i
                    ? i % BEATS_PER_BAR === 0
                      ? "bg-[#D4A843] scale-125"
                      : "bg-[#888]"
                    : "bg-[#333]"
                }`}
                style={{ width: i % BEATS_PER_BAR === 0 ? 10 : 7, height: i % BEATS_PER_BAR === 0 ? 10 : 7 }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Mini waveform preview for a layer
function WaveformPreview({ buffer, muted }: { buffer: AudioBuffer; muted: boolean }) {
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
    const color = muted ? "#333" : "#D4A843";

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
  }, [buffer, muted]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={16}
      className="w-full h-4 rounded"
      style={{ opacity: muted ? 0.3 : 0.8 }}
    />
  );
}
