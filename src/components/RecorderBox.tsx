"use client";
import { useState, useEffect, useRef } from "react";
import type { SavedRecording } from "@/lib/types";
import DarkAudioPlayer from "./DarkAudioPlayer";
import AudioAnalyzer from "./AudioAnalyzer";

interface RecorderBoxProps {
  storageKey: string;
  exerciseName?: string;
  expectedNotes?: string[];
}

const IDB_NAME = "gf-recorder";
const IDB_STORE = "recordings";

function openRecorderDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSaveRecording(key: string, list: SavedRecording[], blobs: Map<number, Blob>): Promise<void> {
  const db = await openRecorderDB();
  const metaList = list.map((r, i) => ({ dt: r.dt, idx: i }));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    // Save metadata list
    store.put(JSON.stringify(metaList), `meta-${key}`);
    // Save each blob
    for (const [idx, blob] of blobs.entries()) {
      store.put(blob, `blob-${key}-${idx}`);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbLoadRecordings(key: string): Promise<{ list: SavedRecording[]; blobs: Map<number, Blob> }> {
  const db = await openRecorderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const metaReq = store.get(`meta-${key}`);
    metaReq.onsuccess = () => {
      if (!metaReq.result) {
        resolve({ list: [], blobs: new Map() });
        return;
      }
      const metaList: { dt: string; idx: number }[] = JSON.parse(metaReq.result);
      const blobs = new Map<number, Blob>();
      const list: SavedRecording[] = [];
      let loaded = 0;
      if (metaList.length === 0) { resolve({ list, blobs }); return; }
      for (const meta of metaList) {
        const blobReq = store.get(`blob-${key}-${meta.idx}`);
        blobReq.onsuccess = () => {
          if (blobReq.result instanceof Blob) {
            blobs.set(meta.idx, blobReq.result);
            list.push({ dt: meta.dt, d: URL.createObjectURL(blobReq.result) });
          }
          loaded++;
          if (loaded === metaList.length) resolve({ list, blobs });
        };
        blobReq.onerror = () => { loaded++; if (loaded === metaList.length) resolve({ list, blobs }); };
      }
    };
    metaReq.onerror = () => reject(metaReq.error);
  });
}

async function idbDeleteRecording(key: string, idx: number, totalCount: number): Promise<void> {
  const db = await openRecorderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    store.delete(`blob-${key}-${idx}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function migrateFromLocalStorage(key: string): Promise<SavedRecording[] | null> {
  try {
    const raw = localStorage.getItem("rec-" + key);
    if (!raw) return null;
    const oldList: SavedRecording[] = JSON.parse(raw);
    if (!oldList.length) return null;

    // Migrate: convert base64 data URLs to blobs in IndexedDB
    const db = await openRecorderDB();
    const metaList: { dt: string; idx: number }[] = [];
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);

    for (let i = 0; i < oldList.length; i++) {
      const item = oldList[i];
      metaList.push({ dt: item.dt, idx: i });
      // Convert base64 data URL to blob
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

    // Remove old localStorage data after successful migration
    localStorage.removeItem("rec-" + key);
    return oldList;
  } catch {
    return null;
  }
}

export default function RecorderBox({ storageKey, exerciseName, expectedNotes }: RecorderBoxProps) {
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
      // Try migration from localStorage first
      const migrated = await migrateFromLocalStorage(storageKey);
      if (cancelled) return;

      // Load from IndexedDB
      const { list, blobs } = await idbLoadRecordings(storageKey);
      if (cancelled) return;
      setSavedList(list);
      blobMapRef.current = blobs;
      nextIdxRef.current = Math.max(0, ...Array.from(blobs.keys())) + 1;
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
          // Build a clean index-to-blob mapping for the kept recordings
          const allKeys = Array.from(blobMapRef.current.keys()).sort((a, b) => b - a);
          const keptKeys = allKeys.slice(0, next.length);
          const metaList = next.map((r, i) => ({ dt: r.dt, idx: keptKeys[i] ?? i }));
          const keptBlobs = new Map<number, Blob>();
          for (const k of keptKeys) {
            const b = blobMapRef.current.get(k);
            if (b) keptBlobs.set(k, b);
          }
          idbSaveRecording(storageKey, next, keptBlobs).catch(() => {});
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

  return (
    <div className={`panel p-4 mb-3 ${isRec ? "!border-[#C41E3A]/40" : ""}`}>
      <div className="font-label text-[10px] text-[#C41E3A] mb-3 flex items-center gap-2">
        <div className={`led ${isRec ? "led-red" : "led-off"}`} />
        Recorder
      </div>

      <div className="flex gap-3 items-center mb-3">
        {!isRec ? (
          <button onClick={startRecording} className="w-10 h-10 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95"
            style={{ background: "radial-gradient(circle at 40% 40%, #C41E3A, #7f1d1d 80%)", border: "2px solid #555", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }} />
        ) : (
          <button onClick={stopRecording} className="w-10 h-10 rounded-full cursor-pointer flex items-center justify-center"
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
