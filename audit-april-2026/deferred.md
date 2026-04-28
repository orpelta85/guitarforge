# Deferred / Blocked Tasks

This file logs tasks that could not be completed during autonomous execution, with reason and recommended next action.

Started: 2026-04-28

## Format
| Phase | Task | Why Blocked | Recommended Next Action |
|-------|------|-------------|--------------------------|

## Blockers

| Phase | Task | Why Blocked | Recommended Next Action |
|-------|------|-------------|--------------------------|
| Phase 2 / Task 3b | Manual download required: cabinet IRs | All free IR sources (Redwirez, Kalthallen, Overdriven.fr, TONE3000) gate downloads behind email signup or browser flow — no direct curl/wget URLs available as of 2026-04-28. Code path (Task 3a) is complete and falls back to synth IRs gracefully. | User downloads 4 WAVs manually from Redwirez or Kalthallen, drops them into `/public/audio/cabs/` per the README. The Tab Player will pick them up automatically on next page load. |
| Phase 2 / Task 4b (partial) | Optional: clap.wav | Drumdrops free pack requires login; the GSCW open-source drum kit used for the other 7 samples doesn't include a clap. The Studio falls back to synth for clap (synthDrumHit case 4). | Optional - drop a `clap.wav` into `/public/audio/drums/` if you want a real-sample clap; not required. 7 of 8 instruments now use real samples (gregharvey/drum-samples GSCW kit, ~5.5 MB total). |
