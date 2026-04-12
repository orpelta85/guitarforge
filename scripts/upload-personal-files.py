#!/usr/bin/env python3
# Upload personal GP files to Supabase Storage

import os
import re
import requests
import urllib.parse

SUPABASE_URL = "https://rmwaezujumikbukbirpt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtd2FlenVqdW1pa2J1a2JpcnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTE5MjksImV4cCI6MjA4OTYyNzkyOX0.FGusD1oWUS5e8zAPSB5-wm0cJg6yOCDK2ekdOGvw8Iw"
BUCKET = "gp-tabs"

DIRS = [
    ("C:\\Users\\User\\Downloads\\GuitarForge Library\\Songs", "personal/songs"),
    ("C:\\Users\\User\\Downloads\\GuitarForge Library\\Exercises", "personal/exercises"),
]

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
    total = 0
    success = 0
    for src_dir, dest_prefix in DIRS:
        files = sorted(os.listdir(src_dir))
        gp_files = [f for f in files if re.search(r'\.(gp\d?|gpx)$', f, re.IGNORECASE)]
        print(f"\n--- {dest_prefix}: {len(gp_files)} files ---")
        for filename in gp_files:
            filepath = os.path.join(src_dir, filename)
            storage_path = f"{dest_prefix}/{filename}"
            ok, status, text = upload_file(filepath, storage_path)
            total += 1
            if ok:
                success += 1
                print(f"  OK: {filename}")
            else:
                print(f"  FAIL ({status}): {filename} - {text}")

    print(f"\nTotal: {success}/{total} uploaded successfully")

if __name__ == "__main__":
    main()
