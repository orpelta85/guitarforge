# Cabinet Impulse Response Files

The Tab Player and Jam Looper try to load real cabinet IRs from this directory.
If a file is missing, the audio engine **automatically falls back to a math-based
synthetic IR** (defined in `src/lib/audioIr.ts`), so the player always works —
adding the WAVs here just upgrades the tone fidelity.

## Expected files

| File | Cabinet | Used for |
|------|---------|----------|
| `mesa_v30.wav` | Mesa Boogie 4x12 with Celestion V30, SM57 on-axis | High-gain metal preset |
| `marshall_1960.wav` | Marshall 1960A 4x12 with G12T-75, SM57 off-axis | Rock preset |
| `fender_twin.wav` | Fender Twin 2x12 with Jensen, condenser mid-cone | Clean preset |
| `room_studio.wav` | Medium studio room | Reverb send (all presets) |

## Format requirements

- WAV (PCM 16-bit or 24-bit)
- Sample rate: 44.1 kHz or 48 kHz (auto-resampled by `decodeAudioData`)
- Length: 100-500 ms is typical for cabinets, up to 1 s for room IRs
- Stereo preferred for the room IR (preserves spatial width)
- File size: usually 10-100 KB each

## Free download sources

All of these are gated behind email signup, free account, or browser downloads —
direct curl/wget URLs don't exist for the free packs as of April 2026.

1. **Redwirez free pack** (Marshall 1960A) - https://www.redwirez.com — email signup
2. **Kalthallen Cabs** - https://www.kalthallen.de — email signup
3. **GuitarHack Catharsis Bundle** - via tone forums, search "Catharsis IR pack free"
4. **Overdriven.fr** - https://overdriven.fr/overdriven/index.php/irdownloads/ — browse per-cabinet pages, click Download
5. **TONE3000** - https://www.tone3000.com — community uploads, free account
6. **God's Cab** - free pack, search "God's Cab IR free download"

## Manual workflow

1. Download a free IR pack from one of the sources above
2. Pick one mic/cabinet position you like for each preset slot
3. Rename to match the table above (lowercase, no spaces)
4. Drop the four files into this directory (`/public/audio/cabs/`)
5. Hard-refresh the browser — the Tab Player will fetch and cache them automatically

The fallback synthetic IRs are tuned to approximate each cabinet, but real WAVs
sound noticeably more "amp-like" — most of the difference is in the upper-mid
texture (2-4 kHz) where speaker cone resonance and mic placement create
character that's hard to model from scratch.
