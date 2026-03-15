import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// GET /api/chords?key=A&suffix=minor
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const suffix = req.nextUrl.searchParams.get("suffix") || "major";

  if (!key) return NextResponse.json({ error: "Missing 'key' parameter" }, { status: 400 });

  const keyMap: Record<string, string> = {
    "C": "C", "C#": "C#", "Db": "C#", "D": "D", "D#": "Eb", "Eb": "Eb",
    "E": "E", "F": "F", "F#": "F#", "Gb": "F#", "G": "G", "G#": "Ab", "Ab": "Ab",
    "A": "A", "A#": "Bb", "Bb": "Bb", "B": "B",
  };

  const folder = keyMap[key] || key;

  try {
    const chordFile = path.join(
      process.cwd(),
      "node_modules/@tombatossals/chords-db/src/db/guitar/chords",
      folder,
      `${suffix}.js`
    );

    if (!fs.existsSync(chordFile)) {
      const dir = path.join(process.cwd(), "node_modules/@tombatossals/chords-db/src/db/guitar/chords", folder);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith(".js") && f !== "index.js").map(f => f.replace(".js", ""));
        return NextResponse.json({ error: `Not found`, available: files }, { status: 404 });
      }
      return NextResponse.json({ error: `Key '${key}' not found` }, { status: 404 });
    }

    let content = fs.readFileSync(chordFile, "utf-8");

    // Parse ESM export default { ... }
    content = content.replace(/export\s+default\s+/, "");
    // Remove trailing semicolons and whitespace
    content = content.trim().replace(/;\s*$/, "");

    // Convert JS object literal to JSON-parseable format
    // Handle unquoted keys and single-quoted values
    content = content
      .replace(/(\w+)\s*:/g, '"$1":')       // unquoted keys
      .replace(/'/g, '"')                    // single to double quotes
      .replace(/,\s*([}\]])/g, '$1')         // trailing commas
      .replace(/"(true|false)"/g, '$1');      // boolean strings

    const data = JSON.parse(content);
    return NextResponse.json({ key, suffix, ...data });
  } catch (e) {
    return NextResponse.json({ error: "Failed to parse chord data", detail: String(e) }, { status: 500 });
  }
}
