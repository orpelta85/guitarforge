const fs = require("fs");
const c = fs.readFileSync("src/lib/exercises.ts", "utf8");
const regex = /\{ id: (\d+),[^}]*?tex: `([^`]+)`/g;
let m, total = 0, broken = [], fixed = [], mixedDur = 0;
while ((m = regex.exec(c))) {
  const id = m[1]; const body = m[2];
  const dotIdx = body.indexOf(" . ");
  if (dotIdx < 0) continue;
  const notes = body.slice(dotIdx + 3);
  total++;
  const hasTs = /\\ts \d+ \d+/.test(body);
  const durs = [...new Set((notes.match(/:\d+/g) || []))];
  if (durs.length !== 1) { mixedDur++; continue; }
  if (durs[0] !== ":16") continue;
  const bars = notes.split("|");
  const first = bars[0].replace(/:16/g, "").replace(/\{[^}]*\}/g, "").trim();
  const n = first.split(/\s+/).filter(Boolean).length;
  if (n === 16) continue;
  if (!hasTs) broken.push({ id, n });
  else fixed.push({ id, n });
}
console.log("Total tex:", total, "mixed-duration:", mixedDur);
console.log("Broken (no ts, non-4/4):", broken.length, broken);
console.log("Fixed (has ts):", fixed.length);
