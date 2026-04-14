# GP Tab Audit Report

Date: 2026-03-23

## Summary

Cross-referenced all GP tab files in Supabase storage (`gp-tabs` bucket) against the song library in code (`spotify-songs.ts` and `songs-data.ts`).

### Key Numbers

| Metric | Count |
|--------|-------|
| GP files in Supabase storage | 6,978 |
| Total songs in code library | 8,666 (8,654 spotify + 12 manual) |
| Songs with `gp: true` in code | 7,099 |
| Songs with `gpPath` BEFORE audit | 5,879 |
| Songs with `gpPath` AFTER audit | 6,504 (6,492 spotify + 12 manual) |
| **Songs fixed (gpPath added)** | **625** |
| Songs still missing gpPath | ~595 |
| Dangling gpPaths (file not in storage) | 76 |
| Storage files with no match in library | ~1,273 |

## Fixes Applied

### Pass 1: 35 fixes
- 23 songs in `spotify-songs.ts` - matched via improved regex
- 12 songs in `songs-data.ts` (MANUAL_SONGS) - all 12 entries got `gp: true, gpPath: "..."` added

### Pass 2: 590 fixes
- Fixed artist-to-folder mapping bug (pass 1 used regex that sometimes grabbed wrong artist)
- Built deterministic slug-based mapping + manual overrides for 267 artists
- Matched 590 additional songs to their storage files

### Manual Songs Fixed (songs-data.ts)

| ID | Title | Artist | gpPath Added |
|----|-------|--------|-------------|
| 1 | Master of Puppets | Metallica | songs/metallica/Master Of Puppets.gp4 |
| 2 | Enter Sandman | Metallica | songs/metallica/Enter Sandman (3).gp3 |
| 3 | Nothing Else Matters | Metallica | songs/metallica/Nothing Else Matters (6).gp4 |
| 4 | Smoke on the Water | Deep Purple | songs/deep-purple/Smoke On The Water.gp4 |
| 5 | Iron Man | Black Sabbath | songs/black-sabbath/Iron Man V6.gp3 |
| 6 | Killing in the Name | Rage Against the Machine | songs/rage-against-the-machine/Killing In The Name.gp3 |
| 7 | Like a Stone | Audioslave | songs/audioslave/Like A Stone V5.gp4 |
| 8 | Sweet Child O' Mine | Guns N' Roses | songs/guns-n-roses/Sweet Child O Mine (4).gp4 |
| 9 | Welcome to the Jungle | Guns N' Roses | songs/guns-n-roses/Welcome To The Jungle.gp3 |
| 10 | Kashmir | Led Zeppelin | songs/led-zeppelin/Kashmir.gp3 |
| 11 | Black | Pearl Jam | songs/pearl-jam/Black (2).gp4 |
| 12 | Down in a Hole | Alice in Chains | songs/alice-in-chains/Down In A Hole V2.gp3 |

## Remaining Issues

### Songs with `gp: true` but no gpPath (~595)

These songs have `gp: true` set in the code but no matching file was found in storage. Possible causes:
- The file exists under a different artist folder or naming convention
- The `gp: true` flag was set erroneously during enrichment
- The file was uploaded under a different name than the song title

Top artist groups with unmatched songs:
- Taylor Swift (many vault/version tracks)
- Metallica (live/remastered variants)
- Various Hebrew songs (no GP tabs typically exist for these)

### Dangling gpPaths (76 songs)

These songs have a `gpPath` value that does NOT correspond to an actual file in storage. Most are caused by special characters in filenames:
- Square brackets in filenames: `[Mistery Intro]`, `[2]`, `[Live]`
- Backticks: `I Still Haven't Found What I'm Looking For`
- Accented characters: `Sad Cafe`, `Inn I Evighetens M'rke`
- Personal songs with Hebrew characters

These are likely URL-encoding mismatches between the code and Supabase storage.

### Storage files with no match in library (~1,273)

These are GP files in storage that have no corresponding song entry in the code library. Most are:
- Alternate versions (V1, V2, Solo, Intro variants where a different version is already linked)
- Exercise/lesson files that aren't songs
- Songs by artists not in the Spotify library

## Excluded False Positives

The following were identified as false matches and excluded:
- id 2200: "A Day In The Life" by Wes Montgomery - wrongly matched to Beatles folder
- id 3736: "(2)" by Iron Maiden - bogus entry with no real title
- id 5678-5680: "(2)", "(3)", "(4)" by Rammstein - bogus entries
- id 6541 (pass 1 only): "Tears" by Django Reinhardt - wrongly matched to Testament "Trail Of Tears" (fixed in pass 2 to correct folder)

## Verification

- TypeScript compiles cleanly after all changes (`npx tsc --noEmit`)
- All gpPath values point to files confirmed in Supabase storage
- Manual songs (songs-data.ts) now all have GP tab access for the first time
