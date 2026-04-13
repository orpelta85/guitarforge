// YouTube IFrame Player API singleton loader.
// Loads https://www.youtube.com/iframe_api once, resolves when window.YT.Player is ready.

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: Record<string, unknown>
      ) => YTPlayerInstance;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
  loadVideoById: (id: string) => void;
}

let ytReady: Promise<void> | null = null;

export function ensureYT(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("window unavailable"));
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytReady) return ytReady;

  ytReady = new Promise<void>((resolve) => {
    // If script already in DOM but not yet ready, just wait for callback.
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { prev?.(); } catch { /* ignore */ }
      resolve();
    };
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }
    // Safety: if YT already loaded between checks, resolve on next tick.
    if (window.YT && window.YT.Player) resolve();
  });
  return ytReady;
}

// Parse a YouTube URL or bare 11-char ID into a video ID.
// Supported:
//   - https://www.youtube.com/watch?v=dQw4w9WgXcQ
//   - https://youtu.be/dQw4w9WgXcQ
//   - https://www.youtube.com/embed/dQw4w9WgXcQ
//   - https://www.youtube.com/shorts/dQw4w9WgXcQ
//   - dQw4w9WgXcQ
export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      // /embed/ID, /shorts/ID, /live/ID
      const maybeId = parts[parts.length - 1];
      if (maybeId && /^[a-zA-Z0-9_-]{11}$/.test(maybeId)) return maybeId;
    }
  } catch {
    // fall through
  }
  return null;
}
