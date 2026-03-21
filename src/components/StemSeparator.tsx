"use client";
import { useState, useEffect, useCallback } from "react";
import DarkAudioPlayer from "./DarkAudioPlayer";

interface StemUrls {
  vocals?: string;
  instrumental?: string;
  guitar?: string;
  bass?: string;
  drums?: string;
}

interface CachedStems {
  stems: StemUrls;
  cachedAt: number;
}

interface Props {
  audioUrl: string;
  cacheKey: string;
  compact?: boolean;
}

const STEM_DB_NAME = "guitarforge_stems_cache";
const STEM_DB_VERSION = 1;
const STEM_STORE = "stems";

const STEM_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  vocals: { label: "Vocals", icon: "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z", color: "#8b5cf6" },
  instrumental: { label: "Instrumental", icon: "M9 18V5l12-2v13", color: "#D4A843" },
  guitar: { label: "Guitar", icon: "M9 18V5l12-2v13", color: "#22c55e" },
  bass: { label: "Bass", icon: "M9 18V5l12-2v13", color: "#3b82f6" },
  drums: { label: "Drums", icon: "M12 2v20M2 12h20", color: "#ef4444" },
};

function openStemDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(STEM_DB_NAME, STEM_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STEM_STORE)) {
        db.createObjectStore(STEM_STORE, { keyPath: "cacheKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedStems(key: string): Promise<CachedStems | null> {
  try {
    const db = await openStemDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STEM_STORE, "readonly");
      const req = tx.objectStore(STEM_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function cacheStems(key: string, stems: StemUrls): Promise<void> {
  try {
    const db = await openStemDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STEM_STORE, "readwrite");
      tx.objectStore(STEM_STORE).put({ cacheKey: key, stems, cachedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // non-critical
  }
}

export default function StemSeparator({ audioUrl, cacheKey, compact }: Props) {
  const [stems, setStems] = useState<StemUrls | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [mutedStems, setMutedStems] = useState<Record<string, boolean>>({});

  // Check cache on mount
  useEffect(() => {
    getCachedStems(cacheKey).then((cached) => {
      if (cached?.stems) {
        setStems(cached.stems);
        setExpanded(true);
      }
    });
  }, [cacheKey]);

  const separate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/suno/separate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.stems || Object.keys(data.stems).length === 0) {
        throw new Error("No stems returned — separation may not be supported for this audio");
      }
      setStems(data.stems);
      setExpanded(true);
      await cacheStems(cacheKey, data.stems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Separation failed");
    }
    setLoading(false);
  }, [audioUrl, cacheKey]);

  const toggleMute = useCallback((stemKey: string) => {
    setMutedStems((prev) => ({ ...prev, [stemKey]: !prev[stemKey] }));
  }, []);

  if (!expanded && !loading) {
    return (
      <div className={compact ? "" : "mt-3"}>
        <button
          type="button"
          onClick={stems ? () => setExpanded(true) : separate}
          className="flex items-center gap-2 font-label text-[10px] px-3 py-1.5 rounded-lg cursor-pointer border transition-all border-[#8b5cf630] text-[#8b5cf6] hover:bg-[#8b5cf610] bg-transparent"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 11a9 9 0 0118 0" />
            <path d="M4 19a9 9 0 0118 0" />
            <path d="M4 15a9 9 0 0118 0" />
          </svg>
          {stems ? "Show Stems" : "Separate Stems"}
        </button>
        {error && <div className="text-[10px] text-[var(--crimson)] mt-1">{error}</div>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-[var(--bg-secondary)] border border-[#8b5cf620] rounded-lg p-5 text-center mt-3">
        <div className="inline-block w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin mb-2" />
        <div className="text-[12px] text-[#8b5cf6]">Separating stems...</div>
        <div className="text-[10px] text-[var(--text-muted)] mt-1">
          Extracting vocals, guitar, bass, drums — this takes 30-90 seconds
        </div>
      </div>
    );
  }

  if (!stems) return null;

  const stemEntries = Object.entries(stems).filter(([, url]) => url);

  return (
    <div className="bg-[var(--bg-secondary)] border border-[#8b5cf620] rounded-lg p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-label text-[10px] text-[#8b5cf6] flex items-center gap-2">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
            <path d="M4 11a9 9 0 0118 0" />
            <path d="M4 19a9 9 0 0118 0" />
            <path d="M4 15a9 9 0 0118 0" />
          </svg>
          SEPARATED STEMS
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-pointer"
        >
          Collapse
        </button>
      </div>

      <div className="space-y-2">
        {stemEntries.map(([key, url]) => {
          const meta = STEM_LABELS[key] || { label: key, icon: "", color: "#888" };
          const isMuted = mutedStems[key] || false;

          return (
            <div key={key} className="flex items-center gap-2">
              {/* Mute toggle */}
              <button
                type="button"
                onClick={() => toggleMute(key)}
                className={`flex-shrink-0 font-label text-[8px] w-6 h-6 rounded flex items-center justify-center cursor-pointer border transition-all ${
                  isMuted
                    ? "border-[#C41E3A] text-[#C41E3A] bg-[#C41E3A15]"
                    : "border-[#333] text-[#888]"
                }`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? "M" : "S"}
              </button>

              {/* Label */}
              <span
                className="font-label text-[9px] w-20 flex-shrink-0"
                style={{ color: meta.color }}
              >
                {meta.label}
              </span>

              {/* Player */}
              <div className="flex-1">
                {!isMuted && url ? (
                  <DarkAudioPlayer src={url} compact />
                ) : (
                  <div className="h-6 rounded bg-[var(--bg-recess)] border border-[var(--border-panel)] flex items-center justify-center">
                    <span className="text-[9px] text-[#333]">Muted</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Re-separate button */}
      <button
        type="button"
        onClick={separate}
        className="text-[9px] text-[var(--text-muted)] hover:text-[#8b5cf6] cursor-pointer transition-colors mt-2"
      >
        Re-separate
      </button>
      {error && <div className="text-[10px] text-[var(--crimson)] mt-1">{error}</div>}
    </div>
  );
}
