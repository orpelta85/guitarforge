# Hard Rules — Never Do These

## Data Integrity
- NEVER delete exercises from `exercises.ts` — only add or modify
- NEVER change localStorage data format — backwards compatibility is required
- NEVER hardcode colors that exist in `COL` (constants.ts)

## Architecture
- NEVER add light mode
- NEVER use SSR with alphaTab, Tone.js, wavesurfer.js or waveform-playlist — always `{ ssr: false }`
- NEVER create a new component file if extending an existing one works

## Stack
- No CSS frameworks beyond Tailwind 4
- No additional UI libraries without explicit approval
- No new audio/music libraries without explicit approval (already using alphaTab, Tone.js, wavesurfer.js)
