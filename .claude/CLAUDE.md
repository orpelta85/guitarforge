# CLAUDE.md — GuitarForge

## Project Context
- **What:** Guitar practice management platform for metal/rock guitarists
- **Stage:** MVP / active development
- **Stack:** Next.js 16 + TypeScript + Tailwind CSS 4 + Supabase
- **UI Language:** Hebrew (RTL). Music terminology stays in English.
- **Entry point:** `src/components/GuitarForgeApp.tsx` — main app component with all views

## Key Files
- `SPEC.md` — Full implementation spec. READ THIS FIRST for any feature work.
- `src/lib/exercises.ts` — 67 exercises (NEVER delete any, only add/modify)
- `src/lib/constants.ts` — All constants: days, categories, colors, modes, scales
- `src/lib/types.ts` — TypeScript type definitions
- `src/components/GuitarForgeApp.tsx` — Main app component

## Runtime Parameters
- **currentDate:** 2026-03-17
- **outputLanguage:** Hebrew for UI text, English for code/comments
- **verbosity:** concise
- **testingStrategy:** manual
- **gitWorkflow:** manual
- **deployTarget:** Vercel (planned)

## Running
```bash
cd C:\Users\User\guitarforge
npm run dev    # http://localhost:3000
npm run build  # production build
```

---

@rules/approach.md
@rules/code-style.md
@rules/frontend.md
@rules/hard-rules.md
