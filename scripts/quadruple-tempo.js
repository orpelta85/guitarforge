const fs = require("fs");
const p = "src/lib/exercises.ts";
let c = fs.readFileSync(p, "utf8");
let changed = 0;

c = c.replace(/tex: `([^`]+)`/g, (m, body) => {
  const dotIdx = body.indexOf(" . ");
  if (dotIdx < 0) return m;
  const notes = body.slice(dotIdx + 3);
  // Only affect tex with :16 (fixed ones without barlines - the "gap" exercises)
  if (!/^:16 /.test(notes)) return m;
  // Check no barlines (our marker for fixed-duration-only exercises)
  if (notes.includes("|")) return m;
  // Quadruple the tempo
  const newBody = body.replace(/\\\\tempo (\d+)/, (mm, tempo) => {
    const newTempo = parseInt(tempo, 10) * 4;
    return `\\\\tempo ${newTempo}`;
  });
  if (newBody !== body) changed++;
  return "tex: `" + newBody + "`";
});

fs.writeFileSync(p, c);
console.log("Quadrupled tempo for:", changed);
