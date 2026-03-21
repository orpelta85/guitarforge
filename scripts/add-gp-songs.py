#!/usr/bin/env python3
"""
Scan GP files, find new songs not in the library, append them to spotify-songs.ts.
"""

import os
import re
import json
import base64
import urllib.request
import urllib.parse
from pathlib import Path

GP_DIR = Path(r"C:\Users\User\Downloads\GuitarForge Library\Songs GP")
SONGS_FILE = Path(r"C:\Users\User\guitarforge\src\lib\spotify-songs.ts")
ENV_FILE = Path(r"C:\Users\User\guitarforge\.env.local")

# Spotify API
SPOTIFY_TOKEN = None

def get_spotify_token():
    global SPOTIFY_TOKEN
    if SPOTIFY_TOKEN:
        return SPOTIFY_TOKEN
    try:
        env = ENV_FILE.read_text()
        client_id = re.search(r'SPOTIFY_CLIENT_ID=(.+)', env).group(1).strip()
        client_secret = re.search(r'SPOTIFY_CLIENT_SECRET=(.+)', env).group(1).strip()
        creds = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        req = urllib.request.Request(
            "https://accounts.spotify.com/api/token",
            data=b"grant_type=client_credentials",
            headers={"Authorization": f"Basic {creds}", "Content-Type": "application/x-www-form-urlencoded"}
        )
        resp = json.loads(urllib.request.urlopen(req).read())
        SPOTIFY_TOKEN = resp["access_token"]
        return SPOTIFY_TOKEN
    except Exception as e:
        print(f"  [Spotify] Auth failed: {e}")
        return None


