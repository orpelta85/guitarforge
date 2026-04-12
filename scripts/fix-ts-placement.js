const fs = require("fs");
const path = "src/lib/exercises.ts";
let c = fs.readFileSync(path, "utf8");
let fixed = 0;

c = c.replace(/tex: `([^`]+)`/g, (m, body) => {
  // Find pattern: "\\tuning e2 a2 d3 g3 b3 e4 . \\ts N D :16"
  // Move \\ts to BEFORE the . separator
  const r = body.match(/^(.*?\\\\tuning [^.]+?) \. (\\\\ts \d+ \d+) (:.*)$/s);
  if (r) {
    fixed++;
    return "tex: `" + r[1] + " " + r[2] + " . " + r[3] + "`";
  }
  return m;
});

fs.writeFileSync(path, c);
console.log("Moved \\ts before dot:", fixed);
