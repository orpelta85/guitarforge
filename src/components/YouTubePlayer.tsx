"use client";
import { useState, useRef, useCallback } from "react";
import YouTube, { type YouTubeEvent, type YouTubePlayer as YTPlayer } from "react-youtube";

interface YouTubePlayerProps {
  query: string;
  videoId?: string;
}

export default function YouTubePlayerBox({ query, videoId: initialVideoId }: YouTubePlayerProps) {
  const [videoId, setVideoId] = useState(initialVideoId || "");
  const [searchInput, setSearchInput] = useState(query);
  const [speed, setSpeed] = useState(1);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onReady = useCallback((e: YouTubeEvent) => {
    playerRef.current = e.target;
  }, []);

  function setPlaybackSpeed(rate: number) {
    setSpeed(rate);
    playerRef.current?.setPlaybackRate(rate);
  }

  function markA() {
    const t = playerRef.current?.getCurrentTime();
    if (t !== undefined) setLoopA(Math.round(t));
  }

  function markB() {
    const t = playerRef.current?.getCurrentTime();
    if (t !== undefined) {
      setLoopB(Math.round(t));
      // Start loop polling
      if (loopRef.current) clearInterval(loopRef.current);
      loopRef.current = setInterval(() => {
        const cur = playerRef.current?.getCurrentTime();
        if (cur !== undefined && loopA !== null && cur >= (Math.round(t))) {
          playerRef.current?.seekTo(loopA, true);
        }
      }, 300);
    }
  }

  function clearLoop() {
    setLoopA(null);
    setLoopB(null);
    if (loopRef.current) clearInterval(loopRef.current);
  }

  // Extract video ID from URL
  function extractVideoId(input: string): string | null {
    const match = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  function handleSearch() {
    const extracted = extractVideoId(searchInput);
    if (extracted) {
      setVideoId(extracted);
    } else {
      // Open YouTube search in new tab
      window.open("https://www.youtube.com/results?search_query=" + encodeURIComponent(searchInput), "_blank");
    }
  }

  return (
    <div className="panel p-4 mb-3">
      <div className="font-label text-[10px] text-[#D4A843] mb-3 flex items-center gap-2">
        <div className="led led-gold" />
        Video Player
      </div>

      {/* Search / URL input */}
      <div className="flex gap-2 mb-3">
        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="YouTube URL or search..."
          className="input flex-1 !text-xs" />
        <button onClick={handleSearch} className="btn-gold !text-[10px]">Load</button>
      </div>

      {/* Player */}
      {videoId ? (
        <div className="mb-3">
          <div className="aspect-video w-full rounded-sm overflow-hidden bg-black">
            <YouTube
              videoId={videoId}
              opts={{
                width: "100%",
                height: "100%",
                playerVars: { modestbranding: 1, rel: 0 },
              }}
              onReady={onReady}
              className="w-full h-full"
              iframeClassName="w-full h-full"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Speed */}
            <div className="flex items-center gap-1">
              <span className="font-label text-[9px] text-[#555]">Speed</span>
              {[0.5, 0.75, 1, 1.25, 1.5].map((r) => (
                <button key={r} onClick={() => setPlaybackSpeed(r)}
                  className={`font-readout text-[10px] px-2 py-0.5 rounded-sm cursor-pointer border transition-all ${
                    speed === r ? "border-[#D4A843] text-[#D4A843] bg-[#D4A843]/10" : "border-[#222] text-[#555]"
                  }`}>{r}x</button>
              ))}
            </div>

            <div className="divider-gold w-px h-4 mx-1" style={{ background: "#333" }} />

            {/* A-B Loop */}
            <div className="flex items-center gap-1">
              <span className="font-label text-[9px] text-[#555]">Loop</span>
              <button onClick={markA}
                className={`font-readout text-[10px] px-2 py-0.5 rounded-sm cursor-pointer border transition-all ${
                  loopA !== null ? "border-[#33CC33] text-[#33CC33]" : "border-[#222] text-[#555]"
                }`}>A{loopA !== null ? ` ${loopA}s` : ""}</button>
              <button onClick={markB}
                className={`font-readout text-[10px] px-2 py-0.5 rounded-sm cursor-pointer border transition-all ${
                  loopB !== null ? "border-[#33CC33] text-[#33CC33]" : "border-[#222] text-[#555]"
                }`}>B{loopB !== null ? ` ${loopB}s` : ""}</button>
              {(loopA !== null || loopB !== null) && (
                <button onClick={clearLoop} className="font-label text-[9px] text-[#C41E3A] cursor-pointer">Clear</button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="font-label text-[11px] text-[#333]">Paste a YouTube URL or search to load a video</div>
        </div>
      )}
    </div>
  );
}
