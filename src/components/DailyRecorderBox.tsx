"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { saveToLibrary, getExerciseRecordings, deleteLibraryRecording } from "@/lib/recordingsLibrary";
import type { LibraryRecording } from "@/lib/recordingsLibrary";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import DarkAudioPlayer from "./DarkAudioPlayer";

export type DailyRecState = "idle" | "recording" | "paused" | "stopped";
export type PauseReason = "user" | "exercise" | null;

interface DailyRecorderBoxProps {
  storageKey: string;
  /** Called when daily recording starts */
  onStateChange?: (state: DailyRecState) => void;
  /** Register control methods for parent */
  controlRef?: React.MutableRefObject<DailyRecorderControl | null>;
}

export interface DailyRecorderControl {
  pause: (reason: PauseReason) => void;
  resume: () => void;
  getState: () => DailyRecState;
}

export default function DailyRecorderBox({ storageKey: _storageKey, onStateChange, controlRef }: DailyRecorderBoxProps) {
  void _storageKey; // currently unused — saved sessions live in the shared library
  const recorder = useMediaRecorder({ mode: "mic-only" });

  const [pauseReason, setPauseReason] = useState<PauseReason>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordedSec, setRecordedSec] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pastRecordings, setPastRecordings] = useState<LibraryRecording[]>([]);
  const [pastLoaded, setPastLoaded] = useState(false);
  const [playingPastId, setPlayingPastId] = useState<string | null>(null);
  const pastAudioRef = useRef<HTMLAudioElement | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Map recorder.status + audioBlob → DailyRecState
  const state: DailyRecState =
    audioBlob ? "stopped" :
    recorder.status === "recording" ? "recording" :
    recorder.status === "paused" ? "paused" :
    recorder.status === "stopping" ? "stopped" :
    "idle";

  const stateRef = useRef<DailyRecState>(state);
  useEffect(() => {
    stateRef.current = state;
    onStateChange?.(state);
  }, [state, onStateChange]);

  const startRecording = useCallback(() => {
    setAudioUrl(null);
    setAudioBlob(null);
    setSaved(false);
    setRecordedSec(0);
    setPauseReason(null);
    void recorder.start();
  }, [recorder]);

  const pauseRecording = useCallback((reason: PauseReason = "user") => {
    if (recorder.status === "recording") {
      recorder.pause();
      setPauseReason(reason);
    }
  }, [recorder]);

  const resumeRecording = useCallback(() => {
    if (recorder.status === "paused") {
      recorder.resume();
      setPauseReason(null);
    }
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    if (recorder.status !== "recording" && recorder.status !== "paused") return;
    const finalSec = recorder.duration;
    const result = await recorder.stop();
    setPauseReason(null);
    if (result && result.mode === "mic-only") {
      const url = URL.createObjectURL(result.blob);
      setAudioUrl(url);
      setAudioBlob(result.blob);
      setRecordedSec(Math.floor(result.duration || finalSec));
    }
  }, [recorder]);

  // Register control methods for parent
  useEffect(() => {
    if (controlRef) {
      controlRef.current = {
        pause: pauseRecording,
        resume: resumeRecording,
        getState: () => stateRef.current,
      };
    }
    return () => {
      if (controlRef) controlRef.current = null;
    };
  }, [controlRef, pauseRecording, resumeRecording]);

  // Cleanup pastAudio on unmount (recorder cleanup handled by hook)
  useEffect(() => {
    return () => {
      if (pastAudioRef.current) {
        pastAudioRef.current.pause();
        pastAudioRef.current.src = '';
      }
    };
  }, []);

  const handleSaveToLibrary = async () => {
    if (!audioBlob) return;
    setSaving(true);
    try {
      const now = new Date();
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
      const name = `Full Session - ${days[now.getDay()]} ${dateStr}`;
      await saveToLibrary("daily-session", name, audioBlob);
      setSaved(true);
    } catch {
      // recorder error handles UI; keep silent here
    }
    setSaving(false);
  };

  const handleDelete = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordedSec(0);
    setSaved(false);
    recorder.reset();
  };

  const handleNewRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordedSec(0);
    setSaved(false);
    recorder.reset();
  };

  // Load past daily session recordings from library
  const loadPastRecordings = useCallback(() => {
    getExerciseRecordings("daily-session").then(recs => {
      setPastRecordings(recs.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));
      setPastLoaded(true);
    }).catch(() => setPastLoaded(true));
  }, []);

  useEffect(() => {
    loadPastRecordings();
  }, [loadPastRecordings]);

  // Reload list after saving a new recording
  useEffect(() => {
    if (saved) loadPastRecordings();
  }, [saved, loadPastRecordings]);

  const handleDeletePast = async (id: string) => {
    try { await deleteLibraryRecording(id); } catch {}
    setPastRecordings(p => p.filter(r => r.id !== id));
    if (playingPastId === id) { pastAudioRef.current?.pause(); setPlayingPastId(null); }
    setConfirmDeleteId(null);
  };

  const playPastRecording = (rec: LibraryRecording) => {
    if (playingPastId === rec.id) {
      pastAudioRef.current?.pause();
      setPlayingPastId(null);
      return;
    }
    pastAudioRef.current?.pause();
    const url = URL.createObjectURL(rec.blob);
    const audio = new Audio(url);
    audio.onended = () => { setPlayingPastId(null); URL.revokeObjectURL(url); };
    audio.play();
    pastAudioRef.current = audio;
    setPlayingPastId(rec.id);
  };

  const liveSec = state === "stopped" ? recordedSec : recorder.duration;
  const totalSec = Math.floor(liveSec);
  const fmt = Math.floor(totalSec / 60) + ":" + String(totalSec % 60).padStart(2, "0");
  const micError = recorder.error;

  return (
    <div>
      <div className="font-label text-[10px] text-[#C41E3A] mb-3 flex items-center gap-2">
        <div className={`led ${state === "recording" ? "led-red" : state === "paused" ? "led-amber" : "led-off"}`} />
        Daily Session Recorder
        {state === "paused" && pauseReason === "exercise" && (
          <span className="text-[9px] text-[#D4A843] bg-[#D4A843]/10 border border-[#D4A843]/20 rounded px-1.5 py-0.5">
            Paused - Exercise Recording Active
          </span>
        )}
      </div>

      {micError && <div className="font-label text-[10px] text-[#C41E3A] mb-2">{micError}</div>}

      {/* Controls */}
      <div className="flex gap-2 items-center mb-3">
        {state === "idle" && (
          <>
            <button type="button" title="Start recording session" onClick={startRecording}
              className="w-10 h-10 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95"
              style={{ background: "radial-gradient(circle at 40% 40%, #C41E3A, #7f1d1d 80%)", border: "2px solid #555", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }} />
            <span className="font-label text-[10px] text-[#888]">Press to record full session</span>
          </>
        )}

        {state === "recording" && (
          <>
            {/* Pause button */}
            <button type="button" title="Pause recording" onClick={() => pauseRecording("user")}
              className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              style={{ background: "radial-gradient(circle at 40% 40%, #D4A843, #8b6914 80%)", border: "2px solid #555", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </button>
            {/* Stop button */}
            <button type="button" title="Stop recording" onClick={stopRecording}
              className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              style={{ background: "radial-gradient(circle at 40% 40%, #444, #222 80%)", border: "2px solid #555" }}>
              <div className="w-3.5 h-3.5 bg-[#888] rounded-sm" />
            </button>
            <span className="font-readout text-lg text-[#C41E3A] tabular-nums">{fmt}</span>
            <div className="w-2 h-2 rounded-full bg-[#C41E3A] animate-pulse" />
          </>
        )}

        {state === "paused" && (
          <>
            {/* Resume button */}
            <button type="button" title="Resume recording" onClick={resumeRecording}
              className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              style={{ background: "radial-gradient(circle at 40% 40%, #C41E3A, #7f1d1d 80%)", border: "2px solid #555", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </button>
            {/* Stop button */}
            <button type="button" title="Stop recording" onClick={stopRecording}
              className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              style={{ background: "radial-gradient(circle at 40% 40%, #444, #222 80%)", border: "2px solid #555" }}>
              <div className="w-3.5 h-3.5 bg-[#888] rounded-sm" />
            </button>
            <span className="font-readout text-lg text-[#D4A843] tabular-nums">{fmt}</span>
            <span className="font-label text-[10px] text-[#D4A843]">PAUSED</span>
          </>
        )}

        {state === "stopped" && !audioUrl && (
          <span className="font-label text-[10px] text-[#888]">Processing...</span>
        )}
      </div>

      {/* After recording: playback + save/delete */}
      {state === "stopped" && audioUrl && (
        <div>
          <DarkAudioPlayer src={audioUrl} title="Daily Session Recording" compact className="mb-3" knownDuration={recordedSec} />
          <div className="flex gap-2 items-center">
            {!saved ? (
              <>
                <button type="button" onClick={handleSaveToLibrary} disabled={saving}
                  className="font-label text-[11px] px-3 py-1.5 rounded-lg border transition-all border-[#33CC33]/40 text-[#33CC33] hover:bg-[#33CC33]/10 disabled:opacity-50 cursor-pointer">
                  {saving ? "Saving..." : "Save to Library"}
                </button>
                <button type="button" onClick={handleDelete}
                  className="font-label text-[11px] px-3 py-1.5 rounded-lg border transition-all border-[#C41E3A]/40 text-[#C41E3A] hover:bg-[#C41E3A]/10 cursor-pointer">
                  Delete
                </button>
              </>
            ) : (
              <span className="font-label text-[11px] text-[#33CC33] flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                Saved to Library
              </span>
            )}
            <button type="button" onClick={handleNewRecording}
              className="font-label text-[11px] px-3 py-1.5 rounded-lg border transition-all border-[#555] text-[#888] hover:text-[#ccc] hover:border-[#888] cursor-pointer ml-auto">
              New Recording
            </button>
          </div>
        </div>
      )}

      {/* Past daily session recordings */}
      {pastLoaded && pastRecordings.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#1a1a1a]">
          <div className="font-label text-[10px] text-[#888] mb-2">
            Saved Sessions ({pastRecordings.length})
          </div>
          <div className="space-y-1">
            {pastRecordings.map(rec => (
              <div key={rec.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#111] transition-colors group">
                {/* Play/pause button */}
                <button type="button" onClick={() => playPastRecording(rec)}
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border transition-all cursor-pointer"
                  style={{ borderColor: playingPastId === rec.id ? "#D4A843" : "#333", background: playingPastId === rec.id ? "#D4A843" + "20" : "transparent" }}>
                  {playingPastId === rec.id ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#D4A843"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#D4A843"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  )}
                </button>
                {/* Name + date */}
                <div className="flex-1 min-w-0">
                  <div className="font-heading text-[11px] !font-medium !normal-case !tracking-normal truncate text-[#ccc]">{rec.exerciseName}</div>
                  <div className="font-readout text-[9px] text-[#888]">
                    {(() => { try { return new Date(rec.savedAt).toLocaleDateString(); } catch { return rec.savedAt; } })()}
                  </div>
                </div>
                {/* Delete button */}
                {confirmDeleteId === rec.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button type="button" onClick={() => handleDeletePast(rec.id)}
                      className="font-label text-[9px] px-1.5 py-0.5 rounded border border-[#C41E3A]/40 text-[#C41E3A] hover:bg-[#C41E3A]/10 cursor-pointer transition-all">
                      Yes
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteId(null)}
                      className="font-label text-[9px] px-1.5 py-0.5 rounded border border-[#333] text-[#888] hover:text-[#888] cursor-pointer transition-all">
                      No
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDeleteId(rec.id)}
                    title="Delete recording"
                    className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-all text-[#888] hover:text-[#C41E3A] hover:bg-[#C41E3A]/10 cursor-pointer flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
