"use client";
import { useState, useEffect, useRef } from "react";
import type { SavedRecording } from "@/lib/types";
import { openRecorderDB, idbSaveRecording, idbLoadRecordings } from "@/lib/recorderIdb";
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

export default function RecorderBox({ storageKey, exerciseName, expectedNotes, compact, onRecordSaved }: RecorderBoxProps) {
  const [isRec, setIsRec] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [savedList, setSavedList] = useState<SavedRecording[]>([]);
  const [micError, setMicError] = useState("");
  const [recTime, setRecTime] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobMapRef = useRef<Map<number, Blob>>(new Map());
  const nextIdxRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const migrated = await migrateFromLocalStorage(storageKey);
      if (cancelled) return;

      const { list, blobs } = await idbLoadRecordings(storageKey);
      if (cancelled) return;
      setSavedList(list);
      blobMapRef.current = blobs;
      const existingKeys = Array.from(blobs.keys());
      nextIdxRef.current = existingKeys.length === 0 ? 0 : Math.max(...existingKeys) + 1;
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

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
        const newItem: SavedRecording = { dt: new Date().toLocaleString("en-US"), d: url };
        blobMapRef.current.set(idx, blob);

        setSavedList((prev) => {
          const next = [newItem, ...prev].slice(0, 10);
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

  const fmt = Math.floor(recTime / 60) + ":" + String(recTime % 60).padStart(2, "0");

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

      {audioUrl && (
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
              <DarkAudioPlayer src={item.d} title={item.dt} compact />
              <AudioAnalyzer audioUrl={item.d} exerciseName={exerciseName} expectedNotes={expectedNotes} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
