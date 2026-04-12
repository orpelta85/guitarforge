const fs = require("fs");
const p = "src/lib/exercises.ts";
let c = fs.readFileSync(p, "utf8");
let changed = 0;

c = c.replace(/tex: `([^`]+)`/g, (m, body) => {
  // Remove broken \ts directive (wherever it is)
  let clean = body.replace(/\s*\\\\ts \d+ \d+/g, "");
  // Normalize spaces around dot
  clean = clean.replace(/\s+\.\s+/g, " . ");

  // Find notes section after dot
  const dotIdx = clean.indexOf(" . ");
  if (dotIdx < 0) return "tex: `" + clean + "`";
  const prefix = clean.slice(0, dotIdx + 3);
  const notes = clean.slice(dotIdx + 3);

  // Must be all :16 (no mixed durations)
  const durs = [...new Set(notes.match(/:\d+/g) || [])];
  if (durs.length !== 1 || durs[0] !== ":16") return "tex: `" + clean + "`";

  // Count notes in first bar
  const firstBar = notes.split("|")[0].replace(/:16/g, "").replace(/\{[^}]*\}/g, "").trim();
  const n = firstBar.split(/\s+/).filter(Boolean).length;

  let newDur = null;
  if (n === 4) newDur = ":4";       // 4 quarters = full 4/4
  else if (n === 8) newDur = ":8";  // 8 eighths = full 4/4
  else return "tex: `" + clean + "`";

  changed++;
  const newNotes = notes.replace(/:16/g, newDur);
  return "tex: `" + prefix + newNotes + "`";
});

fs.writeFileSync(p, c);
console.log("Changed:", changed);
