#!/usr/bin/env python3
# Upload Hebrew-named GP files to Supabase Storage with sanitized names
# Also updates the gpPath in the TS files to match

import os
import re
import unicodedata
import requests
import urllib.parse

SUPABASE_URL = "https://rmwaezujumikbukbirpt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtd2FlenVqdW1pa2J1a2JpcnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTE5MjksImV4cCI6MjA4OTYyNzkyOX0.FGusD1oWUS5e8zAPSB5-wm0cJg6yOCDK2ekdOGvw8Iw"
BUCKET = "gp-tabs"

DIRS = [
    ("C:\\Users\\User\\Downloads\\GuitarForge Library\\Songs", "personal/songs"),
    ("C:\\Users\\User\\Downloads\\GuitarForge Library\\Exercises", "personal/exercises"),
]

# Simple Hebrew to Latin transliteration
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

def sanitize_filename(filename):
    """Convert Hebrew chars to transliteration, keep ASCII."""
    result = []
    for ch in filename:
        if ch in HEBREW_MAP:
            result.append(HEBREW_MAP[ch])
        elif ord(ch) < 128:
            result.append(ch)
        else:
            # Skip other non-ASCII (niqqud etc)
            pass
    sanitized = ''.join(result)
    # Clean up multiple spaces/dashes
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    return sanitized

def upload_file(filepath, storage_path):
    encoded_path = urllib.parse.quote(storage_path, safe='/')
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{encoded_path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/octet-stream",
    }
    with open(filepath, 'rb') as f:
        data = f.read()
    resp = requests.post(url, headers=headers, data=data)
    if resp.status_code == 409 or (resp.status_code == 400 and "already exists" in resp.text.lower()):
        resp = requests.put(url, headers=headers, data=data)
    return resp.status_code in (200, 201), resp.status_code, resp.text[:200]

def main():
    # Collect renames for TS file updates
    renames = {}  # original_filename -> sanitized_filename
    total = 0
    success = 0

    for src_dir, dest_prefix in DIRS:
        files = sorted(os.listdir(src_dir))
        gp_files = [f for f in files if re.search(r'\.(gp\d?|gpx)$', f, re.IGNORECASE)]
        hebrew_files = [f for f in gp_files if has_non_ascii(f)]
        print(f"\n--- {dest_prefix}: {len(hebrew_files)} Hebrew-named files ---")

        for filename in hebrew_files:
            sanitized = sanitize_filename(filename)
            filepath = os.path.join(src_dir, filename)
            storage_path = f"{dest_prefix}/{sanitized}"
            ok, status, text = upload_file(filepath, storage_path)
            total += 1
            renames[f"{dest_prefix}/{filename}"] = f"{dest_prefix}/{sanitized}"
            if ok:
                success += 1
                print(f"  OK: {filename} -> {sanitized}")
            else:
                print(f"  FAIL ({status}): {filename} -> {sanitized} - {text}")

    print(f"\nTotal: {success}/{total} uploaded")

    # Now update the TS files with sanitized paths
    for ts_file in [
        "C:\\Users\\User\\guitarforge\\src\\lib\\spotify-songs.ts",
        "C:\\Users\\User\\guitarforge\\src\\lib\\exercises.ts",
    ]:
        if not os.path.exists(ts_file):
            continue
        with open(ts_file, 'r', encoding='utf-8') as f:
            content = f.read()
        changed = False
        for orig, sanitized in renames.items():
            if orig in content:
                content = content.replace(orig, sanitized)
                changed = True
                print(f"  Updated path in {os.path.basename(ts_file)}: {orig} -> {sanitized}")
        if changed:
            with open(ts_file, 'w', encoding='utf-8') as f:
                f.write(content)

if __name__ == "__main__":
    main()
