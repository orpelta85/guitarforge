"use client";
import { useState, useEffect, useRef } from "react";
import type { SavedRecording } from "@/lib/types";
import { openRecorderDB, idbSaveRecording, idbLoadRecordings } from "@/lib/recorderIdb";
import { saveToLibrary } from "@/lib/recordingsLibrary";
import DarkAudioPlayer from "./DarkAudioPlayer";
import AudioAnalyzer from "./AudioAnalyzer";

interface RecorderBoxProps {
  storageKey: string;
  exerciseName?: string;
  expectedNotes?: string[];
  compact?: boolean;
  onRecordSaved?: () => void;
}

async function migrateFromLocalStorage(key: string): Promise<SavedRecording[] | null> {
  try {
    const raw = localStorage.getItem("rec-" + key);
    if (!raw) return null;
    const oldList: SavedRecording[] = JSON.parse(raw);
    if (!oldList.length) return null;

    const db = await openRecorderDB();
    const metaList: { dt: string; idx: number }[] = [];
    const tx = db.transaction("recordings", "readwrite");
    const store = tx.objectStore("recordings");

    for (let i = 0; i < oldList.length; i++) {
      const item = oldList[i];
      metaList.push({ dt: item.dt, idx: i });
      try {
        const resp = await fetch(item.d);
        const blob = await resp.blob();
        store.put(blob, `blob-${key}-${i}`);
      } catch {
        // If conversion fails, skip this recording
      }
    }
    store.put(JSON.stringify(metaList), `meta-${key}`);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    localStorage.removeItem("rec-" + key);
    return oldList;
  } catch {
    return null;
  }
}

function generateRecordingName(exerciseName: string | undefined, existingList: SavedRecording[]): string {
  const now = new Date();
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const base = exerciseName ? `${exerciseName} - ${dateStr}` : `${days[now.getDay()]} - ${dateStr}`;
  const sameName = existingList.filter(r => r.name?.startsWith(base));
  if (sameName.length === 0) return base;
  return `${base} (${sameName.length})`;
}

