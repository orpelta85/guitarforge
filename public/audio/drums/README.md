# Drum Samples

The Studio drum machine fetches real drum samples from this directory via
`src/lib/drumSamples.ts`. If a file is missing, the engine **automatically
falls back to math-based synthesis** (`synthDrumHit` in `StudioPage.tsx`),
so the Studio always works — adding more samples here just upgrades the tone.

## Loaded files

| File | Index | Source |
|------|-------|--------|
| `kick.wav` | 0 | GSCW Yamaha 16x16 (gregharvey/drum-samples) |
| `snare.wav` | 1 | GSCW CustomWorks 6x13 |
| `hihat-closed.wav` | 2 | GSCW Sabian AAX closed |
| `hihat-open.wav` | 3 | GSCW Sabian AAX open |
| `clap.wav` | 4 | (not bundled — synth fallback) |
| `ride.wav` | 5 | GSCW Sabian 22 ride |
| `tom-low.wav` | 6 | GSCW Tama StarClassic 13x13 |
| `tom-high.wav` | 7 | GSCW Tama StarClassic 10x10 |

The bundle currently weighs ~5.5 MB total. All files are 24-bit stereo at the
original recording rate; the browser auto-resamples to the AudioContext rate
on `decodeAudioData`.

## Replacing samples

Drop a same-named WAV into this directory and hard-refresh — the cache is
keyed by URL+sample-rate, so the new file is picked up on next mount.

## Source repos used

- gregharvey/drum-samples (GSCW Drums Kit 1) — open source, free for any use
  https://github.com/gregharvey/drum-samples

## Other free options

- THE METAL KICK DRUM — https://www.themetalkickdrum.com (Pearl Master Custom)
- 99Sounds Drum Samples — https://99sounds.org/drum-samples/
- Bad Racket Recording Studio Free Drums — https://badracket.com/free-drum-samples-pack/
- Salamander Drumkit — https://github.com/endolith/Salamander-Drumkit (SFZ)
- Drumdrops Free Drums — https://www.drumdrops.com/free-drums (login required)

## Format requirements

- WAV (PCM 16/24-bit), any sample rate
- Stereo or mono — both work
- Length: typically 100 ms - 1 s; longer is fine for cymbals/rides
- Filename must match the table above exactly (lowercase, dash-separated)
