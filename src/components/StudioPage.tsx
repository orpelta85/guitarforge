"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

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
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [editingTrackName, setEditingTrackName] = useState<number | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(240);
  const [bottomTab, setBottomTab] = useState<"fx" | "editor" | "none">("none");
  const [trackMenuId, setTrackMenuId] = useState<number | null>(null);
  const [vuLevels, setVuLevels] = useState<Record<number, number>>({});

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
  const sidebarDragRef = useRef(false);
  const bottomDragRef = useRef(false);
  const vuAnimRef = useRef<number>(0);

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

  // ── Track rename ──
  const renameTrack = useCallback((id: number, name: string) => {
    setTracks((p) => p.map((t) => t.id === id ? { ...t, name } : t));
  }, []);

  // ── VU meter simulation ──
  useEffect(() => {
    const tick = () => {
      if (!mountedRef.current) return;
      const levels: Record<number, number> = {};
      tracks.forEach((t) => {
        const hasSolo = tracks.some((tr) => tr.solo);
        const audible = hasSolo ? t.solo : !t.muted;
        if (playing && audible) {
          levels[t.id] = 0.3 + Math.random() * 0.5 + (t.volume / 100) * 0.2;
        } else if (isRec && t.type === "recording") {
          levels[t.id] = 0.4 + Math.random() * 0.4;
        } else {
          levels[t.id] = 0;
        }
      });
      setVuLevels(levels);
      vuAnimRef.current = requestAnimationFrame(tick);
    };
    if (playing || isRec) {
      vuAnimRef.current = requestAnimationFrame(tick);
    } else {
      setVuLevels({});
    }
    return () => { if (vuAnimRef.current) cancelAnimationFrame(vuAnimRef.current); };
  }, [playing, isRec, tracks]);

  // ── Resizable sidebar ──
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (sidebarDragRef.current) {
        const w = Math.max(160, Math.min(400, e.clientX));
        setSidebarWidth(w);
      }
      if (bottomDragRef.current) {
        const h = Math.max(150, Math.min(500, window.innerHeight - e.clientY));
        setBottomPanelHeight(h);
      }
    };
    const onMouseUp = () => {
      sidebarDragRef.current = false;
      bottomDragRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // ── Selected track for FX bottom panel ──
  const selectedTrack = useMemo(() =>
    selectedTrackId !== null ? tracks.find((t) => t.id === selectedTrackId) ?? null : null
  , [selectedTrackId, tracks]);

  // Open FX panel when selecting a track
  useEffect(() => {
    if (selectedTrackId !== null && bottomTab === "none") {
      setBottomTab("fx");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrackId]);

  // ── Measure ruler data ──
  const measures = useMemo(() => {
    const beatsPerMeasure = 4;
    const secPerBeat = 60 / bpm;
    const secPerMeasure = secPerBeat * beatsPerMeasure;
    const totalMeasures = duration > 0 ? Math.ceil(duration / secPerMeasure) + 1 : 8;
    return Array.from({ length: totalMeasures }, (_, i) => ({
      measure: i + 1,
      time: i * secPerMeasure,
      beats: Array.from({ length: beatsPerMeasure }, (_, b) => i * secPerMeasure + b * secPerBeat),
    }));
  }, [bpm, duration]);

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

  // FX track for bottom panel
  const fxTrack = selectedTrack ?? (fxTrackId !== null ? tracks.find((t) => t.id === fxTrackId) ?? null : null);

  const pxPerSec = 20 + (zoom / 100) * 300;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#0a0a0a" }} dir="ltr">
      {/* ── Top Transport Bar ── */}
      <div className="flex items-center h-11 px-2 gap-1 border-b border-[#222] flex-shrink-0" style={{ background: "#111" }}>
        {/* Left: BPM / Time Sig */}
        <div className="flex items-center gap-2 min-w-[160px]">
          <span className="font-label text-[8px] text-[#555] uppercase">BPM</span>
          <input type="number" min={40} max={300} value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-12 h-6 bg-[#1a1a1a] border border-[#333] rounded text-[#D4A843] text-xs text-center font-mono focus:border-[#D4A843] outline-none" />
          <span className="font-label text-[8px] text-[#555]">4/4</span>
        </div>

        {/* Center: Transport controls */}
        <div className="flex-1 flex items-center justify-center gap-2">
          {/* Record */}
          {!isRec ? (
            <button onClick={startRec} title="Record"
              className="w-8 h-8 rounded-full cursor-pointer transition-all hover:brightness-125 active:scale-95 flex-shrink-0"
              style={{ background: "radial-gradient(circle at 40% 40%, #C41E3A, #7f1d1d 80%)", border: "1px solid #444", boxShadow: "0 0 6px #C41E3A33" }} />
          ) : (
            <button onClick={stopRec} title="Stop Recording"
              className="w-8 h-8 rounded-full cursor-pointer flex items-center justify-center flex-shrink-0 hover:brightness-125"
              style={{ background: "radial-gradient(circle at 40% 40%, #555, #222 80%)", border: "1px solid #444" }}>
              <div className="w-3 h-3 bg-[#C41E3A] rounded-sm" />
            </button>
          )}

          {/* Stop */}
          <button onClick={stopAll} title="Stop"
            className="w-8 h-8 rounded-full cursor-pointer flex items-center justify-center hover:brightness-125"
            style={{ background: "linear-gradient(145deg, #333, #222)", border: "1px solid #444" }}>
            <div className="w-3 h-3 bg-[#888] rounded-sm" />
          </button>

          {/* Play */}
          {!playing ? (
            <button onClick={playAll} title="Play"
              className="w-9 h-9 rounded-full cursor-pointer flex items-center justify-center hover:brightness-125"
              style={{ background: tracks.length > 0 ? "linear-gradient(145deg, #33CC33, #1a8a1a)" : "linear-gradient(145deg, #333, #222)", border: "1px solid #444", boxShadow: tracks.length > 0 ? "0 0 8px #33CC3333" : "none" }}
              disabled={tracks.length === 0}>
              <span className="text-[#0A0A0A] text-xs ml-0.5">&#9654;</span>
            </button>
          ) : (
            <button onClick={stopAll} title="Pause"
              className="w-9 h-9 rounded-full cursor-pointer flex items-center justify-center hover:brightness-125"
              style={{ background: "linear-gradient(145deg, #D4A843, #a07830)", border: "1px solid #444", boxShadow: "0 0 8px #D4A84333" }}>
              <span className="text-[#0A0A0A] text-xs font-bold">II</span>
            </button>
          )}

          {/* Loop */}
          <button onClick={() => setLooping(!looping)} title="Loop"
            className={`w-7 h-7 rounded-full cursor-pointer flex items-center justify-center text-[10px] border transition-all hover:brightness-125 ${looping ? "border-[#D4A843] text-[#D4A843] shadow-[0_0_6px_#D4A84344]" : "border-[#333] text-[#555]"}`}
            style={{ background: "#1a1a1a" }}>
            &#8635;
          </button>

          {/* Metronome */}
          <button onClick={async () => { await setupMetronome(); setMetronomeOn(!metronomeOn); }}
            title="Metronome"
            className={`w-7 h-7 rounded-full cursor-pointer flex items-center justify-center text-[10px] border transition-all hover:brightness-125 ${metronomeOn ? "border-[#D4A843] text-[#D4A843] shadow-[0_0_6px_#D4A84344]" : "border-[#333] text-[#555]"}`}
            style={{ background: "#1a1a1a" }}>
            &#9834;
          </button>

          {/* Time display */}
          <div className="bg-[#0a0a0a] border border-[#333] rounded px-3 py-1 font-mono text-xs flex items-center gap-1 min-w-[100px] justify-center">
            <span className="text-[#D4A843]">{fmtTime(currentTime)}</span>
            <span className="text-[#333]">/</span>
            <span className="text-[#666]">{fmtTime(duration)}</span>
          </div>

          {/* Recording indicator */}
          {isRec && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#C41E3A] animate-pulse" />
              <span className="font-mono text-xs text-[#C41E3A]">{fmtTime(recTime)}</span>
            </div>
          )}
        </div>

        {/* Right: Master / Export */}
        <div className="flex items-center gap-3 min-w-[240px] justify-end">
          {/* Zoom */}
          <div className="flex items-center gap-1">
            <span className="font-label text-[7px] text-[#555]">ZOOM</span>
            <input type="range" min={0} max={100} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-12 accent-[#555] h-1" />
          </div>
          {/* Master volume */}
          <div className="flex items-center gap-1">
            <span className="font-label text-[7px] text-[#D4A843]">MST</span>
            <input type="range" min={0} max={100} value={masterVol}
              onChange={(e) => setMasterVol(Number(e.target.value))}
              className="w-16 accent-[#D4A843] h-1" />
            <span className="font-mono text-[9px] text-[#D4A843] w-6">{masterVol}</span>
          </div>
          <button onClick={exportMix} disabled={tracks.length === 0}
            className="text-[9px] font-semibold px-3 py-1 rounded border border-[#D4A843] text-[#D4A843] hover:bg-[#D4A843] hover:text-[#0a0a0a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
            Export
          </button>
        </div>
      </div>

      {/* ── Source buttons bar ── */}
      <div className="flex items-center h-8 px-2 gap-2 border-b border-[#222] flex-shrink-0" style={{ background: "#0e0e0e" }}>
        <button onClick={() => fileRef.current?.click()}
          className="text-[9px] px-2 py-0.5 rounded border border-[#333] text-[#888] hover:text-[#ccc] hover:border-[#555] transition-colors cursor-pointer">Import File</button>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]); }} />
        <button onClick={() => setShowPanel(showPanel === "youtube" ? "none" : "youtube")}
          className={`text-[9px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${showPanel === "youtube" ? "border-[#C41E3A] text-[#C41E3A]" : "border-[#333] text-[#888] hover:text-[#ccc] hover:border-[#555]"}`}>YouTube</button>
        <button onClick={() => setShowPanel(showPanel === "suno" ? "none" : "suno")}
          className={`text-[9px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${showPanel === "suno" ? "border-[#8b5cf6] text-[#8b5cf6]" : "border-[#333] text-[#888] hover:text-[#ccc] hover:border-[#555]"}`}>Suno AI</button>

        <div className="flex-1" />
        <span className="font-label text-[8px] text-[#333]">{tracks.length} tracks</span>
      </div>

      {/* ── YouTube / Suno overlay panels ── */}
      {showPanel === "youtube" && (
        <div className="border-b border-[#222] p-3" style={{ background: "#111" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-label text-[10px] text-[#C41E3A]">YouTube</span>
            <button onClick={() => setShowPanel("none")} className="text-[#555] hover:text-[#888] text-xs cursor-pointer ml-auto">X</button>
          </div>
          <div className="flex gap-2 mb-2">
            <input value={ytQuery} onChange={(e) => setYtQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadYt()}
              placeholder="Paste YouTube URL..." className="flex-1 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs text-[#ccc] outline-none focus:border-[#C41E3A]" />
            <button onClick={loadYt} className="text-[9px] px-3 py-1 bg-[#C41E3A] text-white rounded hover:brightness-110 cursor-pointer">Load</button>
          </div>
          {ytVideoId && (
            <div className="aspect-video w-full max-w-lg rounded overflow-hidden bg-black mb-2">
              <iframe src={`https://www.youtube.com/embed/${ytVideoId}?modestbranding=1&rel=0`}
                className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="YouTube" />
            </div>
          )}
          <div className="flex gap-1 flex-wrap">
            {["Am Blues Backing Track", "Rock Jam Track", "Metal Backing Track", "Funk Guitar Jam"].map((q) => (
              <button key={q} onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, "_blank")}
                className="text-[8px] px-2 py-0.5 rounded border border-[#222] text-[#555] hover:text-[#888] hover:border-[#333] transition-colors cursor-pointer">{q}</button>
            ))}
          </div>
        </div>
      )}

      {showPanel === "suno" && (
        <div className="border-b border-[#222] p-3" style={{ background: "#111" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-label text-[10px] text-[#8b5cf6]">AI Backing Track (Suno)</span>
            <button onClick={() => setShowPanel("none")} className="text-[#555] hover:text-[#888] text-xs cursor-pointer ml-auto">X</button>
          </div>
          <div className="flex gap-2 mb-2 flex-wrap">
            <label className="text-[8px] text-[#555]">Key
              <input value={sunoScale} onChange={(e) => setSunoScale(e.target.value)}
                className="block w-16 bg-[#1a1a1a] border border-[#333] rounded px-1 py-0.5 text-xs text-[#ccc] outline-none mt-0.5" />
            </label>
            <label className="text-[8px] text-[#555]">Mode
              <input value={sunoMode} onChange={(e) => setSunoMode(e.target.value)}
                className="block w-20 bg-[#1a1a1a] border border-[#333] rounded px-1 py-0.5 text-xs text-[#ccc] outline-none mt-0.5" />
            </label>
            <label className="text-[8px] text-[#555]">Style
              <input value={sunoStyle} onChange={(e) => setSunoStyle(e.target.value)}
                className="block w-24 bg-[#1a1a1a] border border-[#333] rounded px-1 py-0.5 text-xs text-[#ccc] outline-none mt-0.5" />
            </label>
            <label className="text-[8px] text-[#555]">BPM
              <input type="number" value={sunoBpm} onChange={(e) => setSunoBpm(Number(e.target.value))}
                className="block w-14 bg-[#1a1a1a] border border-[#D4A843] rounded px-1 py-0.5 text-xs text-[#D4A843] outline-none mt-0.5" />
            </label>
            <div className="flex items-end gap-2">
              <button onClick={generateSuno} disabled={sunoLoading}
                className="text-[9px] px-3 py-1 bg-[#8b5cf6] text-white rounded hover:brightness-110 disabled:opacity-50 cursor-pointer">
                {sunoLoading ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
          {sunoError && <div className="text-[10px] text-[#C41E3A]">{sunoError}</div>}
        </div>
      )}

      {/* ── Main 3-panel layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar: Track List ── */}
        <div className="flex-shrink-0 border-r border-[#222] flex flex-col overflow-hidden" style={{ width: sidebarWidth, background: "#141414" }}>
          {/* Sidebar header */}
          <div className="flex items-center h-7 px-2 border-b border-[#222] flex-shrink-0" style={{ background: "#1a1a1a" }}>
            <span className="font-label text-[8px] text-[#666] uppercase tracking-wider">Tracks</span>
          </div>

          {/* Track entries */}
          <div className="flex-1 overflow-y-auto">
            {tracks.map((tr, idx) => {
              const isSelected = selectedTrackId === tr.id;
              const level = vuLevels[tr.id] ?? 0;
              return (
                <div key={tr.id}
                  className={`relative border-b border-[#1a1a1a] cursor-pointer transition-colors ${isSelected ? "bg-[#1a1a0a]" : "hover:bg-[#181818]"}`}
                  onClick={() => setSelectedTrackId(tr.id)}
                  style={{ borderLeft: `3px solid ${isSelected ? "#D4A843" : tr.color}`, boxShadow: isSelected ? `inset 3px 0 8px -3px ${tr.color}66` : "none" }}>
                  <div className="flex items-center gap-1.5 px-2 py-2">
                    {/* Track number */}
                    <span className="font-mono text-[9px] text-[#444] w-5 text-center">{String(idx + 1).padStart(2, "0")}</span>

                    {/* Editable name */}
                    {editingTrackName === tr.id ? (
                      <input
                        autoFocus
                        defaultValue={tr.name}
                        onBlur={(e) => { renameTrack(tr.id, e.target.value || tr.name); setEditingTrackName(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { renameTrack(tr.id, (e.target as HTMLInputElement).value || tr.name); setEditingTrackName(null); } }}
                        className="flex-1 bg-[#0a0a0a] border border-[#D4A843] rounded px-1 py-0 text-[10px] text-[#ccc] outline-none min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex-1 text-[10px] text-[#aaa] truncate min-w-0"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingTrackName(tr.id); }}>
                        {tr.name}
                      </span>
                    )}

                    {/* Track menu */}
                    <button onClick={(e) => { e.stopPropagation(); setTrackMenuId(trackMenuId === tr.id ? null : tr.id); }}
                      className="text-[#444] hover:text-[#888] text-xs px-0.5 cursor-pointer">...</button>
                  </div>

                  {/* M / S / FX buttons row */}
                  <div className="flex items-center gap-1 px-2 pb-1.5">
                    <button onClick={(e) => { e.stopPropagation(); toggleMute(tr.id); }}
                      className={`text-[8px] font-bold w-5 h-4 rounded-sm cursor-pointer border flex items-center justify-center transition-colors ${!tr.muted ? "border-[#33CC33] text-[#33CC33] bg-[#33CC3311]" : "border-[#333] text-[#555]"}`}>
                      M
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleSolo(tr.id); }}
                      className={`text-[8px] font-bold w-5 h-4 rounded-sm cursor-pointer border flex items-center justify-center transition-colors ${tr.solo ? "border-[#D4A843] text-[#D4A843] bg-[#D4A84311]" : "border-[#333] text-[#555]"}`}>
                      S
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setFxTrackId(fxTrackId === tr.id ? null : tr.id); setSelectedTrackId(tr.id); setBottomTab("fx"); }}
                      className={`text-[8px] font-bold px-1 h-4 rounded-sm cursor-pointer border flex items-center justify-center transition-colors ${fxTrackId === tr.id ? "border-[#8b5cf6] text-[#8b5cf6] bg-[#8b5cf611]" : "border-[#333] text-[#555]"}`}>
                      + Fx
                    </button>

                    <div className="flex-1" />

                    {/* Mini VU meter */}
                    <div className="w-10 h-2.5 bg-[#0a0a0a] rounded-sm overflow-hidden border border-[#1a1a1a] flex">
                      <div className="h-full transition-all duration-75" style={{
                        width: `${Math.min(100, level * 100)}%`,
                        background: level > 0.85 ? "linear-gradient(90deg, #33CC33, #D4A843, #C41E3A)"
                          : level > 0.6 ? "linear-gradient(90deg, #33CC33, #D4A843)"
                          : "#33CC33",
                      }} />
                    </div>
                  </div>

                  {/* Volume slider */}
                  <div className="flex items-center gap-1 px-2 pb-1.5">
                    <input type="range" min={0} max={100} value={tr.volume}
                      onChange={(e) => { e.stopPropagation(); updateTrackVol(tr.id, Number(e.target.value)); }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 accent-[#D4A843] h-1" />
                    <span className="font-mono text-[8px] text-[#555] w-5 text-right">{tr.volume}</span>
                  </div>

                  {/* Context menu */}
                  {trackMenuId === tr.id && (
                    <div className="absolute top-8 right-2 z-50 bg-[#1a1a1a] border border-[#333] rounded shadow-lg py-1 min-w-[120px]"
                      onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setEditingTrackName(tr.id); setTrackMenuId(null); }}
                        className="w-full text-left text-[10px] text-[#aaa] hover:bg-[#222] px-3 py-1 cursor-pointer">Rename</button>
                      <button onClick={() => { updateTrackPan(tr.id, 0); setTrackMenuId(null); }}
                        className="w-full text-left text-[10px] text-[#aaa] hover:bg-[#222] px-3 py-1 cursor-pointer">Reset Pan</button>
                      <div className="border-t border-[#222] my-0.5" />
                      <button onClick={() => { deleteTrack(tr.id); setTrackMenuId(null); }}
                        className="w-full text-left text-[10px] text-[#C41E3A] hover:bg-[#220a0a] px-3 py-1 cursor-pointer">Delete Track</button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Master track section */}
            <div className="border-t border-[#333] mt-auto">
              <div className="flex items-center gap-1.5 px-2 py-2" style={{ background: "#181818" }}>
                <span className="font-label text-[8px] text-[#D4A843] uppercase tracking-wider">Master</span>
                <div className="flex-1" />
                {/* Master VU */}
                <div className="w-12 h-3 bg-[#0a0a0a] rounded-sm overflow-hidden border border-[#1a1a1a] flex">
                  <div className="h-full transition-all duration-75" style={{
                    width: `${playing || isRec ? Math.min(100, (masterVol / 100) * 60 + Math.random() * 30) : 0}%`,
                    background: "linear-gradient(90deg, #33CC33, #D4A843, #C41E3A)",
                  }} />
                </div>
              </div>
              <div className="flex items-center gap-1 px-2 pb-2" style={{ background: "#181818" }}>
                <input type="range" min={0} max={100} value={masterVol}
                  onChange={(e) => setMasterVol(Number(e.target.value))}
                  className="flex-1 accent-[#D4A843] h-1" />
                <span className="font-mono text-[9px] text-[#D4A843] w-6 text-right">{masterVol}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar Resize Handle ── */}
        <div
          className="w-1 cursor-col-resize hover:bg-[#D4A84344] active:bg-[#D4A84366] transition-colors flex-shrink-0"
          onMouseDown={() => { sidebarDragRef.current = true; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }}
        />

        {/* ── Center: Timeline ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Measure ruler */}
          <div className="h-6 border-b border-[#222] flex-shrink-0 overflow-hidden relative" style={{ background: "#1a1a1a" }}>
            <div className="absolute top-0 left-0 h-full flex" style={{ transform: `translateX(0px)` }}>
              {measures.map((m) => (
                <div key={m.measure} className="relative h-full" style={{ width: `${pxPerSec * (60 / bpm) * 4}px` }}>
                  <span className="absolute top-0.5 left-1 font-mono text-[9px] text-[#666]">{m.measure}</span>
                  {m.beats.map((_, bi) => (
                    <div key={bi} className="absolute top-0 h-full" style={{ left: `${(bi / 4) * 100}%` }}>
                      <div className={`absolute bottom-0 w-px ${bi === 0 ? "h-3 bg-[#555]" : "h-1.5 bg-[#333]"}`} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {/* Playhead on ruler */}
            {duration > 0 && (
              <div className="absolute top-0 h-full w-px bg-[#D4A843] z-10" style={{ left: `${currentTime * pxPerSec}px` }} />
            )}
          </div>

          {/* Track waveforms area */}
          <div className="flex-1 overflow-auto relative" style={{ background: "#0d0d0d" }}>
            {/* Recording waveform */}
            {isRec && (
              <div className="border-b border-[#1a1a1a]" style={{ borderLeft: "3px solid #C41E3A" }}>
                <div className="flex items-center gap-2 px-2 py-1">
                  <div className="w-2 h-2 rounded-full bg-[#C41E3A] animate-pulse" />
                  <span className="text-[9px] text-[#C41E3A]">Recording...</span>
                  <span className="font-mono text-[9px] text-[#C41E3A]">{fmtTime(recTime)}</span>
                </div>
                <div ref={recContainerRef} className="bg-[#080808] min-h-[64px]" />
              </div>
            )}

            {tracks.length === 0 && !isRec && (
              <div className="flex items-center justify-center h-full">
                <div className="border-2 border-dashed border-[#222] rounded-lg px-12 py-8 text-center">
                  <div className="text-[#333] text-sm mb-1">Drop audio files here</div>
                  <div className="text-[#222] text-[10px]">or use Record / Import to add tracks</div>
                </div>
              </div>
            )}

            {tracks.map((tr) => {
              const isSelected = selectedTrackId === tr.id;
              return (
                <div key={tr.id}
                  className={`border-b transition-colors ${isSelected ? "border-[#D4A84333]" : "border-[#1a1a1a]"}`}
                  style={{
                    borderLeft: `3px solid ${isSelected ? "#D4A843" : tr.color}`,
                    opacity: tr.muted && !tr.solo ? 0.4 : 1,
                  }}
                  onClick={() => setSelectedTrackId(tr.id)}>
                  <div
                    ref={(el) => { if (el) trackContainersRef.current[tr.id] = el; }}
                    className="bg-[#080808] min-h-[64px] cursor-pointer"
                  />
                </div>
              );
            })}

            {/* Vertical playhead across all waveforms */}
            {duration > 0 && (
              <div className="absolute top-0 bottom-0 w-px bg-[#D4A843] z-10 pointer-events-none" style={{ left: `${currentTime * pxPerSec}px` }} />
            )}
          </div>

          {/* ── Bottom Panel (contextual: FX / Editor) ── */}
          {bottomTab !== "none" && fxTrack && (
            <>
              {/* Bottom panel resize handle */}
              <div
                className="h-1 cursor-row-resize hover:bg-[#D4A84344] active:bg-[#D4A84366] transition-colors flex-shrink-0 border-t border-[#222]"
                onMouseDown={() => { bottomDragRef.current = true; document.body.style.cursor = "row-resize"; document.body.style.userSelect = "none"; }}
              />

              {/* Bottom tabs */}
              <div className="flex items-center h-7 px-2 gap-1 border-b border-[#222] flex-shrink-0" style={{ background: "#141414" }}>
                <button onClick={() => setBottomTab("fx")}
                  className={`text-[9px] px-2 py-0.5 rounded cursor-pointer transition-colors ${bottomTab === "fx" ? "bg-[#8b5cf622] text-[#8b5cf6] border border-[#8b5cf644]" : "text-[#555] hover:text-[#888]"}`}>
                  Fx
                </button>
                <button onClick={() => setBottomTab("editor")}
                  className={`text-[9px] px-2 py-0.5 rounded cursor-pointer transition-colors ${bottomTab === "editor" ? "bg-[#D4A84322] text-[#D4A843] border border-[#D4A84344]" : "text-[#555] hover:text-[#888]"}`}>
                  Editor
                </button>
                <div className="flex-1" />
                <span className="text-[9px] text-[#555]">{fxTrack.name}</span>
                <div className="w-2 h-2 rounded-full ml-1" style={{ background: fxTrack.color }} />
                <button onClick={() => setBottomTab("none")}
                  className="text-[#444] hover:text-[#888] text-xs ml-2 cursor-pointer">X</button>
              </div>

              {/* Bottom panel content */}
              <div className="overflow-y-auto flex-shrink-0" style={{ height: bottomPanelHeight, background: "#111" }}>
                {bottomTab === "fx" && (
                  <div className="p-3">
                    {/* Presets */}
                    <div className="flex gap-1.5 mb-3 flex-wrap items-center">
                      <span className="font-label text-[8px] text-[#555] uppercase">Presets:</span>
                      {AMP_PRESETS.map((p) => (
                        <button key={p.name} onClick={() => applyPreset(fxTrack.id, p)}
                          className="text-[9px] px-2 py-0.5 rounded border border-[#333] text-[#888] hover:text-[#ccc] hover:border-[#555] transition-colors cursor-pointer">{p.label}</button>
                      ))}
                      <button onClick={() => updateTrackEffects(fxTrack.id, JSON.parse(JSON.stringify(DEFAULT_EFFECTS)))}
                        className="text-[9px] px-2 py-0.5 rounded border border-[#33171a] text-[#C41E3A] hover:border-[#C41E3A] transition-colors cursor-pointer">Reset</button>
                    </div>

                    {/* Effects grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      <EffectSection title="EQ3" enabled={fxTrack.effects.eq.enabled}
                        onToggle={() => { const fx = { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, enabled: !fxTrack.effects.eq.enabled } }; updateTrackEffects(fxTrack.id, fx); }}>
                        <FxKnob label="Low" value={fxTrack.effects.eq.low} min={-12} max={12} step={0.5}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, low: v } })} />
                        <FxKnob label="Mid" value={fxTrack.effects.eq.mid} min={-12} max={12} step={0.5}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, mid: v } })} />
                        <FxKnob label="High" value={fxTrack.effects.eq.high} min={-12} max={12} step={0.5}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, eq: { ...fxTrack.effects.eq, high: v } })} />
                      </EffectSection>

                      <EffectSection title="Distortion" enabled={fxTrack.effects.distortion.enabled}
                        onToggle={() => { const fx = { ...fxTrack.effects, distortion: { ...fxTrack.effects.distortion, enabled: !fxTrack.effects.distortion.enabled } }; updateTrackEffects(fxTrack.id, fx); }}>
                        <FxKnob label="Wet" value={fxTrack.effects.distortion.wet} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, distortion: { ...fxTrack.effects.distortion, wet: v } })} />
                        <FxKnob label="Amount" value={fxTrack.effects.distortion.amount} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, distortion: { ...fxTrack.effects.distortion, amount: v } })} />
                      </EffectSection>

                      <EffectSection title="Chorus" enabled={fxTrack.effects.chorus.enabled}
                        onToggle={() => { const fx = { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, enabled: !fxTrack.effects.chorus.enabled } }; updateTrackEffects(fxTrack.id, fx); }}>
                        <FxKnob label="Wet" value={fxTrack.effects.chorus.wet} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, wet: v } })} />
                        <FxKnob label="Freq" value={fxTrack.effects.chorus.frequency} min={0.1} max={10} step={0.1}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, frequency: v } })} />
                        <FxKnob label="Depth" value={fxTrack.effects.chorus.depth} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, chorus: { ...fxTrack.effects.chorus, depth: v } })} />
                      </EffectSection>

                      <EffectSection title="Delay" enabled={fxTrack.effects.delay.enabled}
                        onToggle={() => { const fx = { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, enabled: !fxTrack.effects.delay.enabled } }; updateTrackEffects(fxTrack.id, fx); }}>
                        <FxKnob label="Wet" value={fxTrack.effects.delay.wet} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, wet: v } })} />
                        <FxKnob label="Time" value={fxTrack.effects.delay.time} min={0.01} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, time: v } })} />
                        <FxKnob label="Feedback" value={fxTrack.effects.delay.feedback} min={0} max={0.9} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, delay: { ...fxTrack.effects.delay, feedback: v } })} />
                      </EffectSection>

                      <EffectSection title="Reverb" enabled={fxTrack.effects.reverb.enabled}
                        onToggle={() => { const fx = { ...fxTrack.effects, reverb: { ...fxTrack.effects.reverb, enabled: !fxTrack.effects.reverb.enabled } }; updateTrackEffects(fxTrack.id, fx); }}>
                        <FxKnob label="Wet" value={fxTrack.effects.reverb.wet} min={0} max={1} step={0.01}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, reverb: { ...fxTrack.effects.reverb, wet: v } })} />
                        <FxKnob label="Decay" value={fxTrack.effects.reverb.decay} min={0.1} max={10} step={0.1}
                          onChange={(v) => updateTrackEffects(fxTrack.id, { ...fxTrack.effects, reverb: { ...fxTrack.effects.reverb, decay: v } })} />
                      </EffectSection>
                    </div>
                  </div>
                )}

                {bottomTab === "editor" && (
                  <div className="p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] text-[#888]">Pan</span>
                      <input type="range" min={-100} max={100} value={fxTrack.pan}
                        onChange={(e) => updateTrackPan(fxTrack.id, Number(e.target.value))}
                        className="flex-1 max-w-[200px] accent-[#D4A843] h-1" />
                      <span className="font-mono text-[9px] text-[#555] w-8">
                        {fxTrack.pan === 0 ? "C" : fxTrack.pan < 0 ? `L${Math.abs(fxTrack.pan)}` : `R${fxTrack.pan}`}
                      </span>
                    </div>
                    <div className="text-[9px] text-[#444]">Track type: {fxTrack.type}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
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
    <div className={`bg-[#0a0a0a] border border-[#1a1a1a] rounded p-2.5 ${!enabled ? "opacity-40" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={onToggle}
          className={`w-4 h-4 rounded cursor-pointer border text-[8px] flex items-center justify-center transition-colors ${enabled ? "border-[#D4A843] bg-[#D4A843] text-[#0A0A0A]" : "border-[#333] text-[#333] hover:border-[#555]"}`}>
          {enabled ? "ON" : ""}
        </button>
        <span className="font-label text-[10px] text-[#aaa]">{title}</span>
      </div>
      <div className="flex gap-3 flex-wrap">
        {children}
      </div>
    </div>
  );
}

function FxKnob({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const knobRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (dragRef.current.startY - e.clientY) * ((max - min) / 150);
      const raw = dragRef.current.startVal + delta;
      const stepped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, stepped)));
    };
    const onUp = () => { dragRef.current = null; document.body.style.cursor = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [min, max, step, onChange]);

  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270;

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[48px]">
      <span className="font-label text-[7px] text-[#555]">{label}</span>
      <div ref={knobRef}
        className="w-8 h-8 rounded-full border-2 border-[#333] bg-[#1a1a1a] cursor-grab active:cursor-grabbing relative hover:border-[#555] transition-colors"
        onMouseDown={(e) => { dragRef.current = { startY: e.clientY, startVal: value }; document.body.style.cursor = "grabbing"; }}>
        {/* Knob indicator */}
        <div className="absolute inset-1 rounded-full" style={{
          background: `conic-gradient(from ${angle - 5}deg, #D4A843 0deg, #D4A843 10deg, transparent 10deg)`,
        }}>
          <div className="absolute top-0 left-1/2 w-0.5 h-2 bg-[#D4A843] rounded-full -translate-x-1/2"
            style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: "50% 300%" }} />
        </div>
      </div>
      <span className="font-mono text-[8px] text-[#666]">{value.toFixed(step < 1 ? 2 : 0)}</span>
    </div>
  );
}
