"""
Enrich spotify-songs.ts with:
1. popularity + durationMs from spotify-songs-raw.json
2. artistCountry, artistTags, ytTutorial from enriched-songs.json
3. gp: true for artists in gp-artists-list.json (282 artists)
"""
import json
import re
import openpyxl

BASE = "c:/Users/User/guitarforge"

# Load data sources
with open(f"{BASE}/scripts/spotify-songs-raw.json", encoding="utf-8") as f:
    raw_songs = json.load(f)

with open(f"{BASE}/scripts/enriched-songs.json", encoding="utf-8") as f:
    enriched_songs = json.load(f)

with open(f"{BASE}/scripts/gp-artists-list.json", encoding="utf-8") as f:
    gp_data = json.load(f)

# Also read Excel for completeness
wb = openpyxl.load_workbook(
    "C:/Users/User/Downloads/GuitarForge Library/All_Artists_GuitarProTabs.xlsx",
    data_only=True,
)
ws = wb["Artists"]
excel_artists = set()
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[0]:
        excel_artists.add(row[0].strip().lower())

# Build GP artist set from both sources
gp_artists = set()
for a in gp_data["artists"]:
    gp_artists.add(a["clean_name"].strip().lower())
gp_artists.update(excel_artists)
print(f"GP artists: {len(gp_artists)}")

# Build lookup from raw spotify data: (title_lower, artist_lower) -> {popularity, durationMs}
raw_lookup = {}
for s in raw_songs:
    key = (s["title"].strip().lower(), s["artist"].strip().lower())
    raw_lookup[key] = {"popularity": s.get("popularity"), "durationMs": s.get("durationMs")}

# Build lookup from enriched data: (title_lower, artist_lower) -> extra fields
enriched_lookup = {}
for s in enriched_songs:
    key = (s["title"].strip().lower(), s["artist"].strip().lower())
    extra = {}
    if s.get("artistCountry"):
        extra["artistCountry"] = s["artistCountry"]
    if s.get("artistTags"):
        extra["artistTags"] = s["artistTags"]
    if s.get("ytTutorial"):
        extra["ytTutorial"] = s["ytTutorial"]
    enriched_lookup[key] = extra

# Now read the current spotify-songs.ts and parse the song objects
with open(f"{BASE}/src/lib/spotify-songs.ts", encoding="utf-8") as f:
    content = f.read()

# Parse each song object from the TS file
# Pattern: { id: ..., title: "...", artist: "...", ... }
song_pattern = re.compile(r'\{[^}]+\}', re.DOTALL)
songs_raw = song_pattern.findall(content)

# Parse individual fields from each song string
def parse_song(s):
    """Extract fields from a JS object literal string."""
    fields = {}
    # id
    m = re.search(r'id:\s*(\d+)', s)
    if m: fields['id'] = int(m.group(1))
    # string fields
    for key in ['title', 'artist', 'album', 'genre', 'difficulty', 'tuning', 'key', 'songsterrUrl', 'gpFileName', 'ytTutorial', 'artistCountry', 'artistTags']:
        m = re.search(rf'{key}:\s*"((?:[^"\\]|\\.)*)"', s)
        if m: fields[key] = m.group(1)
    # numeric fields
    for key in ['year', 'tempo', 'popularity', 'durationMs']:
        m = re.search(rf'{key}:\s*(\d+)', s)
        if m: fields[key] = int(m.group(1))
    # boolean fields
    for key in ['gp']:
        m = re.search(rf'{key}:\s*(true|false)', s)
        if m: fields[key] = m.group(1) == 'true'
    return fields

parsed_songs = []
for s in songs_raw:
    song = parse_song(s)
    if 'id' in song and 'title' in song:
        parsed_songs.append(song)

print(f"Parsed {len(parsed_songs)} songs from spotify-songs.ts")

# Enrich each song
enriched_count = 0
gp_count = 0
for song in parsed_songs:
    key = (song["title"].strip().lower(), song["artist"].strip().lower())

    # Merge raw spotify data (popularity, durationMs)
    if key in raw_lookup:
        raw = raw_lookup[key]
        if raw.get("popularity") is not None and "popularity" not in song:
            song["popularity"] = raw["popularity"]
            enriched_count += 1
        if raw.get("durationMs") is not None and "durationMs" not in song:
            song["durationMs"] = raw["durationMs"]

    # Merge enriched data (artistCountry, artistTags, ytTutorial)
    if key in enriched_lookup:
        for k, v in enriched_lookup[key].items():
            if k not in song:
                song[k] = v

    # Mark GP artists
    artist_lower = song["artist"].strip().lower()
    if artist_lower in gp_artists:
        song["gp"] = True
        gp_count += 1

print(f"Enriched with popularity: {enriched_count}")
print(f"Marked with gp: {gp_count}")

# Generate the new spotify-songs.ts
def js_str(s):
    """Escape a string for JS."""
    return s.replace("\\", "\\\\").replace('"', '\\"')

def song_to_js(song):
    """Convert a song dict to a JS object literal string."""
    parts = []
    parts.append(f'id: {song["id"]}')
    parts.append(f'title: "{js_str(song["title"])}"')
    parts.append(f'artist: "{js_str(song["artist"])}"')
    if "album" in song:
        parts.append(f'album: "{js_str(song["album"])}"')
    if "year" in song:
        parts.append(f'year: {song["year"]}')
    if "genre" in song:
        parts.append(f'genre: "{js_str(song["genre"])}"')
    if "difficulty" in song:
        parts.append(f'difficulty: "{js_str(song["difficulty"])}"')
    if "tuning" in song:
        parts.append(f'tuning: "{js_str(song["tuning"])}"')
    if "tempo" in song:
        parts.append(f'tempo: {song["tempo"]}')
    if "key" in song:
        parts.append(f'key: "{js_str(song["key"])}"')
    if "popularity" in song:
        parts.append(f'popularity: {song["popularity"]}')
    if "durationMs" in song:
        parts.append(f'durationMs: {song["durationMs"]}')
    if "artistCountry" in song:
        parts.append(f'artistCountry: "{js_str(song["artistCountry"])}"')
    if "artistTags" in song:
        parts.append(f'artistTags: "{js_str(song["artistTags"])}"')
    if song.get("gp"):
        parts.append("gp: true")
    if "songsterrUrl" in song:
        parts.append(f'songsterrUrl: "{js_str(song["songsterrUrl"])}"')
    if "gpFileName" in song:
        parts.append(f'gpFileName: "{js_str(song["gpFileName"])}"')
    if "ytTutorial" in song:
        parts.append(f'ytTutorial: "{js_str(song["ytTutorial"])}"')
    return "  { " + ", ".join(parts) + " }"

lines = []
lines.append(f"// Auto-generated from Spotify API data — enriched with metadata")
lines.append(f"// {len(parsed_songs)} songs across 17 genres")
lines.append("// IDs start at 100 (1-99 reserved for manual entries)")
lines.append(f"// Enrichment: popularity, durationMs, artistCountry, artistTags, ytTutorial, gp (Guitar Pro)")
lines.append("")
lines.append("export const SPOTIFY_SONGS = [")
for song in parsed_songs:
    lines.append(song_to_js(song) + ",")
lines.append("];")
lines.append("")

output = "\n".join(lines)
with open(f"{BASE}/src/lib/spotify-songs.ts", "w", encoding="utf-8") as f:
    f.write(output)

print(f"\nWrote {len(parsed_songs)} songs to spotify-songs.ts")
print("Done!")
