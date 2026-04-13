const fs = require("fs");
const p = "src/lib/exercises.ts";
let c = fs.readFileSync(p, "utf8");
let changed = 0;

c = c.replace(/tex: `([^`]+)`/g, (m, body) => {
  const dotIdx = body.indexOf(" . ");
  if (dotIdx < 0) return m;
  const prefix = body.slice(0, dotIdx + 3);
  let notes = body.slice(dotIdx + 3);

  // Only process pure :4 (my earlier fix) or pure :8
  const durs = [...new Set(notes.match(/:\d+/g) || [])];
  if (durs.length !== 1) return m;

  if (durs[0] === ":4" || durs[0] === ":8") {
    // Convert to :16 (fastest) and remove barlines so alphaTab auto-bars
    notes = notes.replace(/:\d+/g, ":16").replace(/\s*\|\s*/g, " ");
    changed++;
    return "tex: `" + prefix + notes.trim() + "`";
  }
  return m;
});

fs.writeFileSync(p, c);
console.log("Changed:", changed);
