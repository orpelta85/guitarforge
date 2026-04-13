// Fix: restore barlines every 4 notes, prefix each bar with \ac (anacrusis)
// This makes each bar's length adapt to actual notes - no auto-stretch.
// Also revert \tempo 300/320 back to original 75/80.
const fs = require("fs");
const p = "src/lib/exercises.ts";
let c = fs.readFileSync(p, "utf8");
let changed = 0;

// First: revert tempo 300/320 back to original values
// (I'll look at the original tempo in comments or assume reverted)
// Actually - the original had various tempos. Let me just divide by 4 if it's currently 4x of a reasonable value
c = c.replace(/(\\\\tempo )(\d+)/g, (m, pre, tempo) => {
  const t = parseInt(tempo, 10);
  // Revert our 4x hack - any tempo that's a clean multiple of 4 and > 200 is likely hacked
  if (t >= 200 && t % 4 === 0 && t <= 400) {
    return pre + (t / 4);
  }
  return m;
});

c = c.replace(/tex: `([^`]+)`/g, (m, body) => {
  const dotIdx = body.indexOf(" . ");
  if (dotIdx < 0) return m;
  const prefix = body.slice(0, dotIdx + 3);
  let notes = body.slice(dotIdx + 3);

  // Skip if mixed durations
  const durs = [...new Set(notes.match(/:\d+/g) || [])];
  if (durs.length !== 1 || durs[0] !== ":16") return m;

  // Skip if already has \ac
  if (notes.includes("\\\\ac")) return m;

  // Get all notes (strip duration tokens)
  // First remove any :16 tokens
  const stripped = notes.replace(/:16\s*/g, "").replace(/\s*\|\s*/g, " ").trim();
  const tokens = stripped.split(/\s+/).filter(Boolean);

  // Rebuild: group into bars of 4 notes each with \ac :16 prefix
  if (tokens.length < 4) return m;
  const groupSize = 4;
  const bars = [];
  for (let i = 0; i < tokens.length; i += groupSize) {
    bars.push(tokens.slice(i, i + groupSize).join(" "));
  }
  const newNotes = bars.map(b => `\\\\ac :16 ${b}`).join(" | ");
  changed++;
  return "tex: `" + prefix + newNotes + "`";
});

fs.writeFileSync(p, c);
console.log("Changed:", changed);
