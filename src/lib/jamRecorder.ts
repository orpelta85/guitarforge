"use client";

/**
 * JamRecorder — captures the live mix of Jam Mode audio sources into a single
 * file the user can download or save.
 *
 * Architecture:
 *  - We build a MediaStreamAudioDestinationNode on the same AudioContext that
 *    Tone.js uses (Tone.getContext().rawContext).  Because every Tone.js synth
 *    in Jam Mode is connected to Tone.Destination, we tap that destination by
 *    connecting `Tone.getDestination()` (which exposes a standard AudioNode
 *    output via `.output`) to our MediaStreamDestination.  The existing
 *    Tone.Destination → speakers path is preserved — we are *adding* a tap, not
 *    rerouting.
 *  - For HTMLAudioElement-based sources (the Suno backing track), we call
 *    `audioElement.captureStream()` (or mozCaptureStream as fallback), wrap the
 *    resulting MediaStream in a MediaStreamAudioSourceNode on the same
 *    AudioContext, and connect that to our MediaStreamDestination.
 *  - The MediaRecorder records the merged stream.  On stop we decode the blob
 *    back into an AudioBuffer (so the caller can encode to WAV/MP3 via the
 *    existing wavEncoder/mp3Encoder helpers).
 *
 * Limitations (v1):
 *  - JamLooper runs on its own AudioContext (separate from Tone), so its
 *    output is NOT captured here.  Looper has its own per-loop recorder.
 *  - The first call to start() must happen after a user gesture (click) so the
 *    AudioContext is unlocked and MediaRecorder can begin.
 */

export interface JamRecorderResult {
  /** Raw recorded blob (audio/webm). */
  webmBlob: Blob;
  /** Decoded AudioBuffer — ready to feed audioBufferToWav / audioBufferToMp3. */
  audioBuffer: AudioBuffer;
  /** Recording duration in seconds (derived from the AudioBuffer). */
  durationSec: number;
}

export interface JamRecorder {
  start(): Promise<void>;
  stop(): Promise<JamRecorderResult>;
  isRecording(): boolean;
  /** Tap a Suno-style HTMLAudioElement (uses captureStream). Safe to call
   *  before or after start; the tap is wired immediately. */
  attachAudioElement(el: HTMLAudioElement): boolean;
  /** Attach an arbitrary AudioNode that lives on the same AudioContext. */
  attachAudioNode(node: AudioNode): void;
  dispose(): void;
}

/**
 * Loose Tone-shape interface — Tone.getContext().rawContext can be a real
 * AudioContext or an OfflineAudioContext per Tone's union types, but in
 * practice when called from a live page it's always an AudioContext.  We cast
 * to AudioContext at the boundary.
 */
interface ToneLike {
  getContext: () => { rawContext: BaseAudioContext };
  getDestination: () => unknown;
}

/** Map of HTMLAudioElement -> { source, gain } we created so we can clean up. */
interface AttachedElement {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
}

export function createJamRecorder(Tone: ToneLike): JamRecorder {
  const rawCtx = Tone.getContext().rawContext;
  // We only support live recording — Offline contexts can't host MediaRecorder.
  if (typeof (rawCtx as AudioContext).createMediaStreamDestination !== "function") {
    throw new Error("JamRecorder requires a live AudioContext (got Offline)");
  }
  const ctx = rawCtx as AudioContext;
  const merger = ctx.createGain();
  merger.gain.value = 1;

  // Tap Tone.Destination — connect its output to our merger.
  // Tone.Destination is a Tone class with `.output` (the actual AudioNode), but
  // some Tone builds also expose connect() directly.  Try both safely.
  const dest = Tone.getDestination() as { output?: AudioNode } & Partial<AudioNode>;
  const toneOutNode: AudioNode | null =
    (dest.output && typeof dest.output === "object" ? dest.output : null) ||
    (typeof (dest as AudioNode).connect === "function" ? (dest as unknown as AudioNode) : null);
  if (toneOutNode) {
    try {
      toneOutNode.connect(merger);
    } catch {
      /* node already connected — safe to ignore */
    }
  }

  // MediaStreamDestination — what MediaRecorder will read from.
  const streamDest = ctx.createMediaStreamDestination();
  merger.connect(streamDest);

  // Attached HTMLAudioElement bookkeeping (so dispose can disconnect).
  const attachedElements = new Map<HTMLAudioElement, AttachedElement>();
  const attachedNodes: AudioNode[] = [];

  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let recording = false;
  let startedAt = 0;

  function pickMimeType(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) {
        return c;
      }
    }
    return "";
  }

  return {
    isRecording: () => recording,

    attachAudioElement(el: HTMLAudioElement): boolean {
      if (attachedElements.has(el)) return true;
      try {
        // Resume context if suspended (autoplay-gesture quirks)
        if (ctx.state === "suspended") {
          void ctx.resume();
        }
        type CaptureCapable = HTMLAudioElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        };
        const cap = el as CaptureCapable;
        const captureFn = cap.captureStream || cap.mozCaptureStream;
        if (!captureFn) return false;
        const stream = captureFn.call(el);
        if (!stream || stream.getAudioTracks().length === 0) return false;
        const source = ctx.createMediaStreamSource(stream);
        const gain = ctx.createGain();
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(merger);
        attachedElements.set(el, { source, gain });
        return true;
      } catch {
        return false;
      }
    },

    attachAudioNode(node: AudioNode): void {
      try {
        node.connect(merger);
        attachedNodes.push(node);
      } catch {
        /* ignore */
      }
    },

    async start(): Promise<void> {
      if (recording) return;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const mime = pickMimeType();
      const opts: MediaRecorderOptions | undefined = mime ? { mimeType: mime } : undefined;
      mediaRecorder = new MediaRecorder(streamDest.stream, opts);
      chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start(250); // emit chunks every 250ms so we always have data
      recording = true;
      startedAt = ctx.currentTime;
    },

    async stop(): Promise<JamRecorderResult> {
      if (!mediaRecorder || !recording) {
        throw new Error("JamRecorder.stop called when not recording");
      }
      const rec = mediaRecorder;
      const stoppedPromise = new Promise<void>((resolve) => {
        rec.addEventListener("stop", () => resolve(), { once: true });
      });
      rec.stop();
      await stoppedPromise;
      recording = false;

      const mime = rec.mimeType || "audio/webm";
      const webmBlob = new Blob(chunks, { type: mime });
      chunks = [];

      // Decode to AudioBuffer so callers can encode to WAV/MP3.
      const arrayBuf = await webmBlob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
      const elapsed = Math.max(0, ctx.currentTime - startedAt);
      const durationSec = audioBuffer.duration || elapsed;
      return { webmBlob, audioBuffer, durationSec };
    },

    dispose(): void {
      try {
        if (mediaRecorder && recording) mediaRecorder.stop();
      } catch { /* ignore */ }
      recording = false;
      mediaRecorder = null;
      chunks = [];
      // Disconnect everything we wired up.
      try { merger.disconnect(); } catch { /* ignore */ }
      try { streamDest.stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      for (const { source, gain } of attachedElements.values()) {
        try { source.disconnect(); } catch { /* ignore */ }
        try { gain.disconnect(); } catch { /* ignore */ }
      }
      attachedElements.clear();
      for (const node of attachedNodes) {
        try { node.disconnect(merger); } catch { /* ignore */ }
      }
      attachedNodes.length = 0;
      // Note: we don't disconnect Tone.Destination from merger explicitly —
      // garbage collection of the merger handles it once nothing else holds a
      // reference, and Tone.Destination itself is shared so we must not break
      // its wiring with other consumers.
    },
  };
}
