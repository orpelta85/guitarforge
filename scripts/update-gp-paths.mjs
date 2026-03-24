import { readFileSync, writeFileSync } from 'fs';

const progress = JSON.parse(readFileSync('gp-download-progress.json', 'utf8'));
const songsFile = readFileSync('src/lib/spotify-songs.ts', 'utf8');

// Build lookup: normalize "artist|title" => gpPath
const gpLookup = new Map();
for (const [key, val] of Object.entries(progress.completed)) {
  if (!val.gpPath) continue;
  const [artist, title] = key.split('|');
  const normKey = `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}`;
  gpLookup.set(normKey, val.gpPath);
}

console.log(`GP entries with paths: ${gpLookup.size}`);

let updated = 0;
const lines = songsFile.split('\n');
const newLines = lines.map(line => {
  // Skip lines that already have gp: true or gpPath
  if (/\bgp\s*:\s*true\b/.test(line) || /\bgpPath\s*:/.test(line)) return line;

  // Extract artist and title from the line
  const titleMatch = line.match(/title:\s*"([^"]+)"/);
  const artistMatch = line.match(/artist:\s*"([^"]+)"/);
  if (!titleMatch || !artistMatch) return line;

  const title = titleMatch[1].toLowerCase().trim();
  const artist = artistMatch[1].toLowerCase().trim();
  const lookupKey = `${artist}|${title}`;

  const gpPath = gpLookup.get(lookupKey);
  if (!gpPath) return line;

  // Insert gp: true, gpPath: "..." before the closing }
  // Find the last } on the line
  const lastBrace = line.lastIndexOf('}');
  if (lastBrace === -1) return line;

  // Escape any quotes in gpPath
  const escapedPath = gpPath.replace(/"/g, '\\"');
  const insertion = `, gp: true, gpPath: "${escapedPath}"`;
  const newLine = line.slice(0, lastBrace) + insertion + line.slice(lastBrace);
  updated++;
  return newLine;
});

writeFileSync('src/lib/spotify-songs.ts', newLines.join('\n'), 'utf8');
console.log(`Updated ${updated} songs with GP tab data.`);
