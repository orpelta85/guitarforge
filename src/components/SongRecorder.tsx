"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { SavedRecording } from "@/lib/types";
import { openRecorderDB, idbSaveRecording, idbLoadRecordings } from "@/lib/recorderIdb";
import DarkAudioPlayer from "./DarkAudioPlayer";

interface SongRecorderProps {
  songName: string;
  songId: number;
  /** Optional: pass an HTMLAudioElement to mix song audio with guitar input */
  songAudioElement?: HTMLAudioElement | null;
  /** Whether the current playback is YouTube (cannot capture audio) */
  isYouTubeSource?: boolean;
}

type RecordingMode = "guitar-only" | "dual";

function generateRecordingName(songName: string, existingList: SavedRecording[]): string {
  const now = new Date();
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  const base = `${songName} - ${dateStr}`;
  const sameName = existingList.filter(r => r.name?.startsWith(base));
  if (sameName.length === 0) return base;
  return `${base} (${sameName.length})`;
}

export default function SongRecorder({ songName, songId, songAudioElement, isYouTubeSource }: SongRecorderProps) {
  const storageKey = `song-rec-${songId}`;

  const [isRec, setIsRec] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [savedList, setSavedList] = useState<SavedRecording[]>([]);
  const [micError, setMicError] = useState("");
  const [mode, setMode] = useState<RecordingMode>("guitar-only");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [expanded, setExpanded] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobMapRef = useRef<Map<number, Blob>>(new Map());
  const nextIdxRef = useRef(0);
  const savedListRef = useRef<SavedRecording[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Can we do dual recording?
  const canDual = !!songAudioElement && !isYouTubeSource;

  // Load saved recordings from IDB
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { list, blobs } = await idbLoadRecordings(storageKey);
      if (cancelled) return;
      setSavedList(list);
      savedListRef.current = list;
      blobMapRef.current = blobs;
      const existingKeys = Array.from(blobs.keys());
      nextIdxRef.current = existingKeys.length === 0 ? 0 : Math.max(...existingKeys) + 1;
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // Timer cleanup
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices) {
      setMicError("Microphone not available on this device.");
      return;
    }
    setMicError("");

    try {
      // Get microphone stream with raw audio (no processing)
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      micStreamRef.current = micStream;

      let recordStream: MediaStream;

      if (mode === "dual" && canDual && songAudioElement) {
        // Dual-channel: mix guitar + song audio into one stream
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const micSource = ctx.createMediaStreamSource(micStream);
        const destination = ctx.createMediaStreamDestination();

        // Guitar input -> gain node (for potential level control) -> destination
        const micGain = ctx.createGain();
        micGain.gain.value = 1.0;
        micSource.connect(micGain);
        micGain.connect(destination);

        // Song audio element -> destination
        // NOTE: createMediaElementSource can only be called ONCE per element.
        // If it was already connected, we need to handle that gracefully.
        try {
          const songSource = ctx.createMediaElementSource(songAudioElement);
          const songGain = ctx.createGain();
          songGain.gain.value = 1.0;
          songSource.connect(songGain);
          songGain.connect(destination);
          // Also connect to speakers so user can still hear the song
          songSource.connect(ctx.destination);
        } catch {
          // If MediaElementSource already exists for this element, fall back to guitar-only
          micSource.connect(destination);
          setMicError("Could not capture song audio - recording guitar only.");
        }

        recordStream = destination.stream;
      } else {
        // Guitar-only: record directly from mic
        recordStream = micStream;
      }

      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" :
                       MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const mr = new MediaRecorder(recordStream, mimeType ? { mimeType } : undefined);

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        const url = URL.createObjectURL(blob);

        // Stop mic tracks
        micStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;

        // Close audio context if dual recording
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close().catch(() => {});
          audioCtxRef.current = null;
        }

        const idx = nextIdxRef.current++;
        const autoName = generateRecordingName(songName, savedListRef.current);
        const modeLabel = mode === "dual" && canDual ? " [Guitar + Song]" : " [Guitar]";
        const newItem: SavedRecording = {
          dt: new Date().toLocaleString("en-US"),
          d: url,
          name: autoName + modeLabel,
        };
        blobMapRef.current.set(idx, blob);

        setSavedList(prev => {
          const next = [newItem, ...prev].slice(0, 10);
          savedListRef.current = next;
          const allKeys = Array.from(blobMapRef.current.keys()).sort((a, b) => b - a);
          const keptKeys = allKeys.slice(0, next.length);
          const keptBlobs = new Map<number, Blob>();
          for (const k of keptKeys) {
            const b = blobMapRef.current.get(k);
            if (b) keptBlobs.set(k, b);
          }
          idbSaveRecording(storageKey, next, keptBlobs).catch(() => {});
          return next;
        });

        setExpanded(true);
      };

      mr.start();
      mediaRecorderRef.current = mr;
      setIsRec(true);
      setRecTime(0);
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);

    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      setMicError(
        error.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access in your browser settings."
          : "Microphone error: " + (error.message || "Unknown error")
      );
    }
  }, [mode, canDual, songAudioElement, songName, storageKey]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRec) {
      mediaRecorderRef.current.stop();
      setIsRec(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isRec]);

  function renameRecording(idx: number, newName: string) {
    setSavedList(prev => {
      const next = prev.map((r, i) => i === idx ? { ...r, name: newName } : r);
      savedListRef.current = next;
      idbSaveRecording(storageKey, next, blobMapRef.current).catch(() => {});
      return next;
    });
    setEditingIdx(null);
  }

  function deleteRecording(idx: number) {
    setSavedList(prev => {
      const next = prev.filter((_, i) => i !== idx);
      savedListRef.current = next;
      // Rebuild blob map
      const allKeys = Array.from(blobMapRef.current.keys()).sort((a, b) => b - a);
      if (allKeys[idx] !== undefined) {
        blobMapRef.current.delete(allKeys[idx]);
      }
      idbSaveRecording(storageKey, next, blobMapRef.current).catch(() => {});
      return next;
    });
  }

  const fmt = Math.floor(recTime / 60) + ":" + String(recTime % 60).padStart(2, "0");

  return (
    <div className={`panel p-4 mb-4 ${isRec ? "!border-[#C41E3A]/40" : ""}`}>
      <div className="font-label text-[10px] text-[#C41E3A] mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`led ${isRec ? "led-red" : "led-off"}`} />
          <span className="tracking-wider">RECORDER</span>
          {isRec && (
            <span className="text-[#C41E3A]/60 text-[9px] ml-1">
              {mode === "dual" && canDual ? "Guitar + Song" : "Guitar Only"}
            </span>
          )}
        </div>
        {savedList.length > 0 && !isRec && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="font-label text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-pointer transition-colors"
          >
            {expanded ? "Hide" : "Show"} Recordings ({savedList.length})
          </button>
        )}
      </div>

      {/* Recording mode selector */}
      {!isRec && (
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode("guitar-only")}
            className={`font-label text-[10px] px-3 py-1.5 rounded cursor-pointer border transition-all ${
              mode === "guitar-only"
                ? "bg-[#C41E3A]/20 text-[#C41E3A] border-[#C41E3A]/40"
                : "border-[var(--border-panel)] text-[var(--text-muted)]"
            }`}
          >
            Guitar Only
          </button>
          <button
            type="button"
            onClick={() => canDual ? setMode("dual") : undefined}
            className={`font-label text-[10px] px-3 py-1.5 rounded border transition-all ${
              !canDual
                ? "border-[var(--border-panel)] text-[var(--text-muted)] opacity-40 cursor-not-allowed"
                : mode === "dual"
                  ? "bg-[#C41E3A]/20 text-[#C41E3A] border-[#C41E3A]/40 cursor-pointer"
                  : "border-[var(--border-panel)] text-[var(--text-muted)] cursor-pointer"
            }`}
            title={!canDual
              ? isYouTubeSource
                ? "Cannot capture YouTube audio (CORS restriction). Switch to a local audio source for dual recording."
                : "No audio source detected for dual recording."
              : "Record guitar input mixed with song playback"
            }
          >
            Guitar + Song
          </button>
        </div>
      )}

      {/* YouTube CORS notice */}
      {isYouTubeSource && !isRec && mode === "guitar-only" && (
        <div className="flex items-center gap-2 bg-amber-500/8 border border-amber-500/20 rounded px-3 py-2 mb-3">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="font-label text-[10px] text-amber-500/80">
            YouTube audio cannot be captured. Only your guitar input will be recorded.
          </span>
        </div>
      )}

      {/* Record / Stop controls */}
      <div className="flex gap-3 items-center mb-3">
        {!isRec ? (
          <button
            type="button"
            title="Record"
            onClick={startRecording}
            className="w-12 h-12 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "radial-gradient(circle at 40% 40%, #C41E3A, #7f1d1d 80%)",
              border: "2px solid #555",
              boxShadow: "0 2px 8px rgba(196,30,58,0.3)",
            }}
          />
        ) : (
          <button
            type="button"
            title="Stop recording"
            onClick={stopRecording}
            className="w-12 h-12 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "radial-gradient(circle at 40% 40%, #444, #222 80%)",
              border: "2px solid #555",
            }}
          >
            <div className="w-4 h-4 bg-[#888] rounded-sm" />
          </button>
        )}
        {isRec && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#C41E3A] animate-pulse" />
            <span className="font-readout text-lg text-[#C41E3A] tabular-nums">{fmt}</span>
          </div>
        )}
        {!isRec && <span className="font-label text-[10px] text-[#444]">Press to record</span>}
      </div>

      {micError && (
        <div className="font-label text-[10px] text-[#C41E3A] mb-2">{micError}</div>
      )}

      {/* Saved recordings list */}
      {savedList.length > 0 && expanded && (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <div className="font-label text-[9px] text-[#444] mb-2">Recordings ({savedList.length})</div>
          {savedList.map((item, idx) => (
            <div key={idx} className="mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                {editingIdx === idx ? (
                  <form
                    className="flex items-center gap-1 flex-1"
                    onSubmit={e => { e.preventDefault(); renameRecording(idx, editName); }}
                  >
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      autoFocus
                      className="input !py-0.5 !px-1.5 !text-[11px] flex-1"
                    />
                    <button type="submit" className="font-label text-[9px] text-[#D4A843] hover:text-[#e5c060] cursor-pointer">Save</button>
                    <button type="button" onClick={() => setEditingIdx(null)} className="font-label text-[9px] text-[#555] hover:text-[#888] cursor-pointer">Cancel</button>
                  </form>
                ) : (
                  <>
                    <span className="font-heading text-[11px] text-[#999] truncate flex-1">{item.name || item.dt}</span>
                    <button
                      type="button"
                      onClick={() => { setEditingIdx(idx); setEditName(item.name || item.dt); }}
                      className="flex-shrink-0 text-[#444] hover:text-[#D4A843] transition-colors cursor-pointer"
                      title="Rename"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRecording(idx)}
                      className="flex-shrink-0 text-[#444] hover:text-[#C41E3A] transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                    <span className="font-readout text-[9px] text-[#333] flex-shrink-0">{item.dt}</span>
                  </>
                )}
              </div>
              <DarkAudioPlayer src={item.d} title={item.name || item.dt} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
