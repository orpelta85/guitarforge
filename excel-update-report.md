# GuitarForge Library - Excel Update Report

## What was done
Updated `GuitarForge_Complete_Library.xlsx` with GP tab status for all 8,665 songs in the code library.

## File location
`C:\Users\User\Downloads\GuitarForge Library\GuitarForge_Complete_Library.xlsx`

## Changes made
1. Replaced the single-sheet GP file list (7,071 rows) with a comprehensive view of ALL 8,665 code library songs
2. Added columns: Has GP Tab, GP Path (Code), In GP Excel, GP File (Excel), Has Key, Has Tempo, Has Tuning, Key, Tempo, Tuning
3. Sorted with "No GP" songs at the top for easy manual tab hunting
4. Added Summary sheet with coverage statistics
5. Color-coded the "Has GP Tab" column (green = Yes, red = No)
6. Added auto-filter and frozen header row

## Statistics

| Metric | Value |
|--------|-------|
| Total songs | 8,665 |
| With GP Tab | 7,099 (81.9%) |
| Without GP Tab | 1,566 (18.1%) |
| With Key metadata | 21 |
| With Tempo metadata | 21 |
| With Tuning metadata | 21 |
| Matched in original GP Excel | 4,920 |
| Not in original GP Excel | 3,745 |

## How to use
1. Open the Excel file
2. Go to the "Library" sheet
3. The top 1,566 rows are songs WITHOUT GP tabs - these are the priority for manual tab searching
4. Use the auto-filter on any column to narrow down (e.g., filter by Artist)
5. The "Summary" sheet has overall coverage stats

## Data sources
- **Code library**: `src/lib/spotify-songs.ts` (8,665 songs after dedup) + `src/lib/songs-data.ts` (12 manual songs)
- **GP Excel**: Original `GuitarForge_Complete_Library.xlsx` (7,071 GP file entries)
- **Match method**: Case-insensitive title + artist matching