export default function RecorderBox({ storageKey, exerciseName, expectedNotes, compact, onRecordSaved }: RecorderBoxProps) {
  const [isRec, setIsRec] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [savedList, setSavedList] = useState<SavedRecording[]>([]);
  const [micError, setMicError] = useState("");
  const [recTime, setRecTime] = useState(0);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [librarySaved, setLibrarySaved] = useState<Set<number>>(new Set());
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobMapRef = useRef<Map<number, Blob>>(new Map());
  const nextIdxRef = useRef(0);
  const savedListRef = useRef<SavedRecording[]>([]);

  function renameRecording(idx: number, newName: string) {
    setSavedList(prev => {
      const next = prev.map((r, i) => i === idx ? { ...r, name: newName } : r);
      savedListRef.current = next;
      idbSaveRecording(storageKey, next, blobMapRef.current).catch(() => {});
      return next;
    });
    setEditingIdx(null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const migrated = await migrateFromLocalStorage(storageKey);
      if (cancelled) return;

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

  async function handleSaveToLibrary(idx: number) {
    const allKeys = Array.from(blobMapRef.current.keys()).sort((a, b) => b - a);
    const blobKey = allKeys[idx];
    const blob = blobKey !== undefined ? blobMapRef.current.get(blobKey) : undefined;
    if (!blob) return;
    const item = savedList[idx];
    const name = item?.name || item?.dt || exerciseName || storageKey;
    try {
      await saveToLibrary(storageKey, name, blob);
      setLibrarySaved(prev => new Set(prev).add(idx));
    } catch { /* ignore */ }
  }

  function startRecording() {
    if (!navigator.mediaDevices) { setMicError("Microphone not available on this device."); return; }
    setMicError("");
    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    }).then((stream) => {
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
                       MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());

        const idx = nextIdxRef.current++;
        const autoName = generateRecordingName(exerciseName, savedListRef.current);
        const newItem: SavedRecording = { dt: new Date().toLocaleString("en-US"), d: url, name: autoName };
        blobMapRef.current.set(idx, blob);

        setSavedList((prev) => {
          const next = [newItem, ...prev].slice(0, 10);
          savedListRef.current = next;
          const allKeys = Array.from(blobMapRef.current.keys()).sort((a, b) => b - a);
          const keptKeys = allKeys.slice(0, next.length);
          const keptBlobs = new Map<number, Blob>();
          for (const k of keptKeys) {
            const b = blobMapRef.current.get(k);
            if (b) keptBlobs.set(k, b);
          }
          idbSaveRecording(storageKey, next, keptBlobs).then(() => onRecordSaved?.()).catch(() => {});
          return next;
        });
      };
      mr.start();
      mediaRef.current = mr;
      setIsRec(true);
      setRecTime(0);
      timerRef.current = setInterval(() => setRecTime((t) => t + 1), 1000);
    }).catch((err) => {
      setMicError(err.name === "NotAllowedError" ? "Microphone access denied. Please allow microphone access in your browser settings."
        : "Microphone error: " + err.message);
    });
  }

  function stopRecording() {
    if (mediaRef.current && isRec) {
      mediaRef.current.stop();
      setIsRec(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const totalSec = Math.floor(recTime);
  const fmt = Math.floor(totalSec / 60) + ":" + String(totalSec % 60).padStart(2, "0");

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {!isRec ? (
          <button type="button" onClick={startRecording} className="w-10 h-10 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 flex-shrink-0"
            style={{ background: "radial-gradient(circle at 40% 40%, #C41E3A, #7f1d1d 80%)", border: "2px solid #555", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }}
            title="Record" />
        ) : (
          <button type="button" onClick={stopRecording} className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center flex-shrink-0"
            style={{ background: "radial-gradient(circle at 40% 40%, #444, #222 80%)", border: "2px solid #555" }}
            title="Stop recording">
            <div className="w-3.5 h-3.5 bg-[#888] rounded-sm" />
          </button>
        )}
        {isRec && <span className="font-readout text-[14px] text-[#C41E3A]">{fmt}</span>}
      </div>
    );
  }

  return (
    <div className={`panel p-4 mb-3 ${isRec ? "!border-[#C41E3A]/40" : ""}`}>
      <div className="font-label text-[10px] text-[#C41E3A] mb-3 flex items-center gap-2">
        <div className={`led ${isRec ? "led-red" : "led-off"}`} />
        Recorder
      </div>

      <div className="flex gap-3 items-center mb-3">
        {!isRec ? (
          <button type="button" title="Record" onClick={startRecording} className="w-10 h-10 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95"
            style={{ background: "radial-gradient(circle at 40% 40%, #C41E3A, #7f1d1d 80%)", border: "2px solid #555", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }} />
        ) : (
          <button type="button" title="Stop recording" onClick={stopRecording} className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center"
            style={{ background: "radial-gradient(circle at 40% 40%, #444, #222 80%)", border: "2px solid #555" }}>
            <div className="w-3.5 h-3.5 bg-[#888] rounded-sm" />
          </button>
        )}
        {isRec && <span className="font-readout text-lg text-[#C41E3A]">{fmt}</span>}
        {!isRec && <span className="font-label text-[10px] text-[#444]">Press to record</span>}
      </div>

      {micError && <div className="font-label text-[10px] text-[#C41E3A] mb-2">{micError}</div>}

      {audioUrl && savedList.length === 0 && (
        <div className="mb-2">
          <DarkAudioPlayer src={audioUrl} title="Recording" compact className="mb-1" />
          <AudioAnalyzer audioUrl={audioUrl} exerciseName={exerciseName} expectedNotes={expectedNotes} />
        </div>
      )}

      {savedList.length > 0 && (
        <div>
          <div className="font-label text-[9px] text-[#444] mb-1">Recordings ({savedList.length})</div>
          {savedList.map((item, idx) => (
            <div key={idx} className="mb-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                {editingIdx === idx ? (
                  <form className="flex items-center gap-1 flex-1" onSubmit={e => { e.preventDefault(); renameRecording(idx, editName); }}>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                      className="input !py-0.5 !px-1.5 !text-[11px] flex-1" />
                    <button type="submit" className="font-label text-[9px] text-[#D4A843] hover:text-[#e5c060] cursor-pointer">Save</button>
                    <button type="button" onClick={() => setEditingIdx(null)} className="font-label text-[9px] text-[#555] hover:text-[#888] cursor-pointer">Cancel</button>
                  </form>
                ) : (
                  <>
                    <span className="font-heading text-[11px] text-[#999] truncate">{item.name || item.dt}</span>
                    <button type="button" onClick={() => { setEditingIdx(idx); setEditName(item.name || item.dt); }}
                      className="flex-shrink-0 text-[#444] hover:text-[#D4A843] transition-colors cursor-pointer" title="Rename">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {librarySaved.has(idx) ? (
                      <span className="flex-shrink-0 text-[#33CC33]" title="Saved to Library">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                      </span>
                    ) : (
                      <button type="button" onClick={() => handleSaveToLibrary(idx)}
                        className="flex-shrink-0 text-[#444] hover:text-[#33CC33] transition-colors cursor-pointer" title="Save to Library">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                        </svg>
                      </button>
                    )}
                    <span className="font-readout text-[9px] text-[#333]">{item.dt}</span>
                  </>
                )}
              </div>
              <DarkAudioPlayer src={item.d} title={item.name || item.dt} compact />
              <AudioAnalyzer audioUrl={item.d} exerciseName={exerciseName} expectedNotes={expectedNotes} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
