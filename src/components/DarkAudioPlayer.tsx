"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface DarkAudioPlayerProps {
  src: string;
  title?: string;
  compact?: boolean;
  onEnded?: () => void;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function DarkAudioPlayer({
  src,
  title,
  compact = false,
  onEnded,
  autoPlay = false,
  loop = false,
  className = "",
}: DarkAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekRef = useRef<HTMLDivElement | null>(null);
  const volRef = useRef<HTMLDivElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [looping, setLooping] = useState(loop);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [draggingSeek, setDraggingSeek] = useState(false);
  const [draggingVol, setDraggingVol] = useState(false);

  // Sync loop prop
  useEffect(() => {
    setLooping(loop);
  }, [loop]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.loop = looping;
  }, [volume, looping]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onLoadedMeta = () => {
      setDuration(a.duration);
      setLoading(false);
    };
    const onTimeUpdate = () => {
      if (!draggingSeek) setCurrentTime(a.currentTime);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      onEnded?.();
    };
    const onErr = () => {
      setError(true);
      setLoading(false);
    };
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);

    a.addEventListener("loadedmetadata", onLoadedMeta);
    a.addEventListener("timeupdate", onTimeUpdate);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onErr);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("canplay", onCanPlay);

    return () => {
      a.removeEventListener("loadedmetadata", onLoadedMeta);
      a.removeEventListener("timeupdate", onTimeUpdate);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onErr);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("canplay", onCanPlay);
    };
  }, [src, onEnded, draggingSeek]);

  // Reset state on src change
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoading(true);
    setError(false);
  }, [src]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }, []);

  const toggleLoop = useCallback(() => {
    setLooping((prev) => !prev);
  }, []);

  // Seek bar interaction
  const seekTo = useCallback(
    (clientX: number) => {
      const bar = seekRef.current;
      const a = audioRef.current;
      if (!bar || !a || !duration) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const t = ratio * duration;
      a.currentTime = t;
      setCurrentTime(t);
    },
    [duration],
  );

  const handleSeekDown = useCallback(
    (e: React.MouseEvent) => {
      setDraggingSeek(true);
      seekTo(e.clientX);
    },
    [seekTo],
  );

  useEffect(() => {
    if (!draggingSeek) return;
    const onMove = (e: MouseEvent) => seekTo(e.clientX);
    const onUp = () => setDraggingSeek(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingSeek, seekTo]);

  // Volume bar interaction
  const setVol = useCallback((clientX: number) => {
    const bar = volRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setVolume(ratio);
  }, []);

  const handleVolDown = useCallback(
    (e: React.MouseEvent) => {
      setDraggingVol(true);
      setVol(e.clientX);
    },
    [setVol],
  );

  useEffect(() => {
    if (!draggingVol) return;
    const onMove = (e: MouseEvent) => setVol(e.clientX);
    const onUp = () => setDraggingVol(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingVol, setVol]);

  // Keyboard controls
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const a = audioRef.current;
      if (!a) return;
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        a.currentTime = Math.max(0, a.currentTime - 5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        a.currentTime = Math.min(duration, a.currentTime + 5);
      }
    },
    [togglePlay, duration],
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volPercent = volume * 100;

  const displayTitle =
    title || (src ? src.split("/").pop()?.split("?")[0] || "Audio" : "Audio");

  // Speaker icon based on volume
  const speakerIcon =
    volume === 0
      ? "M11 5L6 9H2v6h4l5 4V5z"
      : volume < 0.5
        ? "M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07"
        : "M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14";

  if (error) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${className}`}
        style={{
          background: "var(--bg-recess)",
          border: "1px solid var(--border-panel)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C41E3A" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <span className="font-label text-[10px] text-[#C41E3A]">Failed to load audio</span>
      </div>
    );
  }

  // ── Compact mode ──
  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg select-none ${className}`}
        style={{
          background: "var(--bg-recess)",
          border: "1px solid var(--border-panel)",
        }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <audio ref={audioRef} src={src} preload="metadata" autoPlay={autoPlay} />

        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="flex-shrink-0 w-6 h-6 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-colors"
          style={{
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-accent)",
          }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {loading ? (
            <svg width="10" height="10" viewBox="0 0 24 24" className="animate-spin">
              <circle cx="12" cy="12" r="10" fill="none" stroke="var(--gold-dim)" strokeWidth="3" />
              <path d="M12 2a10 10 0 019.5 7" fill="none" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : playing ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--gold)">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--gold)">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
        </button>

        {/* Title */}
        {title && (
          <span className="font-label text-[9px] text-[var(--text-secondary)] truncate max-w-[100px]">
            {displayTitle}
          </span>
        )}

        {/* Time */}
        <span className="font-readout text-[9px] text-[var(--text-muted)] flex-shrink-0 tabular-nums">
          {formatTime(currentTime)}/{formatTime(duration)}
        </span>

        {/* Seek bar */}
        <div
          ref={seekRef}
          className="flex-1 h-3 flex items-center cursor-pointer min-w-[60px]"
          onMouseDown={handleSeekDown}
        >
          <div className="w-full h-[3px] rounded-full relative" style={{ background: "var(--bg-tertiary)" }}>
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ width: `${progress}%`, background: "var(--gold)" }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
              style={{
                left: `${progress}%`,
                transform: `translate(-50%, -50%)`,
                background: "var(--gold-bright)",
                boxShadow: "0 0 4px rgba(212,168,67,0.4)",
              }}
            />
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={speakerIcon} />
          </svg>
        </div>
      </div>
    );
  }

  // ── Full mode ──
  return (
    <div
      className={`rounded-lg select-none ${className}`}
      style={{
        background: "var(--bg-recess)",
        border: "1px solid var(--border-panel)",
        padding: "10px 14px",
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <audio ref={audioRef} src={src} preload="metadata" autoPlay={autoPlay} />

      {/* Row 1: Play + Title + Time */}
      <div className="flex items-center gap-2.5 mb-2">
        <button
          onClick={togglePlay}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{
            background: "linear-gradient(135deg, var(--bg-tertiary), var(--bg-elevated))",
            border: "1px solid var(--border-accent)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {loading ? (
            <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin">
              <circle cx="12" cy="12" r="10" fill="none" stroke="var(--gold-dim)" strokeWidth="3" />
              <path d="M12 2a10 10 0 019.5 7" fill="none" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--gold)">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--gold)">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="font-label text-[10px] text-[var(--text-secondary)] truncate leading-tight">
            {displayTitle}
          </div>
        </div>

        <div className="font-readout text-[10px] text-[var(--text-muted)] flex-shrink-0 tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Row 2: Seek bar */}
      <div
        ref={seekRef}
        className="h-4 flex items-center cursor-pointer mb-2"
        onMouseDown={handleSeekDown}
      >
        <div className="w-full h-[4px] rounded-full relative" style={{ background: "var(--bg-tertiary)" }}>
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-[width]"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, var(--gold-dark), var(--gold))",
              transitionDuration: draggingSeek ? "0ms" : "100ms",
            }}
          />
          <div
            className="absolute top-1/2 w-2.5 h-2.5 rounded-full"
            style={{
              left: `${progress}%`,
              transform: "translate(-50%, -50%)",
              background: "var(--gold-bright)",
              boxShadow: "0 0 6px rgba(212,168,67,0.5)",
              transition: draggingSeek ? "none" : "left 100ms",
            }}
          />
        </div>
      </div>

      {/* Row 3: Volume + controls */}
      <div className="flex items-center gap-3">
        {/* Volume */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
            className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={volume === 0 ? "Unmute" : "Mute"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={speakerIcon} />
            </svg>
          </button>
          <div
            ref={volRef}
            className="w-16 h-3 flex items-center cursor-pointer"
            onMouseDown={handleVolDown}
          >
            <div className="w-full h-[3px] rounded-full relative" style={{ background: "var(--bg-tertiary)" }}>
              <div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{ width: `${volPercent}%`, background: "var(--gold-dim)" }}
              />
              <div
                className="absolute top-1/2 w-2 h-2 rounded-full"
                style={{
                  left: `${volPercent}%`,
                  transform: "translate(-50%, -50%)",
                  background: "var(--gold)",
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Loop toggle */}
        <button
          onClick={toggleLoop}
          className="p-1 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          style={{
            color: looping ? "var(--gold)" : "var(--text-muted)",
            opacity: looping ? 1 : 0.5,
          }}
          aria-label={looping ? "Disable loop" : "Enable loop"}
          title={looping ? "Loop on" : "Loop off"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 014-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
        </button>

        {/* Download */}
        <a
          href={src}
          download
          className="p-1 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          style={{ color: "var(--text-muted)", opacity: 0.5 }}
          title="Download"
          aria-label="Download audio"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}
