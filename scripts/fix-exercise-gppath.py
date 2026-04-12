#!/usr/bin/env python3
# Fix exercises.ts to include gpPath for personal exercises

import os
import re

EXERCISES_DIR = "C:\\Users\\User\\Downloads\\GuitarForge Library\\Exercises"
EXERCISES_FILE = "C:\\Users\\User\\guitarforge\\src\\lib\\exercises.ts"

HEBREW_MAP = {
    '\u05D0': 'a', '\u05D1': 'b', '\u05D2': 'g', '\u05D3': 'd', '\u05D4': 'h',
    '\u05D5': 'v', '\u05D6': 'z', '\u05D7': 'ch', '\u05D8': 't', '\u05D9': 'y',
    '\u05DA': 'k', '\u05DB': 'k', '\u05DC': 'l', '\u05DD': 'm', '\u05DE': 'm',
    '\u05DF': 'n', '\u05E0': 'n', '\u05E1': 's', '\u05E2': 'a', '\u05E3': 'p',
    '\u05E4': 'p', '\u05E5': 'ts', '\u05E6': 'ts', '\u05E7': 'q', '\u05E8': 'r',
    '\u05E9': 'sh', '\u05EA': 't',
}

def has_non_ascii(s):
    try:
        s.encode('ascii')
        return False
    except UnicodeEncodeError:
        return True

def sanitize_for_storage(filename):
    if not has_non_ascii(filename):
        return filename
    result = []
    for ch in filename:
        if ch in HEBREW_MAP:
            result.append(HEBREW_MAP[ch])
        elif ord(ch) < 128:
            result.append(ch)
    sanitized = ''.join(result)
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    return sanitized

def escape_ts(s):
    return s.replace('\\', '\\\\').replace('"', '\\"').replace("'", "\\'").replace('\n', '\\n').replace('`', '\\`')

def categorize(filename):
    name_lower = filename.lower()
    if any(w in name_lower for w in ['pentatonic', 'penta']):
        return "Scales", "Pentatonic Scale"
    elif 'chromatic' in name_lower:
        return "Warm-Up", "Chromatic Exercise"
    elif any(w in name_lower for w in ['legato', 'pull of', 'pull off', 'hammer']):
        return "Legato", "Legato Technique"
    elif any(w in name_lower for w in ['tapping', 'tap']):
        return "Tapping", "Tapping Technique"
    elif 'blues' in name_lower:
        return "Blues", "Blues Playing"
    elif 'triad' in name_lower:
        return "Chords", "Triad Shapes"
    elif any(w in name_lower for w in ['chord', 'strum']):
        return "Chords", "Chord Practice"
    elif any(w in name_lower for w in ['shred', 'lick', 'rock lick']):
        return "Shred", "Speed Building"
    elif any(w in name_lower for w in ['seq', 'sequence']):
        return "Scales", "Scale Sequences"
    elif any(w in name_lower for w in ['mode', 'dorian', 'ionian', 'lydian', 'mixolydian', 'phrigg', 'aeolian', 'locrian']):
        return "Scales", "Modal Playing"
    elif any(w in name_lower for w in ['triplet', 'sixteenth', 'rhythm']):
        return "Rhythm", "Rhythm Precision"
    elif any(w in name_lower for w in ['synchron', 'symetr', 'asymetr']):
        return "Warm-Up", "Synchronization"
    elif any(w in name_lower for w in ['scale', 'major', 'minor']):
        return "Scales", "Scale Practice"
    elif any(w in name_lower for w in ['dim', 'diminish']):
        return "Arpeggios", "Diminished Patterns"
    elif any(w in name_lower for w in ['riff', 'metal riff', 'palm mute', 'palm muting']):
        return "Rhythm", "Riff Playing"
    elif 'lesson' in name_lower:
        return "Songs", "Lesson Material"
    elif any(w in name_lower for w in ['funky', 'funk']):
        return "Rhythm", "Funk Guitar"
    elif 'mobius' in name_lower or 'spinning' in name_lower:
        return "Shred", "Alternate Picking"
    else:
        return "Warm-Up", "General Practice"

def main():
    files = sorted(os.listdir(EXERCISES_DIR))
    gp_files = [f for f in files if re.search(r'\.(gp\d?|gpx)$', f, re.IGNORECASE)]

    bpm_map = {
        "Warm-Up": "60-100", "Shred": "80-160", "Legato": "70-120",
        "Tapping": "60-100", "Blues": "60-100", "Chords": "60-90",
        "Scales": "60-120", "Rhythm": "80-140", "Arpeggios": "60-120", "Songs": "",
    }

    # Read existing file - keep everything up to personal exercises
    with open(EXERCISES_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the personal exercises marker and everything before it
    marker = '  /* ── PERSONAL EXERCISES (from guitar teacher) ── */'
    idx = content.find(marker)
    if idx == -1:
        print("Could not find personal exercises marker")
        return

    # Keep everything before the marker (including the trailing comma)
    before = content[:idx]

    # Generate new personal exercises with gpPath
    lines = [marker + '\n']
    next_id = 121
    for filename in gp_files:
        name = re.sub(r'\.(gp\d?|gpx)$', '', filename, flags=re.IGNORECASE)
        name = re.sub(r'\s*\(\d+\)\s*', ' ', name)
        name = name.strip(' -_.')

        category, focus = categorize(filename)
        bpm = bpm_map.get(category, "60-100")
        storage_name = sanitize_for_storage(filename)
        gp_path = f"personal/exercises/{storage_name}"

        parts = [
            f'id: {next_id}',
            f'c: "{escape_ts(category)}"',
            f'n: "{escape_ts(name)}"',
            f'm: 10',
            f'b: "{escape_ts(bpm)}"',
            f'd: "Personal exercise from guitar teacher. Practice with GP tab file."',
            f'yt: "{escape_ts(name)} guitar exercise"',
            f't: "Follow the GP tab. Start slow and build speed gradually."',
            f'f: "{escape_ts(focus)}"',
            f'bt: false',
            f'gpPath: "{escape_ts(gp_path)}"',
        ]
        lines.append('  { ' + ', '.join(parts) + ' },\n')
        next_id += 1

    lines.append('];\n')

    new_content = before + ''.join(lines)
    with open(EXERCISES_FILE, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"Updated exercises.ts with {len(gp_files)} personal exercises including gpPath")

if __name__ == "__main__":
    main()
