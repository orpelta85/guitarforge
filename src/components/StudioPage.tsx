"use client";
import { useState, useRef, useEffect, useCallback } from "react";

// ── Types ──
interface TrackEffects {
  reverb: { wet: number; decay: number; enabled: boolean };
  delay: { wet: number; time: number; feedback: number; enabled: boolean };
  distortion: { wet: number; amount: number; enabled: boolean };
  eq: { low: number; mid: number; high: number; enabled: boolean };
  chorus: { wet: number; frequency: number; depth: number; enabled: boolean };
}

interface StudioTrack {
  id: number;
  name: string;
  color: string;
  audioBlob: Blob | null;
  audioUrl: string | null;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  type: "recording" | "import" | "suno";
  effects: TrackEffects;
}

type ToneModule = typeof import("tone");

interface ToneNodes {
  player: InstanceType<ToneModule["Player"]>;
  eq: InstanceType<ToneModule["EQ3"]>;
  distortion: InstanceType<ToneModule["Distortion"]>;
  chorus: InstanceType<ToneModule["Chorus"]>;
  delay: InstanceType<ToneModule["FeedbackDelay"]>;
  reverb: InstanceType<ToneModule["Reverb"]>;
  channel: InstanceType<ToneModule["Channel"]>;
}

interface WaveSurferInstance {
  destroy: () => void;
  loadBlob: (blob: Blob) => Promise<void>;
  load: (url: string) => Promise<void>;
  setTime: (t: number) => void;
  zoom: (pxPerSec: number) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  getWrapper: () => HTMLElement;
}

const TRACK_COLORS = ["#C41E3A", "#D4A843", "#8b5cf6", "#06b6d4", "#22c55e", "#f97316"];

const DEFAULT_EFFECTS: TrackEffects = {
  reverb: { wet: 0, decay: 1.5, enabled: false },
  delay: { wet: 0, time: 0.25, feedback: 0.3, enabled: false },
  distortion: { wet: 0, amount: 0, enabled: false },
  eq: { low: 0, mid: 0, high: 0, enabled: false },
  chorus: { wet: 0, frequency: 1.5, depth: 0.7, enabled: false },
};

interface AmpPreset {
  name: string;
  label: string;
  effects: Partial<TrackEffects>;
}

