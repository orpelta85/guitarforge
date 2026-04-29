"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared media recorder hook used by RecorderBox, SongRecorder, and DailyRecorderBox.
 *
 * Consolidates ~1,800 lines of duplicate logic:
 *  - getUserMedia mic capture with instrument-recording constraints
 *    (mono, 48kHz, processing OFF — echoCancellation/noiseSuppression/autoGainControl
 *    are toggled off via both getUserMedia constraints and applyConstraints because
 *    Chrome may ignore the first call).
 *  - getDisplayMedia tab audio capture (when mode === "mic-plus-tab").
 *  - MediaRecorder lifecycle with `.start(1000)` timeslice (so pause/resume can
 *    flush partial chunks).
 *  - Codec detection: webm/pcm > webm/opus > webm > mp4.
 *  - AnalyserNode level meter via requestAnimationFrame.
 *  - Cleanup on unmount.
 *
 * In `mic-plus-tab` mode the hook records mic and tab as TWO separate blobs so
 * the caller can present a post-record mixer (volume sliders) before saving.
 */

export type RecorderMode = "mic-only" | "mic-plus-tab";

export type RecorderStatus =
  | "idle"
  | "requesting-permission"
  | "ready"
  | "recording"
  | "paused"
  | "stopping"
  | "error";

export interface UseMediaRecorderOptions {
  mode: RecorderMode;
  /** mic deviceId (from useAudioDevices) — when undefined, default mic is used */
  deviceId?: string;
  /** Optional auto-stop when duration reaches this. Default: no limit. */
  maxDurationSec?: number;
  /** Override mime type. When undefined, hook picks best supported. */
  mimeType?: string;
  /** Default false — disables Chrome processing that destroys guitar tone. */
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  /** Default 1 (mono). */
  channelCount?: number;
  /** Default 48000. */
  sampleRate?: number;
}

export interface MicOnlyResult {
  mode: "mic-only";
  blob: Blob;
  duration: number;
}

export interface MicPlusTabResult {
  mode: "mic-plus-tab";
  micBlob: Blob;
  tabBlob: Blob;
  duration: number;
}

export type RecorderResult = MicOnlyResult | MicPlusTabResult;

export interface UseMediaRecorderReturn {
  status: RecorderStatus;
  /** Current elapsed seconds (driven by setInterval @1Hz). */
  duration: number;
  /** Current input peak level 0..1 (RMS-style peak). */
  level: number;
  error: string | null;
  /** True when this recording session was running with tab-audio (set after start). */
  isDual: boolean;
  start: () => Promise<void>;
  /** Resolves with the captured blobs once both recorders have flushed. */
  stop: () => Promise<RecorderResult | null>;
  pause: () => void;
  resume: () => void;
  /** Reset to idle (cleans up streams/analyser). Does NOT touch any saved blobs. */
  reset: () => void;
}

/** Pick the best supported MIME type for MediaRecorder. */
export function pickRecorderMimeType(override?: string): { mimeType: string; isPcm: boolean } {
  if (typeof MediaRecorder === "undefined") return { mimeType: "", isPcm: false };
  if (override && MediaRecorder.isTypeSupported(override)) {
    return { mimeType: override, isPcm: override.includes("pcm") };
  }
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=pcm")) {
    return { mimeType: "audio/webm;codecs=pcm", isPcm: true };
  }
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return { mimeType: "audio/webm;codecs=opus", isPcm: false };
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return { mimeType: "audio/webm", isPcm: false };
  }
  if (MediaRecorder.isTypeSupported("audio/mp4")) {
    return { mimeType: "audio/mp4", isPcm: false };
  }
  return { mimeType: "", isPcm: false };
}

