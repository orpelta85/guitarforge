#!/usr/bin/env python3
# Import personal GP song files into GuitarForge.
# Scans personal Songs directory, parses artist/title from filename,
# appends to spotify-songs.ts with personal: true,
# uploads to Supabase Storage (gp-tabs bucket, personal/songs/)

import os
import re
import json
import requests

SONGS_DIR = "C:\\Users\\User\\Downloads\\GuitarForge Library\\Songs"
SPOTIFY_SONGS_FILE = "C:\\Users\\User\\guitarforge\\src\\lib\\spotify-songs.ts"

SUPABASE_URL = "https://rmwaezujumikbukbirpt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtd2FlenVqdW1pa2J1a2JpcnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTE5MjksImV4cCI6MjA4OTYyNzkyOX0.FGusD1oWUS5e8zAPSB5-wm0cJg6yOCDK2ekdOGvw8Iw"
BUCKET = "gp-tabs"

# Known artist patterns from filenames
ARTIST_PATTERNS = {
    "AC DC": "AC/DC",
    "Aerosmith": "Aerosmith",
    "Alanis": "Alanis Morissette",
    "Alice Cooper": "Alice Cooper",
    "Avicii": "Avicii",
    "Beatles": "The Beatles",
    "Black Sabbath": "Black Sabbath",
    "Blondie": "Blondie",
    "Boston": "Boston",
    "Brian Adams": "Bryan Adams",
    "Bryan Adams": "Bryan Adams",
    "Daft Punk": "Daft Punk",
    "David Guetta and Sia": "David Guetta & Sia",
    "David Guetta": "David Guetta",
    "Eric Clapton": "Eric Clapton",
    "Extreme": "Extreme",
    "Faith No More": "Faith No More",
    "Green Day": "Green Day",
    "Greenday": "Green Day",
    "Guns  and Roses": "Guns N' Roses",
    "Guns and Roses": "Guns N' Roses",
    "Guns N_ Roses": "Guns N' Roses",
    "Guns": "Guns N' Roses",
    "HaYehudim": "HaYehudim",
    "Johnny Cash": "Johnny Cash",
    "Judas Priest": "Judas Priest",
    "King Crimson": "King Crimson",
    "Lynyrd Skynyrd": "Lynyrd Skynyrd",
    "Mashina": "Mashina",
    "Metallica": "Metallica",
    "Muse": "Muse",
    "Pearl Jam": "Pearl Jam",
    "Pink Floyd": "Pink Floyd",
    "Poison": "Poison",
    "Prince": "Prince",
    "Rage Against The Machine": "Rage Against The Machine",
    "Scorpions": "Scorpions",
    "Soundgarden": "Soundgarden",
    "T-Bone Walker": "T-Bone Walker",
    "The Offspring": "The Offspring",
    "alice_in_chains": "Alice in Chains",
    "audioslave": "Audioslave",
    "green_day": "Green Day",
    "nirvana": "Nirvana",
    "prince": "Prince",
    "zz_top": "ZZ Top",
    "4  non Blondes": "4 Non Blondes",
    "Nuno Bettencourt": "Extreme",
}

