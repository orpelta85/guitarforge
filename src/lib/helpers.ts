import type { Exercise, Song, Stage } from "./types";
import { EXERCISES } from "./exercises";
import { STAGES } from "./constants";

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
    c: "שירים",
    n: song.name + " – " + st.name,
    m: st.m,
    b: "",
    d: st.d,
    yt: song.name + " guitar tutorial",
    t: "",
    f: "שיר",
    bt: stageIdx >= 5,
    ss: true,
    songId: song.id,
    songName: song.name,
    songUrl: song.url || "",
    stageIdx,
  };
}

export function autoFill(catList: string[], maxMin: number, songItems: Exercise[], style?: string): Exercise[] {
  const result: Exercise[] = [];
  let used = 0;

  for (const cat of catList) {
    if (cat === "שירים" && songItems.length > 0) {
      for (const si of songItems) {
        if (used + si.m <= maxMin) {
          result.push(si);
          used += si.m;
        }
      }
    } else {
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
      for (const ex of sorted) {
        if (used + ex.m <= maxMin) {
          result.push(ex);
          used += ex.m;
        }
      }
    }
  }
  return result;
}
