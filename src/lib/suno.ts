/* Suno AI API Client
 * Works with gcui-art/suno-api self-hosted wrapper
 * Set SUNO_API_URL in .env.local to point to your deployment
 */

const BASE = process.env.SUNO_API_URL || "";

export interface SunoClip {
  id: string;
  audio_url: string;
  status: string;
  title: string;
  duration: number;
}

export async function generateTrack(tags: string, title: string): Promise<SunoClip[]> {
  if (!BASE) throw new Error("SUNO_API_URL not configured");

  const res = await fetch(`${BASE}/api/custom_generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "",
      tags,
      title,
      make_instrumental: true,
      wait_audio: false,
    }),
  });

  if (!res.ok) throw new Error(`Suno error: ${res.status}`);
  return res.json();
}

export async function pollClips(ids: string[]): Promise<SunoClip[]> {
  if (!BASE) throw new Error("SUNO_API_URL not configured");
  const res = await fetch(`${BASE}/api/get?ids=${ids.join(",")}`);
  if (!res.ok) throw new Error(`Suno poll error: ${res.status}`);
  return res.json();
}

export async function checkCredits(): Promise<{ credits_left: number }> {
  if (!BASE) throw new Error("SUNO_API_URL not configured");
  const res = await fetch(`${BASE}/api/get_limit`);
  if (!res.ok) throw new Error(`Suno credits error: ${res.status}`);
  return res.json();
}

export function buildPrompt(scale: string, mode: string, style: string, bpm?: number): string {
  const parts = [scale, mode, style, "instrumental", "guitar practice backing track", "no vocals", "no lead guitar"];
  if (bpm) parts.push(`${bpm} BPM`);
  return parts.join(", ");
}
