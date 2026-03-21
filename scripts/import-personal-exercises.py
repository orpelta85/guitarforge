#!/usr/bin/env python3
# Import personal GP exercise files into GuitarForge exercises.ts

import os
import re
import requests

EXERCISES_DIR = "C:\\Users\\User\\Downloads\\GuitarForge Library\\Exercises"
EXERCISES_FILE = "C:\\Users\\User\\guitarforge\\src\\lib\\exercises.ts"

SUPABASE_URL = "https://rmwaezujumikbukbirpt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtd2FlenVqdW1pa2J1a2JpcnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTE5MjksImV4cCI6MjA4OTYyNzkyOX0.FGusD1oWUS5e8zAPSB5-wm0cJg6yOCDK2ekdOGvw8Iw"
BUCKET = "gp-tabs"


def upload_to_supabase(filepath, storage_path):
    """Upload a file to Supabase Storage."""
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/octet-stream",
    }
    with open(filepath, 'rb') as f:
        data = f.read()
    resp = requests.post(url, headers=headers, data=data)
    if resp.status_code == 400 and "already exists" in resp.text.lower():
        resp = requests.put(url, headers=headers, data=data)
    return resp.status_code in (200, 201)


def categorize_exercise(filename):
    """Determine category and details from exercise filename."""
    name_lower = filename.lower()

    # Category detection
    if any(w in name_lower for w in ['pentatonic', 'penta']):
        category = "Scales"
        focus = "Pentatonic Scale"
    elif any(w in name_lower for w in ['chromatic']):
        category = "Warm-Up"
        focus = "Chromatic Exercise"
    elif any(w in name_lower for w in ['legato', 'pull of', 'pull off', 'hammer']):
        category = "Legato"
        focus = "Legato Technique"
    elif any(w in name_lower for w in ['tapping', 'tap']):
        category = "Tapping"
        focus = "Tapping Technique"
    elif any(w in name_lower for w in ['blues']):
        category = "Blues"
        focus = "Blues Playing"
    elif any(w in name_lower for w in ['triad']):
        category = "Chords"
        focus = "Triad Shapes"
    elif any(w in name_lower for w in ['chord', 'strum']):
        category = "Chords"
        focus = "Chord Practice"
    elif any(w in name_lower for w in ['shred', 'lick', 'rock lick']):
        category = "Shred"
        focus = "Speed Building"
    elif any(w in name_lower for w in ['seq', 'sequence']):
        category = "Scales"
        focus = "Scale Sequences"
    elif any(w in name_lower for w in ['mode', 'dorian', 'ionian', 'lydian', 'mixolydian', 'phrigg', 'aeolian', 'locrian']):
        category = "Scales"
        focus = "Modal Playing"
    elif any(w in name_lower for w in ['triplet', 'sixteenth', 'rhythm']):
        category = "Rhythm"
        focus = "Rhythm Precision"
    elif any(w in name_lower for w in ['synchron', 'symetr', 'asymetr']):
        category = "Warm-Up"
        focus = "Synchronization"
    elif any(w in name_lower for w in ['scale', 'major', 'minor']):
        category = "Scales"
        focus = "Scale Practice"
    elif any(w in name_lower for w in ['dim', 'diminish']):
        category = "Arpeggios"
        focus = "Diminished Patterns"
    elif any(w in name_lower for w in ['riff', 'metal riff', 'palm mute', 'palm muting']):
        category = "Rhythm"
        focus = "Riff Playing"
    elif 'lesson' in name_lower:
        category = "Songs"
        focus = "Lesson Material"
    elif any(w in name_lower for w in ['funky', 'funk']):
        category = "Rhythm"
        focus = "Funk Guitar"
    elif 'mobius' in name_lower or 'spinning' in name_lower:
        category = "Shred"
        focus = "Alternate Picking"
    else:
        category = "Warm-Up"
        focus = "General Practice"

    return category, focus