const AMP_PRESETS: AmpPreset[] = [
  {
    name: "clean", label: "Clean",
    effects: {
      eq: { low: 2, mid: 0, high: 3, enabled: true },
      chorus: { wet: 0.2, frequency: 1.5, depth: 0.7, enabled: true },
      distortion: { wet: 0, amount: 0, enabled: false },
      delay: { wet: 0, time: 0.25, feedback: 0.3, enabled: false },
      reverb: { wet: 0, decay: 1.5, enabled: false },
    },
  },
  {
    name: "crunch", label: "Crunch",
    effects: {
      distortion: { wet: 0.4, amount: 0.3, enabled: true },
      eq: { low: 3, mid: 4, high: 1, enabled: true },
      chorus: { wet: 0, frequency: 1.5, depth: 0.7, enabled: false },
      delay: { wet: 0, time: 0.25, feedback: 0.3, enabled: false },
      reverb: { wet: 0, decay: 1.5, enabled: false },
    },
  },
  {
    name: "highgain", label: "High Gain",
    effects: {
      distortion: { wet: 0.8, amount: 0.7, enabled: true },
      eq: { low: 5, mid: 6, high: 2, enabled: true },
      reverb: { wet: 0.15, decay: 1.5, enabled: true },
      chorus: { wet: 0, frequency: 1.5, depth: 0.7, enabled: false },
      delay: { wet: 0, time: 0.25, feedback: 0.3, enabled: false },
    },
  },
  {
    name: "lead", label: "Lead",
    effects: {
      distortion: { wet: 0.6, amount: 0.5, enabled: true },
      delay: { wet: 0.3, time: 0.25, feedback: 0.3, enabled: true },
      reverb: { wet: 0.25, decay: 1.5, enabled: true },
      eq: { low: 0, mid: 0, high: 0, enabled: false },
      chorus: { wet: 0, frequency: 1.5, depth: 0.7, enabled: false },
    },
  },
  {
    name: "ambient", label: "Ambient",
    effects: {
      chorus: { wet: 0.4, frequency: 1.5, depth: 0.7, enabled: true },
      delay: { wet: 0.5, time: 0.25, feedback: 0.5, enabled: true },
      reverb: { wet: 0.6, decay: 5, enabled: true },
      distortion: { wet: 0, amount: 0, enabled: false },
      eq: { low: 0, mid: 0, high: 0, enabled: false },
    },
  },
];

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function StudioPage() {
  // ── State ──
  const [tracks, setTracks] = useState<StudioTrack[]>([]);
  const [isRec, setIsRec] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [masterVol, setMasterVol] = useState(80);
  const [bpm, setBpm] = useState(120);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [zoom, setZoom] = useState(50);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPanel, setShowPanel] = useState<"none" | "import" | "suno" | "youtube">("none");
  const [fxTrackId, setFxTrackId] = useState<number | null>(null);
  const [ytQuery, setYtQuery] = useState("");
  const [ytVideoId, setYtVideoId] = useState("");
  const [sunoScale, setSunoScale] = useState("Am");
  const [sunoMode, setSunoMode] = useState("Aeolian");
  const [sunoStyle, setSunoStyle] = useState("Blues Rock");
  const [sunoBpm, setSunoBpm] = useState(120);
  const [sunoLoading, setSunoLoading] = useState(false);
  const [sunoError, setSunoError] = useState("");

  // ── Refs ──
  const toneRef = useRef<ToneModule | null>(null);
  const masterGainRef = useRef<InstanceType<ToneModule["Gain"]> | null>(null);
  const toneNodesRef = useRef<Record<number, ToneNodes>>({});
  const wsRef = useRef<Record<number, WaveSurferInstance>>({});
  const recWsRef = useRef<WaveSurferInstance | null>(null);
  const recPluginRef = useRef<{ stopRecording: () => void; destroy: () => void } | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<number>(0);
  const metronomeRef = useRef<{
    loop: InstanceType<ToneModule["Loop"]>;
    synth: InstanceType<ToneModule["MembraneSynth"]>;
    gain: InstanceType<ToneModule["Gain"]>;
  } | null>(null);
  const ctr = useRef(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const trackContainersRef = useRef<Record<number, HTMLDivElement | null>>({});
  const recContainerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);

  // ── Tone.js initialization ──
  const ensureTone = useCallback(async () => {
    if (toneRef.current) return toneRef.current;
    const Tone = await import("tone");
    await Tone.start();
    toneRef.current = Tone;
    const gain = new Tone.Gain(masterVol / 100).toDestination();
    masterGainRef.current = gain;
    return Tone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Master volume sync ──
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = masterVol / 100;
    }
  }, [masterVol]);

  // ── Metronome ──
  const setupMetronome = useCallback(async () => {
    const Tone = await ensureTone();
    if (metronomeRef.current) return;
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    });
    const gain = new Tone.Gain(0.5).toDestination();
    synth.connect(gain);
    const loop = new Tone.Loop((time: number) => {
      synth.triggerAttackRelease("C2", "16n", time);
    }, "4n");
    metronomeRef.current = { loop, synth, gain };
  }, [ensureTone]);

  useEffect(() => {
    if (!metronomeRef.current) return;
    const Tone = toneRef.current;
    if (!Tone) return;
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    if (!metronomeRef.current) return;
    if (metronomeOn) {
      metronomeRef.current.loop.start(0);
    } else {
      metronomeRef.current.loop.stop();
    }
  }, [metronomeOn]);

  // ── Zoom sync ──
  useEffect(() => {
    const pxPerSec = 20 + (zoom / 100) * 300;
    Object.values(wsRef.current).forEach((ws) => {
      try { ws.zoom(pxPerSec); } catch { /* not ready */ }
    });
  }, [zoom]);

  // ── Solo/mute logic ──
  const applySoloMute = useCallback((trks: StudioTrack[]) => {
    const hasSolo = trks.some((t) => t.solo);
    trks.forEach((t) => {
      const nodes = toneNodesRef.current[t.id];
      if (!nodes) return;
      const audible = hasSolo ? t.solo : !t.muted;
      nodes.channel.mute = !audible;
    });
  }, []);

  // ── Apply effects to Tone nodes ──
  const applyEffects = useCallback((trackId: number, fx: TrackEffects) => {
    const nodes = toneNodesRef.current[trackId];
    if (!nodes) return;
    // EQ
    nodes.eq.low.value = fx.eq.enabled ? fx.eq.low : 0;
    nodes.eq.mid.value = fx.eq.enabled ? fx.eq.mid : 0;
    nodes.eq.high.value = fx.eq.enabled ? fx.eq.high : 0;
    // Distortion
    nodes.distortion.wet.value = fx.distortion.enabled ? fx.distortion.wet : 0;
    nodes.distortion.distortion = fx.distortion.amount;
    // Chorus
    nodes.chorus.wet.value = fx.chorus.enabled ? fx.chorus.wet : 0;
    nodes.chorus.frequency.value = fx.chorus.frequency;
    nodes.chorus.depth = fx.chorus.depth;
    // Delay
    nodes.delay.wet.value = fx.delay.enabled ? fx.delay.wet : 0;
    nodes.delay.feedback.value = fx.delay.feedback;
    // Reverb
    nodes.reverb.wet.value = fx.reverb.enabled ? fx.reverb.wet : 0;
    nodes.reverb.decay = Math.max(0.1, fx.reverb.decay);
  }, []);

  // ── Create Tone nodes for a track ──
  const createToneNodes = useCallback(async (track: StudioTrack): Promise<ToneNodes | null> => {
    if (!track.audioUrl) return null;
    const Tone = await ensureTone();
    const master = masterGainRef.current;
    if (!master) return null;

    const player = new Tone.Player({ url: track.audioUrl, loop: false });
    const eq = new Tone.EQ3(0, 0, 0);
    const distortion = new Tone.Distortion(0);
    distortion.wet.value = 0;
    const chorus = new Tone.Chorus(1.5, 0.7, 0);
    chorus.wet.value = 0;
    const delay = new Tone.FeedbackDelay(0.25, 0.3);
    delay.wet.value = 0;
    const reverb = new Tone.Reverb(1.5);
    reverb.wet.value = 0;
    const channel = new Tone.Channel(0, 0);

    player.chain(eq, distortion, chorus, delay, reverb, channel, master);

    // Set initial volume/pan
    const dbVol = track.volume > 0 ? 20 * Math.log10(track.volume / 100) : -Infinity;
    channel.volume.value = dbVol;
    channel.pan.value = track.pan / 100;

    const nodes: ToneNodes = { player, eq, distortion, chorus, delay, reverb, channel };
    toneNodesRef.current[track.id] = nodes;

    return nodes;
  }, [ensureTone]);

  // ── Create wavesurfer for a track ──
  const createWavesurfer = useCallback(async (track: StudioTrack, container: HTMLDivElement) => {
    const WaveSurfer = (await import("wavesurfer.js")).default;
    const ws = WaveSurfer.create({
      container,
      waveColor: track.color + "88",
      progressColor: track.color,
      cursorColor: "#D4A843",
      cursorWidth: 2,
      height: 64,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      interact: true,
      normalize: true,
      backend: "WebAudio",
      // We use it only visually; audio through Tone.js
      media: document.createElement("audio"),
    }) as unknown as WaveSurferInstance;

    // Load audio
    if (track.audioBlob) {
      await ws.loadBlob(track.audioBlob);
    } else if (track.audioUrl) {
      await ws.load(track.audioUrl);
    }

    // Click to seek -> sync Tone transport
    ws.on("interaction", (progress: unknown) => {
      const p = progress as number;
      const dur = ws.getDuration();
      if (dur > 0 && toneRef.current) {
        const seekTime = p * dur;
        // Sync all players
        Object.values(toneNodesRef.current).forEach((n) => {
          if (n.player.loaded) {
            n.player.seek(seekTime);
          }
        });
        // Sync all wavesurfers
        Object.values(wsRef.current).forEach((w) => {
          try { w.setTime(seekTime); } catch { /* skip */ }
        });
        setCurrentTime(seekTime);
      }
    });

    wsRef.current[track.id] = ws;

    // Update duration
    const dur = ws.getDuration();
    if (dur > 0) {
      setDuration((prev) => Math.max(prev, dur));
    }

    return ws;
  }, []);

  // ── Add track helper ──
  const addTrack = useCallback(async (name: string, url: string, type: StudioTrack["type"], blob?: Blob) => {
    ctr.current++;
    const id = ctr.current;
    const color = TRACK_COLORS[(id - 1) % TRACK_COLORS.length];
    const newTrack: StudioTrack = {
      id, name, color,
      audioBlob: blob || null,
      audioUrl: url,
      volume: 100,
      pan: 0,
      muted: false,
      solo: false,
      type,
      effects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS)),
    };
    setTracks((p) => [...p, newTrack]);

    // Wait for container to mount, then init wavesurfer + tone
    setTimeout(async () => {
      if (!mountedRef.current) return;
      const container = trackContainersRef.current[id];
      if (container) {
        await createWavesurfer(newTrack, container);
      }
      await createToneNodes(newTrack);
    }, 100);
  }, [createWavesurfer, createToneNodes]);

  // ── Recording ──
  const startRec = useCallback(async () => {
    if (!navigator.mediaDevices) { alert("Microphone not available"); return; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      mediaStreamRef.current = stream;

      const WaveSurfer = (await import("wavesurfer.js")).default;
      const RecordPlugin = (await import("wavesurfer.js/dist/plugins/record.js")).default;

      const recContainer = recContainerRef.current;
      if (!recContainer) { stream.getTracks().forEach((t) => t.stop()); return; }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";

      const record = RecordPlugin.create({
        mimeType,
        continuousWaveform: true,
        continuousWaveformDuration: 30,
      });

      const ws = WaveSurfer.create({
        container: recContainer,
        waveColor: "#C41E3A88",
        progressColor: "#C41E3A",
        cursorColor: "#C41E3A",
        cursorWidth: 2,
        height: 64,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        interact: false,
        plugins: [record],
      }) as unknown as WaveSurferInstance;

      recWsRef.current = ws;
      recPluginRef.current = record as unknown as { stopRecording: () => void; destroy: () => void };

      record.on("record-end", (blob: Blob) => {
        if (!mountedRef.current) return;
        const url = URL.createObjectURL(blob);
        addTrack(`Recording ${ctr.current + 1}`, url, "recording", blob);
        // Cleanup rec wavesurfer
        try { ws.destroy(); } catch { /* ok */ }
        recWsRef.current = null;
        recPluginRef.current = null;
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      });

      await record.startRecording({ deviceId: stream.getAudioTracks()[0].getSettings().deviceId });

      setIsRec(true);
      setRecTime(0);
      timerRef.current = setInterval(() => setRecTime((t) => t + 1), 1000);
    } catch (err) {
      alert("Microphone access denied: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [addTrack]);

  const stopRec = useCallback(() => {
    if (recPluginRef.current) {
      recPluginRef.current.stopRecording();
    }
    setIsRec(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Playback ──
  const playAll = useCallback(async () => {
    const Tone = await ensureTone();
    await setupMetronome();

    // Sync solo/mute
    setTracks((prev) => {
      applySoloMute(prev);
      return prev;
    });

    // Start all players from currentTime
    const startOffset = currentTime;
    Object.entries(toneNodesRef.current).forEach(([, nodes]) => {
      if (nodes.player.loaded) {
        try {
          nodes.player.start(Tone.now(), startOffset);
        } catch { /* already started */ }
      }
    });

    if (metronomeOn) {
      Tone.getTransport().bpm.value = bpm;
      Tone.getTransport().start();
    }

    setPlaying(true);

    const startWallTime = performance.now();
    const tickFn = () => {
      if (!mountedRef.current) return;
      const elapsed = (performance.now() - startWallTime) / 1000;
      const ct = startOffset + elapsed;

      // End of tracks reached
      if (ct >= duration && duration > 0) {
        if (looping) {
          // Loop: stop players, seek to 0, restart
          Object.values(toneNodesRef.current).forEach((nodes) => {
            try { nodes.player.stop(); nodes.player.start(undefined, 0); } catch { /* ok */ }
          });
          Object.values(wsRef.current).forEach((ws) => {
            try { ws.setTime(0); } catch { /* skip */ }
          });
          setCurrentTime(0);
          // Restart tick with new wall time reference
          const restartTickFn = () => {
            if (!mountedRef.current) return;
            const el2 = (performance.now() - performance.now()) / 1000;
            // Will be handled by re-calling playAll
          };
          // Simplest: just call stopAll then playAll again via state
          if (animRef.current) cancelAnimationFrame(animRef.current);
          setCurrentTime(0);
          // Re-trigger playback from start
          setTimeout(() => {
            Object.values(toneNodesRef.current).forEach((nodes) => {
              try { nodes.player.stop(); nodes.player.start(undefined, 0); } catch { /* ok */ }
            });
          }, 50);
          return;
        } else {
          // Auto-stop at end
          if (animRef.current) cancelAnimationFrame(animRef.current);
          setPlaying(false);
          setCurrentTime(duration);
          Object.values(toneNodesRef.current).forEach((nodes) => {
            try { nodes.player.stop(); } catch { /* ok */ }
          });
          return;
        }
      }

      setCurrentTime(ct);

      // Sync wavesurfers
      Object.values(wsRef.current).forEach((ws) => {
        try { ws.setTime(ct); } catch { /* skip */ }
      });

      animRef.current = requestAnimationFrame(tickFn);
    };
    animRef.current = requestAnimationFrame(tickFn);
  }, [ensureTone, setupMetronome, applySoloMute, currentTime, metronomeOn, bpm, duration, looping]);

  const stopAll = useCallback(() => {
    // Stop all Tone players
    Object.values(toneNodesRef.current).forEach((nodes) => {
      try { nodes.player.stop(); } catch { /* ok */ }
    });

    if (toneRef.current) {
      toneRef.current.getTransport().stop();
      toneRef.current.getTransport().position = 0;
    }

    if (animRef.current) cancelAnimationFrame(animRef.current);

    setPlaying(false);
    setCurrentTime(0);

    // Reset wavesurfers
    Object.values(wsRef.current).forEach((ws) => {
      try { ws.setTime(0); } catch { /* skip */ }
    });
  }, []);

  // ── Track controls ──
  const updateTrackVol = useCallback((id: number, vol: number) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, volume: vol } : t));
    const nodes = toneNodesRef.current[id];
    if (nodes) {
      const dbVol = vol > 0 ? 20 * Math.log10(vol / 100) : -Infinity;
      nodes.channel.volume.value = dbVol;
    }
  }, []);

  const updateTrackPan = useCallback((id: number, pan: number) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, pan } : t));
    const nodes = toneNodesRef.current[id];
    if (nodes) {
      nodes.channel.pan.value = pan / 100;
    }
  }, []);

  const toggleMute = useCallback((id: number) => {
    setTracks((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, muted: !t.muted } : t);
      applySoloMute(next);
      return next;
    });
  }, [applySoloMute]);

  const toggleSolo = useCallback((id: number) => {
    setTracks((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, solo: !t.solo } : t);
      applySoloMute(next);
      return next;
    });
  }, [applySoloMute]);

  const deleteTrack = useCallback((id: number) => {
    // Cleanup wavesurfer
    const ws = wsRef.current[id];
    if (ws) { try { ws.destroy(); } catch { /* ok */ } delete wsRef.current[id]; }

    // Cleanup Tone nodes
    const nodes = toneNodesRef.current[id];
    if (nodes) {
      try { nodes.player.stop(); } catch { /* ok */ }
      try { nodes.player.dispose(); } catch { /* ok */ }
      try { nodes.eq.dispose(); } catch { /* ok */ }
      try { nodes.distortion.dispose(); } catch { /* ok */ }
      try { nodes.chorus.dispose(); } catch { /* ok */ }
      try { nodes.delay.dispose(); } catch { /* ok */ }
      try { nodes.reverb.dispose(); } catch { /* ok */ }
      try { nodes.channel.dispose(); } catch { /* ok */ }
      delete toneNodesRef.current[id];
    }

    // Cleanup container ref
    delete trackContainersRef.current[id];

    setTracks((prev) => {
      const track = prev.find((t) => t.id === id);
      if (track?.audioUrl) URL.revokeObjectURL(track.audioUrl);
      return prev.filter((t) => t.id !== id);
    });

    if (fxTrackId === id) setFxTrackId(null);
  }, [fxTrackId]);

  // ── Effects update ──
  const updateTrackEffects = useCallback((id: number, fx: TrackEffects) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, effects: fx } : t));
    applyEffects(id, fx);
  }, [applyEffects]);

  const applyPreset = useCallback((id: number, preset: AmpPreset) => {
    const base = JSON.parse(JSON.stringify(DEFAULT_EFFECTS)) as TrackEffects;
    const merged: TrackEffects = {
      ...base,
      ...(preset.effects as Partial<TrackEffects>),
    };
    // Ensure all fields exist
    if (preset.effects.eq) merged.eq = { ...base.eq, ...preset.effects.eq };
    if (preset.effects.distortion) merged.distortion = { ...base.distortion, ...preset.effects.distortion };
    if (preset.effects.chorus) merged.chorus = { ...base.chorus, ...preset.effects.chorus };
    if (preset.effects.delay) merged.delay = { ...base.delay, ...preset.effects.delay };
    if (preset.effects.reverb) merged.reverb = { ...base.reverb, ...preset.effects.reverb };
    updateTrackEffects(id, merged);
  }, [updateTrackEffects]);

  // ── Import file ──
  const importFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const blob = file;
    addTrack(file.name.replace(/\.[^.]+$/, ""), url, "import", blob);
    setShowPanel("none");
  }, [addTrack]);

  // ── YouTube ──
  const extractVid = (url: string): string | null => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  const loadYt = () => {
    const vid = extractVid(ytQuery);
    if (vid) setYtVideoId(vid);
  };

  // ── Suno ──
  const generateSuno = useCallback(async () => {
    setSunoLoading(true);
    setSunoError("");
    try {
      const res = await fetch("/api/suno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scale: sunoScale, mode: sunoMode, style: sunoStyle, bpm: sunoBpm }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.tracks) {
        data.tracks.forEach((t: { title: string; audioUrl: string }) =>
          addTrack(t.title || "AI Track", t.audioUrl, "suno")
        );
      } else {
        throw new Error("No tracks returned");
      }
      setShowPanel("none");
    } catch (err) {
      setSunoError(err instanceof Error ? err.message : "Failed to generate track");
    }
    setSunoLoading(false);
  }, [sunoScale, sunoMode, sunoStyle, sunoBpm, addTrack]);

  // ── Export/Mixdown ──
  const exportMix = useCallback(async () => {
    if (tracks.length === 0) return;
    const Tone = await ensureTone();

    const maxDur = Math.max(...tracks.map((t) => {
      const ws = wsRef.current[t.id];
      return ws ? ws.getDuration() : 0;
    }), 1);

    try {
      const buffer = await Tone.Offline(async ({ transport }) => {
        const offGain = new Tone.Gain(masterVol / 100).toDestination();

        for (const track of tracks) {
          if (!track.audioUrl) continue;
          const hasSolo = tracks.some((t) => t.solo);
          const audible = hasSolo ? track.solo : !track.muted;
          if (!audible) continue;

          const player = new Tone.Player(track.audioUrl);
          const eq = new Tone.EQ3(
            track.effects.eq.enabled ? track.effects.eq.low : 0,
            track.effects.eq.enabled ? track.effects.eq.mid : 0,
            track.effects.eq.enabled ? track.effects.eq.high : 0,
          );
          const dist = new Tone.Distortion(track.effects.distortion.amount);
          dist.wet.value = track.effects.distortion.enabled ? track.effects.distortion.wet : 0;
          const ch = new Tone.Chorus(track.effects.chorus.frequency, track.effects.chorus.depth, 0);
          ch.wet.value = track.effects.chorus.enabled ? track.effects.chorus.wet : 0;
          const del = new Tone.FeedbackDelay(track.effects.delay.time, track.effects.delay.feedback);
          del.wet.value = track.effects.delay.enabled ? track.effects.delay.wet : 0;
          const rev = new Tone.Reverb(Math.max(0.1, track.effects.reverb.decay));
          rev.wet.value = track.effects.reverb.enabled ? track.effects.reverb.wet : 0;
          const chan = new Tone.Channel(
            track.volume > 0 ? 20 * Math.log10(track.volume / 100) : -Infinity,
            track.pan / 100,
          );

          player.chain(eq, dist, ch, del, rev, chan, offGain);
          await Tone.loaded();
          player.start(0);
        }

        transport.start(0);
      }, maxDur, 2, 44100);

      // Convert to WAV
      const wavBlob = audioBufferToWav(buffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guitarforge-mix-${Date.now()}.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      alert("Export failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [tracks, masterVol, ensureTone]);

  // ── WAV encoder ──
  function audioBufferToWav(buffer: { numberOfChannels: number; sampleRate: number; length: number; getChannelData: (ch: number) => Float32Array }): Blob {
    const numCh = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numCh * bytesPerSample;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const arrayBuf = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(arrayBuf);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numCh, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(36, "data");
    view.setUint32(40, dataSize, true);

    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch));

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numCh; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuf], { type: "audio/wav" });
  }

  // ── Cleanup on unmount ──
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);

      // Cleanup wavesurfers
      Object.values(wsRef.current).forEach((ws) => { try { ws.destroy(); } catch { /* ok */ } });
      if (recWsRef.current) { try { recWsRef.current.destroy(); } catch { /* ok */ } }

      // Cleanup tone nodes
      Object.values(toneNodesRef.current).forEach((nodes) => {
        try { nodes.player.stop(); } catch { /* ok */ }
        try { nodes.player.dispose(); } catch { /* ok */ }
        try { nodes.eq.dispose(); } catch { /* ok */ }
        try { nodes.distortion.dispose(); } catch { /* ok */ }
        try { nodes.chorus.dispose(); } catch { /* ok */ }
        try { nodes.delay.dispose(); } catch { /* ok */ }
        try { nodes.reverb.dispose(); } catch { /* ok */ }
        try { nodes.channel.dispose(); } catch { /* ok */ }
      });

      // Cleanup metronome
      if (metronomeRef.current) {
        try { metronomeRef.current.loop.dispose(); } catch { /* ok */ }
        try { metronomeRef.current.synth.dispose(); } catch { /* ok */ }
        try { metronomeRef.current.gain.dispose(); } catch { /* ok */ }
      }

      // Cleanup master
      if (masterGainRef.current) {
        try { masterGainRef.current.dispose(); } catch { /* ok */ }
      }

      // Cleanup media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── FX track reference ──
  const fxTrack = fxTrackId !== null ? tracks.find((t) => t.id === fxTrackId) : null;

  return (
    <div dir="rtl">
      {/* ── Header ── */}
      <div className="panel p-5 mb-3">
        <div className="font-heading text-xl font-bold text-[#D4A843]">Recording Studio</div>
        <div className="font-label text-[10px] text-[#555] mt-1">Record · Import · Mix · Export · Effects</div>
      </div>

      {/* ── Transport Bar ── */}
      <div className="panel p-4 mb-3">
        <div className="flex items-center gap-3 flex-wrap" dir="ltr">
          {/* Record */}
          {!isRec ? (
            <button onClick={startRec} title="Record"
              className="w-12 h-12 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex-shrink-0"
              style={{ background: "radial-gradient(circle at 40% 40%, #C41E3A, #7f1d1d 80%)", border: "2px solid #555" }} />
          ) : (
            <button onClick={stopRec} title="Stop Recording"
              className="w-12 h-12 rounded-full cursor-pointer flex items-center justify-center flex-shrink-0"
              style={{ background: "radial-gradient(circle at 40% 40%, #555, #222 80%)", border: "2px solid #555" }}>
              <div className="w-4 h-4 bg-[#ccc] rounded-sm" />
            </button>
          )}

          {/* Play/Stop */}
          {!playing ? (
            <button onClick={playAll} title="Play"
              className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center"
              style={{ background: tracks.length > 0 ? "linear-gradient(145deg, #33CC33, #1a8a1a)" : "linear-gradient(145deg, #444, #333)", border: "2px solid #555" }}
              disabled={tracks.length === 0}>
              <span className="text-[#0A0A0A] text-sm ml-0.5">&#9654;</span>
            </button>
          ) : (
            <button onClick={stopAll} title="Stop"
              className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center"
              style={{ background: "linear-gradient(145deg, #888, #444)", border: "2px solid #555" }}>
              <div className="w-3 h-3 bg-[#ccc] rounded-sm" />
            </button>
          )}

          {/* Loop */}
          <button onClick={() => setLooping(!looping)} title="Loop"
            className={`w-8 h-8 rounded-sm cursor-pointer flex items-center justify-center text-xs font-bold border ${looping ? "border-[#D4A843] text-[#D4A843]" : "border-[#333] text-[#555]"}`}
            style={{ background: "#111" }}>
            &#8635;
          </button>

          {/* Recording timer */}
          {isRec && (
            <div className="flex items-center gap-2">
              <div className="led led-red" />
              <span className="font-readout text-xl text-[#C41E3A]">{fmtTime(recTime)}</span>
              <span className="font-label text-[9px] text-[#555]">REC</span>
            </div>
          )}

          {/* Time display */}
          <div className="segment-display !px-3 !py-1 text-sm flex items-center gap-1">
            <span>{fmtTime(currentTime)}</span>
            <span className="text-[#555]">/</span>
            <span className="text-[#888]">{fmtTime(duration)}</span>
          </div>

          {/* BPM */}
          <div className="flex items-center gap-1">
            <span className="font-label text-[8px] text-[#555]">BPM</span>
            <input type="number" min={40} max={300} value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="input input-gold !w-14 !text-xs !p-1 text-center" />
          </div>

          {/* Metronome */}
          <button onClick={async () => { await setupMetronome(); setMetronomeOn(!metronomeOn); }}
            title="Metronome"
            className={`w-8 h-8 rounded-sm cursor-pointer flex items-center justify-center text-[10px] font-bold border ${metronomeOn ? "border-[#D4A843] text-[#D4A843]" : "border-[#333] text-[#555]"}`}
            style={{ background: "#111" }}>
            &#9834;
          </button>

          <div className="flex-1" />

          {/* Master volume */}
          <div className="flex items-center gap-1">
            <span className="font-label text-[8px] text-[#555]">MST</span>
            <input type="range" min={0} max={100} value={masterVol}
              onChange={(e) => setMasterVol(Number(e.target.value))}
              className="w-16 accent-[#D4A843]" />
            <span className="font-readout text-[10px] text-[#D4A843] w-7">{masterVol}</span>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <span className="font-label text-[8px] text-[#555]">ZOOM</span>
            <input type="range" min={0} max={100} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-14 accent-[#D4A843]" />
          </div>
        </div>

        {/* Source buttons row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap" dir="ltr">
          <button onClick={() => fileRef.current?.click()}
            className="btn-ghost !text-[10px]">Import</button>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]); }} />

          <button onClick={() => setShowPanel(showPanel === "youtube" ? "none" : "youtube")}
            className={`btn-ghost !text-[10px] ${showPanel === "youtube" ? "active" : ""}`}>YouTube</button>
          <button onClick={() => setShowPanel(showPanel === "suno" ? "none" : "suno")}
            className={`btn-ghost !text-[10px] ${showPanel === "suno" ? "active" : ""}`}>Suno AI</button>
          <button onClick={exportMix} disabled={tracks.length === 0}
            className="btn-gold !text-[10px]">Export WAV</button>
        </div>

        {/* VU meter */}
        <div className="vu mt-2">
          <div className="vu-fill" style={{ width: isRec ? "65%" : playing ? "40%" : "0%" }} />
        </div>
      </div>

      {/* ── YouTube Panel ── */}
      {showPanel === "youtube" && (
        <div className="panel p-4 mb-3">
          <div className="font-label text-[10px] text-[#D4A843] mb-2">YouTube — Paste URL to embed</div>
          <div className="flex gap-2 mb-3" dir="ltr">
            <input value={ytQuery} onChange={(e) => setYtQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadYt()}
              placeholder="Paste YouTube URL here..." className="input flex-1 !text-xs" />
            <button onClick={loadYt} className="btn-gold !text-[10px]">Load</button>
          </div>
          {ytVideoId && (
            <div className="aspect-video w-full rounded-sm overflow-hidden bg-black mb-2">
              <iframe src={`https://www.youtube.com/embed/${ytVideoId}?modestbranding=1&rel=0`}
                className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="YouTube" />
            </div>
          )}
          <div className="font-label text-[9px] text-[#555] mb-1" dir="rtl">חפש Backing Track:</div>
          <div className="flex gap-1 flex-wrap" dir="ltr">
            {["Am Blues Backing Track", "Rock Jam Track", "Metal Backing Track", "Funk Guitar Jam"].map((q) => (
              <button key={q} onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, "_blank")}
                className="btn-ghost !text-[9px] !px-2 !py-1">{q}</button>
            ))}
          </div>
          <div className="font-label text-[8px] text-[#333] mt-1" dir="rtl">העתק URL מ-YouTube והדבק למעלה</div>
        </div>
      )}

      {/* ── Suno Panel ── */}
      {showPanel === "suno" && (
        <div className="panel p-4 mb-3">
          <div className="font-label text-[10px] text-[#D4A843] mb-3">AI Backing Track (Suno)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3" dir="ltr">
            <label className="font-label text-[9px] text-[#555]">Key
              <input value={sunoScale} onChange={(e) => setSunoScale(e.target.value)} className="input mt-0.5 !text-xs" />
            </label>
            <label className="font-label text-[9px] text-[#555]">Mode
              <input value={sunoMode} onChange={(e) => setSunoMode(e.target.value)} className="input mt-0.5 !text-xs" />
            </label>
            <label className="font-label text-[9px] text-[#555]">Style
              <input value={sunoStyle} onChange={(e) => setSunoStyle(e.target.value)} className="input mt-0.5 !text-xs" />
            </label>
            <label className="font-label text-[9px] text-[#555]">BPM
              <input type="number" value={sunoBpm} onChange={(e) => setSunoBpm(Number(e.target.value))} className="input input-gold mt-0.5 !text-xs" />
            </label>
          </div>
          <button onClick={generateSuno} disabled={sunoLoading} className="btn-gold">
            {sunoLoading ? "...מייצר" : "ייצר טראק"}
          </button>
          <span className="font-label text-[9px] text-[#444] mr-2">דרוש SUNO_API_URL</span>
          {sunoError && <div className="font-label text-[10px] text-[#C41E3A] mt-2">{sunoError}</div>}
        </div>
      )}

      {/* ── Recording Waveform ── */}
      {isRec && (
        <div className="panel p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="led led-red" />
            <span className="font-label text-[11px] text-[#C41E3A]">מקליט...</span>
            <span className="font-readout text-sm text-[#C41E3A]">{fmtTime(recTime)}</span>
          </div>
          <div ref={recContainerRef} dir="ltr" className="bg-[#0A0A0A] rounded-sm border border-[#1a1a1a] overflow-hidden" />
        </div>
      )}

      {/* ── Track Lanes ── */}
      <div className="panel p-4 mb-3">
        <div className="font-label text-[11px] text-[#D4A843] mb-3 flex items-center gap-2" dir="rtl">
          <div className="led led-gold" /> מיקסר · {tracks.length} {tracks.length === 1 ? "טראק" : "טראקים"}
        </div>

        {tracks.length === 0 && !isRec && (
          <div className="text-center py-8">
            <div className="font-label text-sm text-[#333] mb-2" dir="rtl">אין טראקים עדיין</div>
            <div className="font-label text-[10px] text-[#222]" dir="rtl">לחץ על הכפתור האדום כדי להקליט, או ייבא קובץ אודיו</div>
          </div>
        )}

        {tracks.map((tr) => (
          <div key={tr.id} className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm mb-2 overflow-hidden">
            {/* Track header */}
            <div className="flex items-center gap-2 p-3" dir="ltr"
              style={{ borderRight: `4px solid ${tr.color}` }}>
              <div className={`led ${tr.muted ? "led-off" : "led-on"}`} />
              <span className="font-label text-[11px] text-[#aaa] flex-1 truncate">{tr.name}</span>

              {/* Mute */}
              <button onClick={() => toggleMute(tr.id)}
                className={`font-label text-[9px] px-2 py-0.5 rounded-sm cursor-pointer border ${!tr.muted ? "border-[#33CC33] text-[#33CC33]" : "border-[#333] text-[#555]"}`}>
                M
              </button>

              {/* Solo */}
              <button onClick={() => toggleSolo(tr.id)}
                className={`font-label text-[9px] px-2 py-0.5 rounded-sm cursor-pointer border ${tr.solo ? "border-[#D4A843] text-[#D4A843]" : "border-[#333] text-[#555]"}`}>
                S
              </button>

              {/* FX */}
              <button onClick={() => setFxTrackId(fxTrackId === tr.id ? null : tr.id)}
                className={`font-label text-[9px] px-2 py-0.5 rounded-sm cursor-pointer border ${fxTrackId === tr.id ? "border-[#8b5cf6] text-[#8b5cf6]" : "border-[#333] text-[#555]"}`}>
                FX
              </button>

              {/* Volume fader */}
              <div className="flex items-center gap-1">
                <span className="font-label text-[7px] text-[#444]">VOL</span>
                <input type="range" min={0} max={100} value={tr.volume}
                  onChange={(e) => updateTrackVol(tr.id, Number(e.target.value))}
                  className="w-16 accent-[#D4A843]" />
                <span className="font-readout text-[9px] text-[#555] w-6">{tr.volume}</span>
              </div>

              {/* Pan knob */}
              <div className="flex items-center gap-1">
                <span className="font-label text-[7px] text-[#444]">PAN</span>
                <input type="range" min={-100} max={100} value={tr.pan}
                  onChange={(e) => updateTrackPan(tr.id, Number(e.target.value))}
                  className="w-12 accent-[#D4A843]" />
                <span className="font-readout text-[9px] text-[#555] w-6">
                  {tr.pan === 0 ? "C" : tr.pan < 0 ? `L${Math.abs(tr.pan)}` : `R${tr.pan}`}
                </span>
              </div>

              {/* Delete */}
              <button onClick={() => deleteTrack(tr.id)}
                className="font-label text-[9px] px-2 py-0.5 rounded-sm cursor-pointer border border-[#333] text-[#C41E3A] hover:border-[#C41E3A]">
                DEL
              </button>
            </div>

            {/* Waveform */}
            <div
              ref={(el) => { if (el) trackContainersRef.current[tr.id] = el; }}
              dir="ltr"
              className="bg-[#080808] border-t border-[#1a1a1a] min-h-[64px]"
            />
          </div>
        ))}
      </div>

      {/* ── Effects Panel ── */}
      {fxTrack && (
        <div className="panel p-4 mb-3">
          <div className="font-label text-[11px] text-[#8b5cf6] mb-3 flex items-center gap-2" dir="ltr">
            <span>FX</span>
            <span className="text-[#aaa]">—</span>
            <span className="text-[#aaa]">{fxTrack.name}</span>
            <div className="w-3 h-3 rounded-full" style={{ background: fxTrack.color }} />
          </div>

          {/* Presets */}
          <div className="flex gap-2 mb-4 flex-wrap" dir="ltr">
            <span className="font-label text-[9px] text-[#555] self-center">PRESETS:</span>
            {AMP_PRESETS.map((p) => (
              <button key={p.name} onClick={() => applyPreset(fxTrack.id, p)}
                className="btn-ghost !text-[9px] !px-3 !py-1">{p.label}</button>
            ))}
            <button onClick={() => updateTrackEffects(fxTrack.id, JSON.parse(JSON.stringify(DEFAULT_EFFECTS)))}
              className="btn-ghost !text-[9px] !px-3 !py-1 !text-[#C41E3A] !border-[#C41E3A33]">Reset</button>
          </div>

          {/* EQ */}
          <EffectSection
            title="EQ3"
            enabled={fxTrack.effects.eq.enabled}
            onToggle={() => {
              const fx = { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, enabled: !fxTrack.effects.eq.enabled } };
              updateTrackEffects(fxTrack.id, fx);
            }}
          >
            <FxSlider label="Low" value={fxTrack.effects.eq.low} min={-12} max={12} step={0.5}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, low: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
            <FxSlider label="Mid" value={fxTrack.effects.eq.mid} min={-12} max={12} step={0.5}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, mid: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
            <FxSlider label="High" value={fxTrack.effects.eq.high} min={-12} max={12} step={0.5}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, high: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
          </EffectSection>

          {/* Distortion */}
          <EffectSection
            title="Distortion"
            enabled={fxTrack.effects.distortion.enabled}
            onToggle={() => {
              const fx = { ...fxTrack.effects, distortion: { ...fxTrack.effects.distortion, enabled: !fxTrack.effects.distortion.enabled } };
              updateTrackEffects(fxTrack.id, fx);
            }}
          >
            <FxSlider label="Wet" value={fxTrack.effects.distortion.wet} min={0} max={1} step={0.01}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, distortion: { ...fxTrack.effects.distortion, wet: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
            <FxSlider label="Amount" value={fxTrack.effects.distortion.amount} min={0} max={1} step={0.01}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, distortion: { ...fxTrack.effects.distortion, amount: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
          </EffectSection>

          {/* Chorus */}
          <EffectSection
            title="Chorus"
            enabled={fxTrack.effects.chorus.enabled}
            onToggle={() => {
              const fx = { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, enabled: !fxTrack.effects.chorus.enabled } };
              updateTrackEffects(fxTrack.id, fx);
            }}
          >
            <FxSlider label="Wet" value={fxTrack.effects.chorus.wet} min={0} max={1} step={0.01}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, wet: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
            <FxSlider label="Freq" value={fxTrack.effects.chorus.frequency} min={0.1} max={10} step={0.1}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, frequency: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
            <FxSlider label="Depth" value={fxTrack.effects.chorus.depth} min={0} max={1} step={0.01}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, depth: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
          </EffectSection>

          {/* Delay */}
          <EffectSection
            title="Delay"
            enabled={fxTrack.effects.delay.enabled}
            onToggle={() => {
              const fx = { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, enabled: !fxTrack.effects.delay.enabled } };
              updateTrackEffects(fxTrack.id, fx);
            }}
          >
            <FxSlider label="Wet" value={fxTrack.effects.delay.wet} min={0} max={1} step={0.01}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, wet: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
            <FxSlider label="Time" value={fxTrack.effects.delay.time} min={0.01} max={1} step={0.01}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, time: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
            <FxSlider label="Feedback" value={fxTrack.effects.delay.feedback} min={0} max={0.9} step={0.01}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, feedback: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
          </EffectSection>

          {/* Reverb */}
          <EffectSection
            title="Reverb"
            enabled={fxTrack.effects.reverb.enabled}
            onToggle={() => {
              const fx = { ...fxTrack.effects, reverb: { ...fxTrack.effects.reverb, enabled: !fxTrack.effects.reverb.enabled } };
              updateTrackEffects(fxTrack.id, fx);
            }}
          >
            <FxSlider label="Wet" value={fxTrack.effects.reverb.wet} min={0} max={1} step={0.01}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, reverb: { ...fxTrack.effects.reverb, wet: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
            <FxSlider label="Decay" value={fxTrack.effects.reverb.decay} min={0.1} max={10} step={0.1}
              onChange={(v) => {
                const fx = { ...fxTrack.effects, reverb: { ...fxTrack.effects.reverb, decay: v } };
                updateTrackEffects(fxTrack.id, fx);
              }} />
          </EffectSection>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function EffectSection({ title, enabled, onToggle, children }: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-[#0A0A0A] border border-[#1a1a1a] rounded-sm p-3 mb-2 ${!enabled ? "opacity-50" : ""}`} dir="ltr">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={onToggle}
          className={`w-4 h-4 rounded-sm cursor-pointer border text-[8px] flex items-center justify-center ${enabled ? "border-[#D4A843] bg-[#D4A843] text-[#0A0A0A]" : "border-[#333] text-[#333]"}`}>
          {enabled ? "✓" : ""}
        </button>
        <span className="font-label text-[10px] text-[#aaa]">{title}</span>
      </div>
      <div className="flex gap-4 flex-wrap">
        {children}
      </div>
    </div>
  );
}

function FxSlider({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <span className="font-label text-[7px] text-[#555]">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 accent-[#D4A843]"
        style={{ writingMode: "horizontal-tb" }} />
      <span className="font-readout text-[8px] text-[#666]">{typeof value === "number" ? value.toFixed(step < 1 ? 2 : 0) : value}</span>
    </div>
  );
}