def search_spotify(artist, title):
    """Search Spotify for a song and return metadata."""
    token = get_spotify_token()
    if not token:
        return {}
    try:
        q = urllib.parse.quote(f"track:{title} artist:{artist}")
        req = urllib.request.Request(
            f"https://api.spotify.com/v1/search?q={q}&type=track&limit=1",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = json.loads(urllib.request.urlopen(req).read())
        tracks = data.get("tracks", {}).get("items", [])
        if not tracks:
            return {}
        t = tracks[0]
        result = {
            "popularity": t.get("popularity", 0),
            "durationMs": t.get("duration_ms", 0),
        }
        # Get audio features for key/tempo
        track_id = t["id"]
        try:
            req2 = urllib.request.Request(
                f"https://api.spotify.com/v1/audio-features/{track_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            features = json.loads(urllib.request.urlopen(req2).read())
            if features:
                keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
                key_idx = features.get("key", -1)
                mode = features.get("mode", 0)  # 0=minor, 1=major
                if 0 <= key_idx < 12:
                    result["key"] = keys[key_idx] + ("m" if mode == 0 else "")
                tempo = features.get("tempo")
                if tempo:
                    result["tempo"] = round(tempo)
        except:
            pass
        return result
    except Exception as e:
        return {}

# Artist -> genre mapping
ARTIST_GENRE = {
    "a perfect circle": "Alternative Metal",
    "acdc": "Hard Rock",
    "afi": "Punk Rock",
    "ace of base": "Pop",
    "adele": "Pop",
    "aerosmith": "Hard Rock",
    "alice cooper": "Hard Rock",
    "alice in chains": "Grunge",
    "alien ant farm": "Alternative Rock",
    "alphaville": "Synth Pop",
    "american hi fi": "Pop Punk",
    "amon amarth": "Melodic Death Metal",
    "andy mckee": "Acoustic",
    "angra": "Power Metal",
    "anouk": "Rock",
    "anthrax": "Thrash Metal",
    "arch enemy": "Melodic Death Metal",
    "arctic monkeys": "Indie Rock",
    "at the gates": "Melodic Death Metal",
    "audioslave": "Alternative Rock",
    "avenged sevenfold": "Heavy Metal",
    "bbking": "Blues",
    "bad religion": "Punk Rock",
    "beach boys": "Classic Rock",
    "beastie boys": "Hip Hop",
    "beatles": "Classic Rock",
    "behemoth": "Death Metal",
    "ben harper": "Blues Rock",
    "black crowes": "Blues Rock",
    "black sabbath": "Heavy Metal",
    "blackberries": "Rock",
    "blind guardian": "Power Metal",
    "blink 182": "Pop Punk",
    "bloodhound gang": "Alternative Rock",
    "blur": "Britpop",
    "bon jovi": "Hard Rock",
    "boston": "Classic Rock",
    "bryan adams": "Rock",
    "buckethead": "Experimental",
    "buddy guy": "Blues",
    "bullet for my valentine": "Metalcore",
    "cannibal corpse": "Death Metal",
    "cash, johnny": "Country",
    "johnny cash": "Country",
    "cat stevens": "Folk",
    "stevens, cat": "Folk",
    "chapman, tracy": "Folk",
    "tracy chapman": "Folk",
    "chet atkins": "Country",
    "chic, the": "Funk",
    "children of bodom": "Melodic Death Metal",
    "chuck berry": "Classic Rock",
    "clapton, eric": "Blues Rock",
    "eric clapton": "Blues Rock",
    "coldplay": "Alternative Rock",
    "cradle of filth": "Black Metal",
    "crazy town": "Rap Rock",
    "creed": "Post-Grunge",
    "crow, sheryl": "Rock",
    "sheryl crow": "Rock",
    "cypress hill": "Hip Hop",
    "daft punk": "Electronic",
    "dark tranquillity": "Melodic Death Metal",
    "dave matthews": "Alternative Rock",
    "david bowie": "Classic Rock",
    "de lucia, paco": "Flamenco",
    "paco de lucia": "Flamenco",
    "dead kennedys": "Punk Rock",
    "death": "Death Metal",
    "deep purple": "Hard Rock",
    "def leppard": "Hard Rock",
    "deftones": "Alternative Metal",
    "dimmu borgir": "Black Metal",
    "dio, ronnie james": "Heavy Metal",
    "ronnie james dio": "Heavy Metal",
    "dire straits": "Classic Rock",
    "disturbed": "Heavy Metal",
    "doctor caspers rabbit show": "Rock",
    "down": "Sludge Metal",
    "dragonforce": "Power Metal",
    "drake, nick": "Folk",
    "nick drake": "Folk",
    "dream theater": "Progressive Metal",
    "drowning pool": "Heavy Metal",
    "dylan, bob": "Folk Rock",
    "bob dylan": "Folk Rock",
    "ed sheeran": "Pop",
    "eminem": "Hip Hop",
    "emmanuel, tommy": "Acoustic",
    "tommy emmanuel": "Acoustic",
    "enigma": "Electronic",
    "eric johnson": "Blues Rock",
    "johnson, eric": "Blues Rock",
    "europe": "Hard Rock",
    "extreme": "Hard Rock",
    "faith no more": "Alternative Metal",
    "fleetwood mac": "Classic Rock",
    "foo fighters": "Alternative Rock",
    "friedman, marty": "Heavy Metal",
    "marty friedman": "Heavy Metal",
    "gallagher, rory": "Blues Rock",
    "rory gallagher": "Blues Rock",
    "gamma ray": "Power Metal",
    "genesis": "Progressive Rock",
    "gilbert, paul": "Hard Rock",
    "paul gilbert": "Hard Rock",
    "gipsy kings": "Flamenco",
    "goldfinger": "Punk Rock",
    "goldman, jean": "Pop",
    "good charlotte": "Pop Punk",
    "gorillaz": "Alternative Rock",
    "grateful dead": "Classic Rock",
    "green day": "Punk Rock",
    "guns n roses": "Hard Rock",
    "guy, buddy": "Blues",
    "harisson, george": "Classic Rock",
    "george harrison": "Classic Rock",
    "heart": "Hard Rock",
    "helloween": "Power Metal",
    "hoobastank": "Post-Grunge",
    "hooker, john lee": "Blues",
    "john lee hooker": "Blues",
    "idol, billy": "Hard Rock",
    "billy idol": "Hard Rock",
    "iggy pop": "Punk Rock",
    "in flames": "Melodic Death Metal",
    "incubus": "Alternative Rock",
    "iron maiden": "Heavy Metal",
    "jackson, michael": "Pop",
    "michael jackson": "Pop",
    "jamiroquai": "Funk",
    "janes addiction": "Alternative Rock",
    "jason mraz": "Pop",
    "jeff buckley": "Alternative Rock",
    "jerry cantrell": "Grunge",
    "jethro tull": "Progressive Rock",
    "jett, joan": "Hard Rock",
    "joan jett": "Hard Rock",
    "jimmy eat world": "Alternative Rock",
    "john mayer": "Blues Rock",
    "mayer, john": "Blues Rock",
    "john, elton": "Classic Rock",
    "elton john": "Classic Rock",
    "johnson, jack": "Acoustic",
    "jack johnson": "Acoustic",
    "joplin, janis": "Blues Rock",
    "janis joplin": "Blues Rock",
    "journey": "Classic Rock",
    "judas priest": "Heavy Metal",
    "kansas": "Progressive Rock",
    "kid rock": "Rock",
    "killers": "Alternative Rock",
    "the killers": "Alternative Rock",
    "killswitch engage": "Metalcore",
    "kings of leon": "Alternative Rock",
    "kiss": "Hard Rock",
    "korn": "Nu Metal",
    "kravitz, lenny": "Rock",
    "lenny kravitz": "Rock",
    "kreator": "Thrash Metal",
    "kyuss": "Stoner Rock",
    "lady gaga": "Pop",
    "lagwagon": "Punk Rock",
    "lamb of god": "Groove Metal",
    "lavigne, avril": "Pop Punk",
    "avril lavigne": "Pop Punk",
    "led zeppelin": "Hard Rock",
    "lennon, john": "Classic Rock",
    "john lennon": "Classic Rock",
    "limp bizkit": "Nu Metal",
    "linkin park": "Nu Metal",
    "living colour": "Hard Rock",
    "lynyrd skynyrd": "Southern Rock",
    "machine head": "Groove Metal",
    "malmsteen, yngwie": "Neoclassical Metal",
    "yngwie malmsteen": "Neoclassical Metal",
    "marilyn manson": "Industrial Metal",
    "maroon 5": "Pop Rock",
    "mccartney, paul": "Classic Rock",
    "paul mccartney": "Classic Rock",
    "mclaughlin, john": "Jazz Fusion",
    "john mclaughlin": "Jazz Fusion",
    "megadeth": "Thrash Metal",
    "meola, al di": "Jazz Fusion",
    "al di meola": "Jazz Fusion",
    "meshuggah": "Progressive Metal",
    "metallica": "Metal",
    "metheny, p": "Jazz",
    "pat metheny": "Jazz",
    "millencolin": "Punk Rock",
    "misfits": "Punk Rock",
    "montgomery, wes": "Jazz",
    "wes montgomery": "Jazz",
    "moore, gary": "Blues Rock",
    "gary moore": "Blues Rock",
    "morbid angel": "Death Metal",
    "morissette, alanis": "Alternative Rock",
    "alanis morissette": "Alternative Rock",
    "motley crue": "Hard Rock",
    "motorhead": "Heavy Metal",
    "muse": "Alternative Rock",
    "mxpx": "Punk Rock",
    "nofx": "Punk Rock",
    "neil young": "Classic Rock",
    "young, neil": "Classic Rock",
    "new found glory": "Pop Punk",
    "nickelback": "Post-Grunge",
    "nightwish": "Symphonic Metal",
    "nine inch nails": "Industrial",
    "nirvana": "Grunge",
    "no doubt": "Ska Punk",
    "no use for a name": "Punk Rock",
    "oasis": "Britpop",
    "offspring": "Punk Rock",
    "opeth": "Progressive Metal",
    "osbourne, ozzy": "Heavy Metal",
    "ozzy osbourne": "Heavy Metal",
    "pantera": "Groove Metal",
    "papa roach": "Nu Metal",
    "paramore": "Pop Rock",
    "pass, joe": "Jazz",
    "joe pass": "Jazz",
    "pearl jam": "Grunge",
    "pennywise": "Punk Rock",
    "perfect": "Rock",
    "pink floyd": "Progressive Rock",
    "pixies": "Alternative Rock",
    "poison": "Hard Rock",
    "presidents of the united states of america": "Alternative Rock",
    "primus": "Alternative Rock",
    "prince": "Pop Rock",
    "puddle of mudd": "Post-Grunge",
    "queen": "Classic Rock",
    "queens of the stone age": "Stoner Rock",
    "r.e.m.": "Alternative Rock",
    "radiohead": "Alternative Rock",
    "rage against the machine": "Rap Metal",
    "rainbow": "Hard Rock",
    "rammstein": "Industrial Metal",
    "ramones": "Punk Rock",
    "the ramones": "Punk Rock",
    "rancid": "Punk Rock",
    "red hot chili peppers": "Alternative Rock",
    "reel big fish": "Ska Punk",
    "reinhardt, django": "Jazz",
    "django reinhardt": "Jazz",
    "renbourn, john": "Folk",
    "john renbourn": "Folk",
    "rise against": "Punk Rock",
    "rush": "Progressive Rock",
    "santana": "Blues Rock",
    "santana, carlos": "Blues Rock",
    "carlos santana": "Blues Rock",
    "satriani, joe": "Hard Rock",
    "joe satriani": "Hard Rock",
    "the satriani, joe": "Hard Rock",
    "scorpions": "Hard Rock",
    "sepultura": "Thrash Metal",
    "sex pistols": "Punk Rock",
    "silverchair": "Alternative Rock",
    "simon, paul": "Folk Rock",
    "paul simon": "Folk Rock",
    "skid row": "Hard Rock",
    "slayer": "Thrash Metal",
    "slipknot": "Nu Metal",
    "smashing pumpkins": "Alternative Rock",
    "sonic magnum": "Rock",
    "soundgarden": "Grunge",
    "springsteen, bruce": "Classic Rock",
    "bruce springsteen": "Classic Rock",
    "staind": "Post-Grunge",
    "steve vai": "Hard Rock",
    "vai, steve": "Hard Rock",
    "stone temple pilots": "Grunge",
    "sublime": "Ska Punk",
    "sum 41": "Pop Punk",
    "symphony x": "Progressive Metal",
    "system of a down": "Alternative Metal",
    "taylor swift": "Pop",
    "taylor, james": "Folk Rock",
    "james taylor": "Folk Rock",
    "temple of the dog": "Grunge",
    "tenacious d": "Comedy Rock",
    "testament": "Thrash Metal",
    "the clash": "Punk Rock",
    "the cure": "Post-Punk",
    "the doors": "Classic Rock",
    "the eagles": "Classic Rock",
    "the hives": "Garage Rock",
    "the james brown band": "Funk",
    "the jews": "Rock",
    "the kinks": "Classic Rock",
    "the police": "New Wave",
    "the prodigy": "Electronic",
    "the rolling stones": "Classic Rock",
    "the smiths": "Indie Rock",
    "the strokes": "Indie Rock",
    "the verve": "Britpop",
    "the vines": "Garage Rock",
    "the who": "Classic Rock",
    "thin lizzy": "Hard Rock",
    "tool": "Progressive Metal",
    "toto": "Classic Rock",
    "townsend, devin": "Progressive Metal",
    "devin townsend": "Progressive Metal",
    "u2": "Rock",
    "ugly kid joe": "Hard Rock",
    "van halen": "Hard Rock",
    "vaughan, stevie ray": "Blues",
    "stevie ray vaughan": "Blues",
    "vicente, amigo": "Flamenco",
    "waters, muddy": "Blues",
    "muddy waters": "Blues",
    "weezer": "Alternative Rock",
    "wheatus": "Pop Rock",
    "whitesnake": "Hard Rock",
    "wonder, stevie": "Soul",
    "stevie wonder": "Soul",
    "zakk wylde & black label society": "Heavy Metal",
    "zappa, franck": "Experimental",
    "frank zappa": "Experimental",
    "zz top": "Blues Rock",
}

# Genre -> difficulty mapping
GENRE_DIFFICULTY = {
    "Thrash Metal": "Advanced",
    "Death Metal": "Advanced",
    "Melodic Death Metal": "Advanced",
    "Black Metal": "Advanced",
    "Progressive Metal": "Advanced",
    "Neoclassical Metal": "Advanced",
    "Power Metal": "Advanced",
    "Jazz Fusion": "Advanced",
    "Jazz": "Advanced",
    "Flamenco": "Advanced",
    "Experimental": "Advanced",
    "Symphonic Metal": "Advanced",
    "Heavy Metal": "Intermediate",
    "Hard Rock": "Intermediate",
    "Alternative Metal": "Intermediate",
    "Groove Metal": "Intermediate",
    "Industrial Metal": "Intermediate",
    "Nu Metal": "Intermediate",
    "Metalcore": "Intermediate",
    "Stoner Rock": "Intermediate",
    "Sludge Metal": "Intermediate",
    "Rap Metal": "Intermediate",
    "Metal": "Intermediate",
    "Classic Rock": "Intermediate",
    "Blues Rock": "Intermediate",
    "Blues": "Intermediate",
    "Progressive Rock": "Intermediate",
    "Alternative Rock": "Intermediate",
    "Grunge": "Intermediate",
    "Southern Rock": "Intermediate",
    "Industrial": "Intermediate",
    "Post-Grunge": "Intermediate",
    "Punk Rock": "Beginner",
    "Pop Punk": "Beginner",
    "Ska Punk": "Beginner",
    "Pop": "Beginner",
    "Pop Rock": "Beginner",
    "Folk": "Beginner",
    "Folk Rock": "Beginner",
    "Acoustic": "Intermediate",
    "Country": "Beginner",
    "Rock": "Intermediate",
    "Britpop": "Intermediate",
    "Indie Rock": "Intermediate",
    "New Wave": "Intermediate",
    "Post-Punk": "Intermediate",
    "Garage Rock": "Intermediate",
    "Synth Pop": "Beginner",
    "Electronic": "Beginner",
    "Hip Hop": "Beginner",
    "Funk": "Intermediate",
    "Soul": "Intermediate",
    "Comedy Rock": "Beginner",
    "Rap Rock": "Intermediate",
}


def normalize_artist(name: str) -> str:
    """Normalize artist name for comparison."""
    n = name.lower().strip()
    # Remove "the " prefix
    if n.startswith("the "):
        n = n[4:]
    # Handle "Last, First" -> "first last"
    if ", " in n:
        parts = n.split(", ", 1)
        n = f"{parts[1]} {parts[0]}"
    # Insert space before uppercase runs in camelCase (BBKing -> BB King)
    n = re.sub(r'([a-z])([A-Z])', r'\1 \2', n)
    # Remove ALL special chars AND spaces for comparison (so "b.b. king" == "bb king" == "bbking")
    n = re.sub(r'[^a-z0-9]', '', n)
    return n


def clean_song_title(filename: str) -> str:
    """Clean up GP filename to song title."""
    # Remove extension
    name = os.path.splitext(filename)[0]
    # Remove version suffixes like V1, V2, etc.
    name = re.sub(r'\s+V\d+$', '', name)
    # Remove "Live" suffix
    name = re.sub(r'\s+Live$', '', name)
    # Remove "Other Version" suffix
    name = re.sub(r'\s+Other Version$', '', name)
    # Remove trailing version indicators
    name = re.sub(r'\s+\(.*?\)$', '', name)
    # Replace underscores
    name = name.replace('_', ' ')
    # Clean up whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def normalize_title(title: str) -> str:
    """Normalize title for comparison."""
    t = title.lower().strip()
    # Remove ALL non-alphanumeric (including spaces) for robust matching
    t = re.sub(r'[^a-z0-9]', '', t)
    return t


def extract_existing_songs(content: str) -> set:
    """Extract all existing (normalized_artist, normalized_title) pairs from the TS file."""
    pairs = set()
    # Match title and artist fields
    for match in re.finditer(r'title:\s*"([^"]*)".*?artist:\s*"([^"]*)"', content):
        title = match.group(1)
        artist = match.group(2)
        pairs.add((normalize_artist(artist), normalize_title(title)))
    return pairs


def get_gp_songs(gp_dir: Path) -> list:
    """Scan GP directory and return unique (artist_folder, clean_title) pairs."""
    songs = {}  # (norm_artist, norm_title) -> (artist_folder, clean_title)

    for artist_folder in sorted(gp_dir.iterdir()):
        if not artist_folder.is_dir():
            continue
        artist_name = artist_folder.name

        seen_titles = set()
        for gp_file in sorted(artist_folder.iterdir()):
            if not gp_file.is_file():
                continue
            ext = gp_file.suffix.lower()
            if ext not in ('.gp3', '.gp4', '.gp5', '.gpx', '.gp'):
                continue

            clean_title = clean_song_title(gp_file.name)
            norm_title = normalize_title(clean_title)

            if norm_title in seen_titles:
                continue
            seen_titles.add(norm_title)

            norm_artist = normalize_artist(artist_name)
            key = (norm_artist, norm_title)

            if key not in songs:
                songs[key] = (artist_name, clean_title)

    return list(songs.values())


def format_artist_name(folder_name: str) -> str:
    """Format artist folder name for display."""
    name = folder_name
    # Handle "Last, First" format
    if ", " in name:
        parts = name.split(", ", 1)
        name = f"{parts[1]} {parts[0]}"
    # Fix ACDC -> AC/DC
    if name == "ACDC":
        name = "AC/DC"
    if name == "BBKing":
        name = "B.B. King"
    return name


def main():
    # Read existing songs from both files
    songs_content = SONGS_FILE.read_text(encoding='utf-8')

    # Also read songs-data.ts for manual songs
    songs_data_file = SONGS_FILE.parent / 'songs-data.ts'
    songs_data_content = songs_data_file.read_text(encoding='utf-8')

    existing = extract_existing_songs(songs_content)
    existing |= extract_existing_songs(songs_data_content)

    print(f"Existing songs in library: {len(existing)}")

    # Scan GP files
    gp_songs = get_gp_songs(GP_DIR)
    print(f"Unique songs from GP files: {len(gp_songs)}")

    # Find new songs
    new_songs = []
    for artist_folder, clean_title in gp_songs:
        norm_artist = normalize_artist(artist_folder)
        norm_title = normalize_title(clean_title)
        if (norm_artist, norm_title) not in existing:
            new_songs.append((artist_folder, clean_title))

    print(f"New songs to add: {len(new_songs)}")

    if not new_songs:
        print("No new songs to add!")
        return

    # Find max ID
    max_id = 0
    for m in re.finditer(r'id:\s*(\d+)', songs_content):
        max_id = max(max_id, int(m.group(1)))
    for m in re.finditer(r'id:\s*(\d+)', songs_data_content):
        max_id = max(max_id, int(m.group(1)))

    print(f"Max existing ID: {max_id}")
    next_id = max_id + 1

    # Generate entries with Spotify enrichment
    entries = []
    spotify_ok = 0
    for idx, (artist_folder, clean_title) in enumerate(sorted(new_songs, key=lambda x: (x[0].lower(), x[1].lower()))):
        display_artist = format_artist_name(artist_folder)
        norm_artist = normalize_artist(artist_folder)

        genre = ARTIST_GENRE.get(norm_artist, ARTIST_GENRE.get(artist_folder.lower(), "Rock"))
        difficulty = GENRE_DIFFICULTY.get(genre, "Intermediate")

        # Search Spotify for metadata
        sp = search_spotify(display_artist, clean_title)
        if sp.get("popularity"):
            spotify_ok += 1

        # Escape quotes in title
        safe_title = clean_title.replace('"', '\\"')
        safe_artist = display_artist.replace('"', '\\"')

        # Build entry with optional Spotify fields
        parts = [f'id: {next_id}', f'title: "{safe_title}"', f'artist: "{safe_artist}"', f'genre: "{genre}"', f'difficulty: "{difficulty}"', 'gp: true']
        if sp.get("popularity"):
            parts.append(f'popularity: {sp["popularity"]}')
        if sp.get("durationMs"):
            parts.append(f'durationMs: {sp["durationMs"]}')
        if sp.get("key"):
            parts.append(f'key: "{sp["key"]}"')
        if sp.get("tempo"):
            parts.append(f'tempo: {sp["tempo"]}')

        entry = '  { ' + ', '.join(parts) + ' }'
        entries.append(entry)
        next_id += 1

    print(f"Spotify enriched: {spotify_ok}/{len(entries)} songs")

    # Append to the file - find the closing bracket of the array
    # The file ends with: ...last entry\n];
    insert_point = songs_content.rfind('\n];')
    if insert_point == -1:
        print("ERROR: Could not find end of array in spotify-songs.ts")
        return

    new_content = songs_content[:insert_point] + ',\n' + ',\n'.join(entries) + '\n];'

    # But wait - check if last entry already has trailing comma
    # Look at the line before ];
    before_bracket = songs_content[:insert_point].rstrip()
    if before_bracket.endswith(','):
        new_content = songs_content[:insert_point] + '\n' + ',\n'.join(entries) + '\n];'
    else:
        new_content = songs_content[:insert_point] + ',\n' + ',\n'.join(entries) + '\n];'

    SONGS_FILE.write_text(new_content, encoding='utf-8')
    print(f"Successfully appended {len(entries)} new songs to spotify-songs.ts")
    print(f"ID range: {max_id + 1} to {next_id - 1}")

    # Print some samples
    print("\nSample new songs:")
    for e in entries[:20]:
        print(f"  {e.strip()}")


if __name__ == "__main__":
    main()
