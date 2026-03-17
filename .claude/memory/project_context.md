---
name: project_context
description: Current state of GuitarForge project — goals, recent work, decisions
type: project
---

## Current State
- **Stage:** MVP / active development
- **Last major updates (2026-03-16):**
  - Advanced tab player with Worker loading fix and full practice controls
  - YouTube auto-embed, unified exercise modal, library sync
  - AI Coach, enhanced ear training, chord diagrams, reports
  - GuitarForge v1.0 full guitar practice platform

## Architecture Decisions
- Single main component: `GuitarForgeApp.tsx` handles all views
- localStorage for data persistence (backwards compatibility required)
- alphaTab for sheet music / tab rendering (dynamic import, no SSR)
- Supabase planned but not yet integrated

## Upcoming / In Progress
- Research guitar tab sources (guitarprotabs.org) for downloadable .gp files
- Research guitar learning styles (Marty Schwartz, Justin Guitar) for style categories

**Why:** Track project momentum across conversations so Claude has context without re-explaining.
**How to apply:** Reference this when user says "continue" or "where were we" to pick up seamlessly.
