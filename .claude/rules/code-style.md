# Code Style

## General
- TypeScript everywhere — no `any` unless absolutely unavoidable
- No abstractions for things used once
- No comments unless logic is genuinely non-obvious

## React / Next.js
- All components using browser APIs must be client components: `"use client"`
- alphaTab, Tone.js, wavesurfer.js, waveform-playlist → dynamic import with `{ ssr: false }` always
- Prefer extending existing components over creating new files

## Data
- Never delete from `exercises.ts` — only add or modify
- Preserve all existing localStorage data format for backwards compatibility
- Constants live in `constants.ts` — don't hardcode values that belong there

## CSS / Tailwind
- Tailwind CSS 4 — utility classes only
- Dark theme only (`#0a0a0a` background). Never add light mode.
- Accent: amber (`#f59e0b`). Success: green (`#22c55e`). Danger: red (`#ef4444`).
- Category colors from `COL` in constants.ts — always use those, never hardcode
