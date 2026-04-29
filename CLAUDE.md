# GuitarForge — Claude Code Instructions

## Project
Guitar practice management platform for metal/rock guitarists.
Next.js 16 + TypeScript + Tailwind CSS 4 + Supabase.

## Key Files
- `SPEC.md` — Full implementation specification. READ THIS FIRST for any feature work.
- `STATUS.md` — Current project status, updated at end of each session. READ THIS for context.
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

## Auto-Save Rule
Every ~1 hour of active work, automatically commit and push all changes to GitHub.
- Don't ask permission — just do it
- Commit message should summarize what was done in that period
- Only commit source code files (src/, .claude/) — skip screenshots and temp files
- If TypeScript doesn't compile, fix it before committing

## Inherited from global (~/.claude/) - April 2026 v7
- **Model routing:** Quality-First — Opus 4.7 default for code/design, Haiku only for trivial Word/PDF.
- **big-tasks-interview rule:** new features, 3+ file changes, or new architecture → ask 3-5 questions and write SPEC.md before coding. SPEC.md already exists here, so updates flow through it.
- **completion-verification:** before saying "done", show evidence per item from the original request.
- **auto-format hook:** Prettier runs automatically on .ts/.tsx/.js/.jsx/.json/.css after every Write/Edit when the project has a package.json (this one does).
- **session-start hook:** every session opens with cwd + git status + SPEC.md head briefing.

## Running
```bash
cd C:\Users\User\guitarforge
npm run dev    # http://localhost:3000
npm run build  # production build
```
