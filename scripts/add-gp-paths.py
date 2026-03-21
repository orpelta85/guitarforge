"""
Scan GP files on disk and match them to songs in spotify-songs.ts.
Adds gpPath field to matching entries.

Usage: python scripts/add-gp-paths.py
"""

import os
import re
import sys
from difflib import SequenceMatcher

# Fix console encoding on Windows
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SONGS_GP_DIR = r"C:\Users\User\Downloads\GuitarForge Library\Songs GP"
SPOTIFY_SONGS_FILE = r"C:\Users\User\guitarforge\src\lib\spotify-songs.ts"

GP_EXTENSIONS = {".gp3", ".gp4", ".gp5", ".gpx", ".gp"}

# Filenames to skip (duplicate markers, not real songs)
SKIP_FILENAMES = {"(2)", "(3)", "(4)", "(5)"}


def slugify(name: str) -> str:
    """Create a URL-safe slug from a folder name."""
    s = name.lower()
    s = s.replace("'", "").replace("\u2019", "")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def normalize(text: str) -> str:
    """Normalize text for comparison: lowercase, strip punctuation, collapse whitespace."""
    text = text.lower().strip()
    # Remove common suffixes/noise from song titles
    text = re.sub(r"\s*\(.*?\)\s*", " ", text)  # Remove parenthetical
    text = re.sub(r"\s*-\s*(remaster|deluxe|bonus|remix|reissue|expanded|version|from|edit|radio|digital|anniversary|live|studio|2004|2009|2012|2015|2017|2018).*$", "", text, flags=re.I)
    text = re.sub(r"[''\"`.!?,;:\-\[\]{}()&/\\]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_gp_title(text: str) -> str:
    """Normalize GP filename title, stripping version markers like V1, V2, etc."""
    text = text.lower().strip()
    text = re.sub(r"\s*\(.*?\)\s*", " ", text)  # Remove parenthetical like (2), (3)
    text = re.sub(r"\s+v\d+\s*$", "", text)  # Remove V1, V2 etc at end
    text = re.sub(r"\s+(solo|intro|bassline|acoustic|live|bass|metal version|techno remix|orchestral version|bbc version)\s*$", "", text, flags=re.I)
    text = re.sub(r"[''\"`.!?,;:\-\[\]{}()&/\\]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_gp_index():
    """Scan GP files and build {artist_slug: {normalized_title: [(filename, artist_folder, raw_title)]}}."""
    index = {}  # artist_slug -> {norm_title -> (filename, artist_folder)}
    artist_map = {}  # artist_slug -> artist_folder_name

    for artist_folder in os.listdir(SONGS_GP_DIR):
        artist_path = os.path.join(SONGS_GP_DIR, artist_folder)
        if not os.path.isdir(artist_path):
            continue

        slug = slugify(artist_folder)
        artist_map[slug] = artist_folder

        if slug not in index:
            index[slug] = {}

        for filename in os.listdir(artist_path):
            ext = os.path.splitext(filename)[1].lower()
            if ext not in GP_EXTENSIONS:
                continue

            raw_title = os.path.splitext(filename)[0]

            # Skip files that are just duplicate markers
            if raw_title.strip() in SKIP_FILENAMES:
                continue

            # Skip files with very short names (likely junk)
            if len(raw_title.strip()) <= 2:
                continue

            norm = normalize_gp_title(raw_title)

            # Skip if normalized title is empty or too short
            if len(norm) <= 1:
                continue

            # Keep track of all files, prefer gp5 > gp4 > gp3
            existing = index[slug].get(norm)
            if existing:
                existing_ext = os.path.splitext(existing[0])[1].lower()
                ext_priority = {".gp5": 4, ".gpx": 3, ".gp4": 2, ".gp3": 1, ".gp": 0}
                if ext_priority.get(ext, 0) <= ext_priority.get(existing_ext, 0):
                    continue
            index[slug][norm] = (filename, artist_folder)

    return index, artist_map


def normalize_artist_name(artist: str) -> str:
    """Normalize artist name for matching to folder slugs."""
    mapping = {
        "ac/dc": "acdc",
        "guns n' roses": "guns n roses",
    }
    lower = artist.lower()
    if lower in mapping:
        return mapping[lower]
    return lower


def find_best_match(title_norm: str, gp_titles: dict, threshold=0.82):
    """Find best match for a song title in GP file titles."""
    if not title_norm or len(title_norm) <= 1:
        return None, None, 0

    best_score = 0
    best_match = None

    for gp_norm, (filename, folder) in gp_titles.items():
        if not gp_norm or len(gp_norm) <= 1:
            continue

        # Exact match on normalized titles
        if title_norm == gp_norm:
            return filename, folder, 1.0

        # Check if one contains the other (but only if the contained string is long enough)
        min_len = min(len(title_norm), len(gp_norm))
        max_len = max(len(title_norm), len(gp_norm))

        if min_len >= 4:  # Only do containment check for reasonable-length strings
            if title_norm in gp_norm or gp_norm in title_norm:
                # Score based on length ratio to penalize "In" matching "In My Life"
                ratio = min_len / max_len
                if ratio >= 0.6:
                    score = 0.85 + (ratio * 0.1)  # 0.91 to 0.95
                    if score > best_score:
                        best_score = score
                        best_match = (filename, folder)
                    continue

        # Fuzzy match
        score = SequenceMatcher(None, title_norm, gp_norm).ratio()
        if score > best_score:
            best_score = score
            best_match = (filename, folder)

    # Higher threshold for short titles (more prone to false matches)
    effective_threshold = threshold
    if len(title_norm) <= 4:
        effective_threshold = 0.95  # Nearly exact for very short titles
    elif len(title_norm) <= 7:
        effective_threshold = 0.88  # Stricter for short titles

    if best_score >= effective_threshold and best_match:
        return best_match[0], best_match[1], best_score

    return None, None, 0


def process_songs_file():
    """Read spotify-songs.ts, match songs to GP files, add gpPath."""
    gp_index, artist_map = build_gp_index()

    total_gp_files = sum(len(v) for v in gp_index.values())
    print(f"GP index: {len(gp_index)} artists, {total_gp_files} files")

    with open(SPOTIFY_SONGS_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.split("\n")

    matched = 0
    already_had_gp_path = 0
    no_match = 0
    fuzzy_matches = []
    updated_lines = []

    title_re = re.compile(r'title:\s*"([^"]*)"')
    artist_re = re.compile(r'artist:\s*"([^"]*)"')
    gp_re = re.compile(r'\bgp:\s*true\b')
    gp_path_re = re.compile(r'gpPath:\s*"([^"]*)"')

    for line in lines:
        title_match = title_re.search(line)
        artist_match = artist_re.search(line)

        if not title_match or not artist_match:
            updated_lines.append(line)
            continue

        title = title_match.group(1)
        artist = artist_match.group(1)

        # Already has gpPath?
        if gp_path_re.search(line):
            already_had_gp_path += 1
            updated_lines.append(line)
            continue

        # Try to find GP file
        artist_norm = normalize_artist_name(artist)
        artist_slug = slugify(artist_norm)

        artist_slugs = {artist_slug, slugify(artist)}

        found_filename = None
        found_folder = None
        found_score = 0

        for slug in artist_slugs:
            if slug not in gp_index:
                continue

            gp_titles = gp_index[slug]
            title_norm = normalize(title)
            filename, folder, score = find_best_match(title_norm, gp_titles)

            if filename and score > found_score:
                found_filename = filename
                found_folder = folder
                found_score = score

        if found_filename:
            matched += 1
            storage_path = f"songs/{slugify(found_folder)}/{found_filename}"

            if not gp_re.search(line):
                # Insert gp: true and gpPath before the closing " }," or " }"
                # Find the last closing brace
                line = re.sub(
                    r'\s*\},?\s*$',
                    f', gp: true, gpPath: "{storage_path}"' + ' },',
                    line
                )
            else:
                line = line.replace("gp: true", f'gp: true, gpPath: "{storage_path}"')

            if found_score < 1.0:
                fuzzy_matches.append((found_score, title, found_filename))
        else:
            no_match += 1

        updated_lines.append(line)

    # Write updated file
    with open(SPOTIFY_SONGS_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(updated_lines))

    # Print fuzzy matches sorted by score (worst first) for review
    fuzzy_matches.sort(key=lambda x: x[0])
    print(f"\n--- Fuzzy matches ({len(fuzzy_matches)} total, showing worst 30) ---")
    for score, title, filename in fuzzy_matches[:30]:
        print(f"  {score:.0%}: \"{title}\" -> {filename}")

    print(f"\n--- Results ---")
    print(f"Matched:         {matched}")
    print(f"Already had path: {already_had_gp_path}")
    print(f"No match:        {no_match}")
    print(f"Total lines:     {len(lines)}")


if __name__ == "__main__":
    process_songs_file()
