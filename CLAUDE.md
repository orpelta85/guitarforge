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

## Inherited from global (~/.claude/) - updated July 2026
- **Model and effort are two dials.** Routine work: smaller model. Ambiguity or unfamiliar
  domain: larger model. Skipped files or shallow checking: raise effort, not model.
  Current lineup: Fable 5, Opus 4.8, Sonnet 5, Haiku 4.5.
- **big-tasks-interview:** new features, 3+ files, or new architecture means interview first,
  then SPEC.md, then a fresh session to implement. SPEC.md already exists here.
- **completion-verification:** show evidence per item. A check that prints a result beats an
  assertion.
- **Two-correction tripwire:** corrected twice on the same issue means `/clear` and restart.
- **auto-format hook:** Prettier runs on write/edit when the project has package.json.
- **session-start hook:** each session opens with cwd, git status and SPEC.md head.

## Running
```bash
cd C:\Users\orpel\guitarforge
npm run dev    # http://localhost:3000
npm run build  # production build
npx tsc --noEmit   # type check
```

## Working with agents on this project
Subagents receive CLAUDE.md, rules and memory - but NOT the conversation. Anything
task-specific (which file, which error, what was already decided) must be in the prompt.

Subagents collect information and verify. Implementation stays in the main session.
Invoke an agent by name; auto-routing is unreliable.
