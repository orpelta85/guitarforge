"use client";
import { useState, useEffect, useRef } from "react";
import type { SavedRecording } from "@/lib/types";

interface RecorderBoxProps { storageKey: string; }

export default function RecorderBox({ storageKey }: RecorderBoxProps) {
  const [isRec, setIsRec] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [savedList, setSavedList] = useState<SavedRecording[]>([]);
  const [recTime, setRecTime] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("rec-" + storageKey);
      if (raw) setSavedList(JSON.parse(raw));
    } catch { /* ok */ }
  }, [storageKey]);

  function startRecording() {
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    }).then((stream) => {
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        const reader = new FileReader();
        reader.onloadend = () => {
          const newItem: SavedRecording = { dt: new Date().toLocaleString("he-IL"), d: reader.result as string };
          setSavedList((prev) => {
            const next = [newItem, ...prev].slice(0, 10);
            try { localStorage.setItem("rec-" + storageKey, JSON.stringify(next)); } catch { /* ok */ }
            return next;
          });
        };
        reader.readAsDataURL(blob);
      };
      mr.start();
      mediaRef.current = mr;
      setIsRec(true);
      setRecTime(0);
      timerRef.current = setInterval(() => setRecTime((t) => t + 1), 1000);
    }).catch(() => { /* no mic */ });
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

      {audioUrl && (
        /* eslint-disable-next-line jsx-a11y/media-has-caption */
        <audio controls src={audioUrl} className="w-full h-8 mb-2" />
      )}

      {savedList.length > 0 && (
        <div>
          <div className="font-label text-[9px] text-[#444] mb-1">Recordings ({savedList.length})</div>
          {savedList.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-0.5">
              <span className="font-readout text-[9px] text-[#333] min-w-[80px]">{item.dt}</span>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={item.d} className="h-[24px] flex-1" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