# Genre mapping by artist
ARTIST_GENRES = {
    "AC/DC": "Hard Rock",
    "Aerosmith": "Hard Rock",
    "Alanis Morissette": "Alternative Rock",
    "Alice Cooper": "Hard Rock",
    "Alice in Chains": "Grunge",
    "Audioslave": "Alternative Rock",
    "Avicii": "Pop",
    "The Beatles": "Classic Rock",
    "Black Sabbath": "Metal",
    "Blondie": "New Wave",
    "Boston": "Classic Rock",
    "Bryan Adams": "Rock",
    "Daft Punk": "Electronic",
    "David Guetta & Sia": "Pop",
    "Eric Clapton": "Blues Rock",
    "Extreme": "Hard Rock",
    "Faith No More": "Alternative Metal",
    "Green Day": "Punk Rock",
    "Guns N' Roses": "Hard Rock",
    "HaYehudim": "Israeli Rock",
    "Johnny Cash": "Country",
    "Judas Priest": "Metal",
    "King Crimson": "Progressive Rock",
    "Lynyrd Skynyrd": "Southern Rock",
    "Mashina": "Israeli Rock",
    "Metallica": "Metal",
    "Muse": "Alternative Rock",
    "4 Non Blondes": "Alternative Rock",
    "Nirvana": "Grunge",
    "Pearl Jam": "Grunge",
    "Pink Floyd": "Progressive Rock",
    "Poison": "Hard Rock",
    "Prince": "Rock",
    "Rage Against The Machine": "Metal",
    "Scorpions": "Hard Rock",
    "Soundgarden": "Grunge",
    "T-Bone Walker": "Blues",
    "The Offspring": "Punk Rock",
    "ZZ Top": "Blues Rock",
}


def parse_filename(filename):
    """Parse artist and title from GP filename."""
    # Remove extension
    name = re.sub(r'\.(gp\d?|gpx)$', '', filename, flags=re.IGNORECASE)

    # Try "Artist - Title" pattern (with various dash styles)
    # Handle underscore-style filenames first
    if '_' in name and '-' in name:
        # Pattern like "alice_in_chains-would fixed3"
        parts = name.split('-', 1)
        if len(parts) == 2:
            artist_raw = parts[0].strip().replace('_', ' ')
            title_raw = parts[1].strip().replace('_', ' ')
            # Look up artist
            for pattern, canonical in ARTIST_PATTERNS.items():
                if artist_raw.lower() == pattern.lower().replace('_', ' '):
                    return canonical, title_raw
            return artist_raw.title(), title_raw

    # Standard "Artist - Title" pattern
    parts = name.split(' - ', 1)
    if len(parts) == 2:
        artist_raw = parts[0].strip()
        title_raw = parts[1].strip()

        # Look up canonical artist name
        for pattern, canonical in ARTIST_PATTERNS.items():
            if artist_raw == pattern or artist_raw.lower() == pattern.lower():
                return canonical, title_raw

        # Check if it starts with a known artist prefix
        for pattern, canonical in ARTIST_PATTERNS.items():
            if artist_raw.startswith(pattern):
                return canonical, title_raw

        return artist_raw, title_raw

    # No clear artist-title split
    # Check if filename starts with known artist
    for pattern, canonical in sorted(ARTIST_PATTERNS.items(), key=lambda x: -len(x[0])):
        if name.startswith(pattern):
            title = name[len(pattern):].strip(' -_')
            if title:
                return canonical, title

    # Hebrew or unknown - return as personal/unknown
    return "Personal", name


def escape_ts_string(s):
    """Escape string for TypeScript."""
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')


def get_existing_songs():
    """Read existing songs to avoid duplicates."""
    existing = set()
    with open(SPOTIFY_SONGS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    # Extract title+artist combos
    for match in re.finditer(r'title:\s*"([^"]*)".*?artist:\s*"([^"]*)"', content):
        key = f"{match.group(1).lower()}|{match.group(2).lower()}"
        existing.add(key)
    return existing


def get_max_id():
    """Get maximum song ID from spotify-songs.ts."""
    max_id = 0
    with open(SPOTIFY_SONGS_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            match = re.search(r'id:\s*(\d+)', line)
            if match:
                max_id = max(max_id, int(match.group(1)))
    return max_id


def upload_to_supabase(filepath, storage_path):
    """Upload a file to Supabase Storage."""
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}"

    # Determine content type
    ext = os.path.splitext(filepath)[1].lower()
    content_type = "application/octet-stream"

    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "apikey": SUPABASE_KEY,
        "Content-Type": content_type,
    }

    with open(filepath, 'rb') as f:
        data = f.read()

    # Try upload, if exists try update
    resp = requests.post(url, headers=headers, data=data)
    if resp.status_code == 400 and "already exists" in resp.text.lower():
        resp = requests.put(url, headers=headers, data=data)

    return resp.status_code in (200, 201)


