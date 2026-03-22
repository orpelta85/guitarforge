import type { Exercise, Song, Stage } from "./types";
import { EXERCISES } from "./exercises";
import { STAGES } from "./constants";

// Simplified song item — no stages, just the song as a practice exercise
export function makeSongItemSimple(song: Song): Exercise {
  return {
    id: Number("99" + song.id),
    c: "Songs",
    n: song.name,
    m: 20,
    b: "",
    d: "Practice " + song.name,
    yt: song.name + " guitar tutorial",
    t: "",
    f: "Song",
    bt: false,
    ss: true,
    songId: song.id,
    songName: song.name,
    songUrl: song.url || "",
  };
}

export function ytSearch(q: string): string {
  if (q && (q.startsWith("http://") || q.startsWith("https://"))) return q;
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q) + "&sp=EgIQAQ%3D%3D";
}

export function btSearch(mode: string, scale: string, style: string): string {
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(scale + " " + mode + " " + style + " backing track guitar") + "&sp=EgIQAQ%3D%3D";
}

export function ssSearch(q: string): string {
  return "https://www.songsterr.com/?pattern=" + encodeURIComponent(q);
}

export function makeSongItem(song: Song, stageIdx: number): Exercise {
  const st = STAGES[stageIdx];
  return {
    id: Number("99" + song.id + "" + stageIdx),
    c: "Songs",
    n: song.name + " – " + st.name,
    m: st.m,
    b: "",
    d: st.d,
    yt: song.name + " guitar tutorial",
    t: "",
    f: "Song",
    bt: stageIdx >= 5,
    ss: true,
    songId: song.id,
    songName: song.name,
    songUrl: song.url || "",
    stageIdx,
  };
}

export function autoFill(catList: string[], maxMin: number, songItems: Exercise[], style?: string): Exercise[] {
  if (!catList.length || maxMin <= 0) return [];

  const result: Exercise[] = [];
  let used = 0;

  // Calculate fair time budget per category
  const nonSongCats = catList.filter(c => c !== "Songs");
  const songCats = catList.filter(c => c === "Songs");

  // Reserve time for songs if included
  let songTime = 0;
  if (songCats.length > 0 && songItems.length > 0) {
    songTime = Math.min(songItems.reduce((s, si) => s + si.m, 0), Math.floor(maxMin * 0.3));
  }

  const remainingTime = maxMin - songTime;
  const timePerCat = nonSongCats.length > 0 ? Math.floor(remainingTime / nonSongCats.length) : 0;

  // Fill each non-song category with its fair share
  for (const cat of nonSongCats) {
    const pool = EXERCISES.filter((e) => e.c === cat);
    let sorted: Exercise[];
    if (style) {
      const matched = pool.filter((e) => e.styles?.includes(style)).sort(() => Math.random() - 0.5);
      const universal = pool.filter((e) => !e.styles).sort(() => Math.random() - 0.5);
      const rest = pool.filter((e) => e.styles && !e.styles.includes(style)).sort(() => Math.random() - 0.5);
      sorted = [...matched, ...universal, ...rest];
    } else {
      sorted = pool.slice().sort(() => Math.random() - 0.5);
    }

    let catUsed = 0;
    for (const ex of sorted) {
      if (catUsed + ex.m <= timePerCat && used + ex.m <= maxMin) {
        result.push(ex);
        catUsed += ex.m;
        used += ex.m;
      }
    }

    // Guarantee at least one exercise per category
    if (catUsed === 0 && sorted.length > 0 && used + sorted[0].m <= maxMin) {
      result.push(sorted[0]);
      used += sorted[0].m;
    }
  }

  // Add songs
  if (songCats.length > 0 && songItems.length > 0) {
    for (const si of songItems) {
      if (used + si.m <= maxMin) {
        result.push(si);
        used += si.m;
      }
    }
  }

  // If there's remaining time, fill with more exercises from any category (round-robin)
  if (used < maxMin && nonSongCats.length > 0) {
    const usedIds = new Set(result.map(e => e.id));
    for (const cat of nonSongCats) {
      const pool = EXERCISES.filter(e => e.c === cat && !usedIds.has(e.id)).sort(() => Math.random() - 0.5);
      for (const ex of pool) {
        if (used + ex.m <= maxMin) {
          result.push(ex);
          usedIds.add(ex.id);
          used += ex.m;
        }
      }
    }
  }

  return result;
}