export function useMediaRecorder(options: UseMediaRecorderOptions): UseMediaRecorderReturn {
  const {
    mode,
    deviceId,
    maxDurationSec,
    mimeType: mimeOverride,
    echoCancellation = false,
    noiseSuppression = false,
    autoGainControl = false,
    channelCount = 1,
    sampleRate = 48000,
  } = options;

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDual, setIsDual] = useState(false);

  // Stream / recorder refs
  const micStreamRef = useRef<MediaStream | null>(null);
  const tabStreamRef = useRef<MediaStream | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const tabRecorderRef = useRef<MediaRecorder | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const tabChunksRef = useRef<Blob[]>([]);

  // Timer ref for elapsed seconds
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Analyser refs (level meter)
  const analyserCtxRef = useRef<AudioContext | null>(null);
  const analyserSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelAnimRef = useRef<number>(0);

  // Pending stop promise resolver
  const stopResolverRef = useRef<((result: RecorderResult | null) => void) | null>(null);
  const isDualRef = useRef(false);
  const startedAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const teardownAnalyser = useCallback(() => {
    if (levelAnimRef.current) {
      cancelAnimationFrame(levelAnimRef.current);
      levelAnimRef.current = 0;
    }
    try {
      analyserSourceRef.current?.disconnect();
    } catch {
      // ignore
    }
    analyserRef.current = null;
    analyserSourceRef.current = null;
    if (analyserCtxRef.current && analyserCtxRef.current.state !== "closed") {
      analyserCtxRef.current.close().catch(() => {});
    }
    analyserCtxRef.current = null;
    setLevel(0);
  }, []);

  const teardownStreams = useCallback(() => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    tabStreamRef.current?.getTracks().forEach(t => t.stop());
    tabStreamRef.current = null;
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    teardownAnalyser();
    teardownStreams();
    micRecorderRef.current = null;
    tabRecorderRef.current = null;
    micChunksRef.current = [];
    tabChunksRef.current = [];
    isDualRef.current = false;
    setIsDual(false);
    setDuration(0);
    setStatus("idle");
    setError(null);
    if (stopResolverRef.current) {
      stopResolverRef.current(null);
      stopResolverRef.current = null;
    }
  }, [clearTimer, teardownAnalyser, teardownStreams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      teardownAnalyser();
      teardownStreams();
      micRecorderRef.current = null;
      tabRecorderRef.current = null;
    };
  }, [clearTimer, teardownAnalyser, teardownStreams]);

  const startAnalyser = useCallback((stream: MediaStream, actualRate: number) => {
    if (analyserCtxRef.current && analyserCtxRef.current.state !== "closed") {
      analyserCtxRef.current.close().catch(() => {});
      analyserCtxRef.current = null;
    }
    // Match the stream's actual sample rate to avoid resampling artefacts.
    // Analyser is dead-end (NOT connected to destination) — it only reads,
    // does not route audio.
    const aCtx = new AudioContext({ sampleRate: actualRate, latencyHint: "interactive" });
    const aSource = aCtx.createMediaStreamSource(stream);
    const analyser = aCtx.createAnalyser();
    analyser.fftSize = 2048;
    aSource.connect(analyser);
    analyserCtxRef.current = aCtx;
    analyserSourceRef.current = aSource;
    analyserRef.current = analyser;

    const dataArr = new Float32Array(analyser.fftSize);
    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getFloatTimeDomainData(dataArr);
      let peak = 0;
      for (let i = 0; i < dataArr.length; i++) {
        const abs = Math.abs(dataArr[i]);
        if (abs > peak) peak = abs;
      }
      setLevel(peak);
      levelAnimRef.current = requestAnimationFrame(tick);
    };
    levelAnimRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    if (status === "recording" || status === "paused") return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("Microphone not available on this device.");
      setStatus("error");
      return;
    }

    setError(null);
    setDuration(0);
    setStatus("requesting-permission");
    micChunksRef.current = [];
    tabChunksRef.current = [];
    isDualRef.current = false;
    setIsDual(false);

    try {
      // ── Mic capture ──
      const audioConstraints: MediaTrackConstraints = {
        sampleRate,
        channelCount,
        echoCancellation,
        noiseSuppression,
        autoGainControl,
      };
      if (deviceId) audioConstraints.deviceId = { exact: deviceId };

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      micStreamRef.current = micStream;

      // Belt & suspenders: Chrome may ignore getUserMedia constraints, so
      // re-apply via applyConstraints.
      for (const track of micStream.getAudioTracks()) {
        await track
          .applyConstraints({ autoGainControl, echoCancellation, noiseSuppression })
          .catch(() => {});
      }

      const settings = micStream.getAudioTracks()[0]?.getSettings();
      const actualRate = settings?.sampleRate || sampleRate;

      // Level meter via parallel analyser (does not go to destination)
      startAnalyser(micStream, actualRate);

      // Pick MIME / bitrate
      const { mimeType: chosenMime, isPcm } = pickRecorderMimeType(mimeOverride);
      const mrOpts: MediaRecorderOptions = {
        ...(chosenMime ? { mimeType: chosenMime } : {}),
        ...(isPcm ? {} : { audioBitsPerSecond: 256000 }),
      };

      // ── Optional tab capture (mic-plus-tab) ──
      let effectiveMode: RecorderMode = mode;
      if (mode === "mic-plus-tab" && !navigator.mediaDevices.getDisplayMedia) {
        // Browser doesn't support — silently fall back to mic-only.
        effectiveMode = "mic-only";
      }

      if (effectiveMode === "mic-plus-tab") {
        let tabAudioStream: MediaStream;
        try {
          const tabStream = await navigator.mediaDevices.getDisplayMedia({
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
            } as MediaTrackConstraints,
            video: true,
            // @ts-expect-error -- preferCurrentTab is Chrome-specific
            preferCurrentTab: true,
          });
          tabStreamRef.current = tabStream;
          tabStream.getVideoTracks().forEach(t => t.stop());
          const tabAudioTracks = tabStream.getAudioTracks();
          for (const track of tabAudioTracks) {
            await track
              .applyConstraints({
                autoGainControl: false,
                echoCancellation: false,
                noiseSuppression: false,
              })
              .catch(() => {});
          }
          if (tabAudioTracks.length === 0) {
            tabStream.getTracks().forEach(t => t.stop());
            tabStreamRef.current = null;
            teardownStreams();
            teardownAnalyser();
            setError("No audio track shared. Make sure to check 'Share tab audio'.");
            setStatus("error");
            return;
          }
          tabAudioStream = new MediaStream(tabAudioTracks);
        } catch (e: unknown) {
          teardownStreams();
          teardownAnalyser();
          setError(
            (e as { name?: string }).name === "NotAllowedError"
              ? "Tab sharing cancelled."
              : "Could not capture tab audio."
          );
          setStatus("error");
          return;
        }

        isDualRef.current = true;
        setIsDual(true);

        const micRec = new MediaRecorder(micStream, mrOpts);
        micRec.ondataavailable = (e) => {
          if (e.data.size > 0) micChunksRef.current.push(e.data);
        };
        micRecorderRef.current = micRec;

        const tabRec = new MediaRecorder(tabAudioStream, mrOpts);
        tabRec.ondataavailable = (e) => {
          if (e.data.size > 0) tabChunksRef.current.push(e.data);
        };
        tabRecorderRef.current = tabRec;

        const micStopped = new Promise<void>(res => {
          micRec.onstop = () => res();
        });
        const tabStopped = new Promise<void>(res => {
          tabRec.onstop = () => res();
        });

        Promise.all([micStopped, tabStopped]).then(() => {
          const micBlob = new Blob(micChunksRef.current, {
            type: micRec.mimeType || "audio/webm",
          });
          const tabBlob = new Blob(tabChunksRef.current, {
            type: tabRec.mimeType || "audio/webm",
          });
          const finalDuration = startedAtRef.current
            ? (Date.now() - startedAtRef.current) / 1000
            : 0;
          const result: RecorderResult | null =
            micBlob.size === 0 && tabBlob.size === 0
              ? null
              : { mode: "mic-plus-tab", micBlob, tabBlob, duration: finalDuration };
          if (result === null) {
            setError("No audio data captured. Try recording again.");
          }
          teardownStreams();
          teardownAnalyser();
          clearTimer();
          setStatus("ready");
          if (stopResolverRef.current) {
            stopResolverRef.current(result);
            stopResolverRef.current = null;
          }
        });

        // If user stops tab sharing from the browser bar, flush both.
        tabAudioStream.getAudioTracks()[0].onended = () => {
          if (micRec.state === "recording" || micRec.state === "paused") micRec.stop();
          if (tabRec.state === "recording" || tabRec.state === "paused") tabRec.stop();
          clearTimer();
        };

        startedAtRef.current = Date.now();
        micRec.start(1000);
        tabRec.start(1000);
      } else {
        const mr = new MediaRecorder(micStream, mrOpts);
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) micChunksRef.current.push(e.data);
        };
        mr.onstop = () => {
          const blob = new Blob(micChunksRef.current, { type: mr.mimeType || "audio/webm" });
          const finalDuration = startedAtRef.current
            ? (Date.now() - startedAtRef.current) / 1000
            : 0;
          const result: RecorderResult | null =
            blob.size === 0
              ? null
              : { mode: "mic-only", blob, duration: finalDuration };
          if (result === null) {
            setError("No audio data captured. Try recording again.");
          }
          teardownStreams();
          teardownAnalyser();
          clearTimer();
          setStatus("ready");
          if (stopResolverRef.current) {
            stopResolverRef.current(result);
            stopResolverRef.current = null;
          }
        };
        micRecorderRef.current = mr;
        startedAtRef.current = Date.now();
        mr.start(1000);
      }

      setStatus("recording");
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const next = prev + 1;
          if (maxDurationSec && next >= maxDurationSec) {
            // Trigger auto-stop on next tick (avoid setState-during-render)
            queueMicrotask(() => {
              const m = micRecorderRef.current;
              const t = tabRecorderRef.current;
              if (m && (m.state === "recording" || m.state === "paused")) m.stop();
              if (t && (t.state === "recording" || t.state === "paused")) t.stop();
            });
          }
          return next;
        });
      }, 1000);
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      teardownStreams();
      teardownAnalyser();
      clearTimer();
      setError(
        e.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access in your browser settings."
          : "Microphone error: " + (e.message || "Unknown error")
      );
      setStatus("error");
    }
  }, [
    status,
    mode,
    deviceId,
    maxDurationSec,
    mimeOverride,
    echoCancellation,
    noiseSuppression,
    autoGainControl,
    channelCount,
    sampleRate,
    startAnalyser,
    teardownStreams,
    teardownAnalyser,
    clearTimer,
  ]);

  const stop = useCallback((): Promise<RecorderResult | null> => {
    return new Promise<RecorderResult | null>(resolve => {
      const m = micRecorderRef.current;
      const t = tabRecorderRef.current;
      const recordingActive =
        (m && (m.state === "recording" || m.state === "paused")) ||
        (t && (t.state === "recording" || t.state === "paused"));
      if (!recordingActive) {
        resolve(null);
        return;
      }
      stopResolverRef.current = resolve;
      setStatus("stopping");
      clearTimer();
      if (m && (m.state === "recording" || m.state === "paused")) m.stop();
      if (t && (t.state === "recording" || t.state === "paused")) t.stop();
    });
  }, [clearTimer]);

  const pause = useCallback(() => {
    const m = micRecorderRef.current;
    const t = tabRecorderRef.current;
    if (m?.state === "recording") m.pause();
    if (t?.state === "recording") t.pause();
    if (m?.state === "paused" || t?.state === "paused") {
      clearTimer();
      setStatus("paused");
    }
  }, [clearTimer]);

  const resume = useCallback(() => {
    const m = micRecorderRef.current;
    const t = tabRecorderRef.current;
    if (m?.state === "paused") m.resume();
    if (t?.state === "paused") t.resume();
    if (m?.state === "recording" || t?.state === "recording") {
      setStatus("recording");
      // Restart interval (preserve current duration)
      if (!timerRef.current) {
        timerRef.current = setInterval(() => setDuration(prev => prev + 1), 1000);
      }
    }
  }, []);

  return {
    status,
    duration,
    level,
    error,
    isDual,
    start,
    stop,
    pause,
    resume,
    reset,
  };
}