def clean_exercise_name(filename):
    """Create a clean exercise name from filename."""
    name = re.sub(r'\.(gp\d?|gpx)$', '', filename, flags=re.IGNORECASE)
    # Clean up common patterns
    name = re.sub(r'\s*\(\d+\)\s*', ' ', name)
    name = name.strip(' -_.')
    return name


def escape_ts_string(s):
    """Escape string for TypeScript."""
    return s.replace('\\', '\\\\').replace('"', '\\"').replace("'", "\\'").replace('\n', '\\n').replace('`', '\\`')


def get_max_exercise_id():
    """Get max exercise ID."""
    max_id = 0
    with open(EXERCISES_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            match = re.search(r'id:\s*(\d+)', line)
            if match:
                max_id = max(max_id, int(match.group(1)))
    return max_id


def main():
    files = sorted(os.listdir(EXERCISES_DIR))
    gp_files = [f for f in files if re.search(r'\.(gp\d?|gpx)$', f, re.IGNORECASE)]

    print(f"Found {len(gp_files)} GP files in Exercises directory")

    max_id = get_max_exercise_id()
    next_id = max_id + 1

    new_exercises = []
    uploaded = 0

    for filename in gp_files:
        name = clean_exercise_name(filename)
        category, focus = categorize_exercise(filename)
        storage_path = f"personal/exercises/{filename}"
        gp_path = f"personal/exercises/{filename}"

        # Upload to Supabase
        filepath = os.path.join(EXERCISES_DIR, filename)
        success = upload_to_supabase(filepath, storage_path)
        if success:
            uploaded += 1
            print(f"  UPLOADED: [{category}] {name}")
        else:
            print(f"  UPLOAD FAILED: [{category}] {name}")

        # Determine BPM range based on category
        bpm_map = {
            "Warm-Up": "60-100",
            "Shred": "80-160",
            "Legato": "70-120",
            "Tapping": "60-100",
            "Blues": "60-100",
            "Chords": "60-90",
            "Scales": "60-120",
            "Rhythm": "80-140",
            "Arpeggios": "60-120",
            "Songs": "",
        }
        bpm = bpm_map.get(category, "60-100")

        exercise = {
            'id': next_id,
            'c': category,
            'n': name,
            'm': 10,
            'b': bpm,
            'd': f"Personal exercise from guitar teacher. Practice with GP tab file.",
            'yt': f"{name} guitar exercise",
            't': "Follow the GP tab. Start slow and build speed gradually.",
            'f': focus,
            'bt': False,
            'gpPath': gp_path,
        }
        new_exercises.append(exercise)
        next_id += 1

    if not new_exercises:
        print("No exercise files found.")
        return

    # Generate TypeScript entries
    ts_lines = []
    for e in new_exercises:
        parts = [
            f'id: {e["id"]}',
            f'c: "{escape_ts_string(e["c"])}"',
            f'n: "{escape_ts_string(e["n"])}"',
            f'm: {e["m"]}',
            f'b: "{escape_ts_string(e["b"])}"',
            f'd: "{escape_ts_string(e["d"])}"',
            f'yt: "{escape_ts_string(e["yt"])}"',
            f't: "{escape_ts_string(e["t"])}"',
            f'f: "{escape_ts_string(e["f"])}"',
            f'bt: false',
        ]
        ts_lines.append('  { ' + ', '.join(parts) + ' }')

    # Read existing file
    with open(EXERCISES_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the last ]; and insert before it
    insert_pos = content.rfind('];')
    if insert_pos == -1:
        print("ERROR: Could not find closing ]; in exercises.ts")
        return

    new_content = content[:insert_pos].rstrip()
    if not new_content.endswith(','):
        new_content += ','
    new_content += '\n  /* ── PERSONAL EXERCISES (from guitar teacher) ── */\n'
    for line in ts_lines:
        new_content += line + ',\n'
    new_content += '];\n'

    with open(EXERCISES_FILE, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"\nDone! Added {len(new_exercises)} personal exercises to exercises.ts")
    print(f"Uploaded {uploaded} files to Supabase Storage")
    print(f"ID range: {new_exercises[0]['id']} - {new_exercises[-1]['id']}")


if __name__ == "__main__":
    main()