def main():
    files = sorted(os.listdir(SONGS_DIR))
    gp_files = [f for f in files if re.search(r'\.(gp\d?|gpx)$', f, re.IGNORECASE)]

    print(f"Found {len(gp_files)} GP files in Songs directory")

    existing = get_existing_songs()
    max_id = get_max_id()
    next_id = max_id + 1

    entries = []
    uploaded = 0
    skipped = 0

    for filename in gp_files:
        artist, title = parse_filename(filename)

        # Clean up title
        title = re.sub(r'\s*\(\d+\)\s*$', '', title)  # Remove (1), (2) suffixes
        title = re.sub(r'_\d+$', '', title)  # Remove _2 suffixes
        title = title.strip()

        # Check for duplicate
        check_key = f"{title.lower()}|{artist.lower()}"
        if check_key in existing:
            print(f"  SKIP (exists): {artist} - {title}")
            skipped += 1
            continue

        # Mark as seen to avoid duplicates within personal files
        existing.add(check_key)

        genre = ARTIST_GENRES.get(artist, "Rock")
        difficulty = "Intermediate"

        storage_path = f"personal/songs/{filename}"
        gp_path = f"personal/songs/{filename}"

        # Upload to Supabase
        filepath = os.path.join(SONGS_DIR, filename)
        success = upload_to_supabase(filepath, storage_path)
        if success:
            uploaded += 1
            print(f"  UPLOADED: {artist} - {title}")
        else:
            print(f"  UPLOAD FAILED (will still add entry): {artist} - {title}")

        entry = {
            'id': next_id,
            'title': title,
            'artist': artist,
            'genre': genre,
            'difficulty': difficulty,
            'gp': True,
            'gpPath': gp_path,
            'personal': True,
        }
        entries.append(entry)
        next_id += 1

    if not entries:
        print(f"\nNo new songs to add. {skipped} were already in the library.")
        return

    # Generate TypeScript entries
    ts_lines = []
    for e in entries:
        parts = [
            f'id: {e["id"]}',
            f'title: "{escape_ts_string(e["title"])}"',
            f'artist: "{escape_ts_string(e["artist"])}"',
            f'genre: "{escape_ts_string(e["genre"])}"',
            f'difficulty: "{e["difficulty"]}"',
            f'gp: true',
            f'gpPath: "{escape_ts_string(e["gpPath"])}"',
            f'personal: true',
        ]
        ts_lines.append('{ ' + ', '.join(parts) + ' }')

    # Append to spotify-songs.ts (before the closing ];)
    with open(SPOTIFY_SONGS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the last ]; and insert before it
    insert_pos = content.rfind('];\n')
    if insert_pos == -1:
        insert_pos = content.rfind('];')

    if insert_pos == -1:
        print("ERROR: Could not find closing ]; in spotify-songs.ts")
        return

    new_content = content[:insert_pos]
    # Add comma after last entry if needed
    last_entry_end = new_content.rstrip()
    if not last_entry_end.endswith(','):
        new_content = last_entry_end + ',\n'
    else:
        new_content = last_entry_end + '\n'

    # Add personal songs section
    new_content += '// ── Personal Songs (from guitar teacher) ──\n'
    for line in ts_lines:
        new_content += line + ',\n'
    new_content += '];\n'

    with open(SPOTIFY_SONGS_FILE, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"\nDone! Added {len(entries)} personal songs (skipped {skipped} duplicates)")
    print(f"Uploaded {uploaded} files to Supabase Storage")
    print(f"ID range: {entries[0]['id']} - {entries[-1]['id']}")


if __name__ == "__main__":
    main()
