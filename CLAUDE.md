# GuitarForge — Claude Code Instructions

## Project
Guitar practice management platform for metal/rock guitarists.
Next.js 16 + TypeScript + Tailwind CSS 4 + Supabase.

## Key Files
- `SPEC.md` — Full implementation specification. READ THIS FIRST for any feature work.
- `src/lib/exercises.ts` — 67 exercises data (DO NOT lose any)
- `src/lib/constants.ts` — All constants (days, categories, colors, modes, scales, styles)
- `src/lib/types.ts` — TypeScript type definitions
- `src/components/GuitarForgeApp.tsx` — Main app component with all views

## Rules
- UI language is English (LTR).
- Dark theme only (#0a0a0a background). No light mode.
- All new components must be client components ("use client") if they use browser APIs.
- alphaTab, Tone.js, wavesurfer.js, waveform-playlist — MUST use dynamic import with `{ ssr: false }`.
- Never delete exercises from exercises.ts. Only add or modify.
- Preserve all existing localStorage data format for backwards compatibility.
- Primary accent color: amber (#f59e0b). Success: green (#22c55e). Danger: red (#ef4444).
- Category colors defined in COL (constants.ts) — always use those.

## Running
```bash
cd C:\Users\User\guitarforge
npm run dev    # http://localhost:3000
npm run build  # production build
```
