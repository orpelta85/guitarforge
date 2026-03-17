---
name: qa
description: Run comprehensive QA testing on GuitarForge after code changes. Use this skill after ANY code modification, bug fix, or feature addition. Triggers on "/qa", "run qa", "test everything", "check if it works", "verify the app", or when you've just finished implementing changes and need to verify they work. ALWAYS run this before committing or telling the user something is fixed.
---

# GuitarForge QA Testing

Run this complete QA checklist after every code change. Report PASS/FAIL for each section.

## Phase 1: Build Verification (MUST PASS before continuing)

```bash
cd c:/Users/User/guitarforge
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -20
```

If either fails, STOP and fix the errors first. Do not proceed to browser testing.

## Phase 2: Start Dev Server

```bash
# Check if already running
curl -s http://localhost:3000 > /dev/null 2>&1 && echo "RUNNING" || echo "NOT RUNNING"
# If not running, start it
cd c:/Users/User/guitarforge && npm run dev &
# Wait for it
sleep 5
```

## Phase 3: Browser Testing with Playwright MCP

Use the Playwright MCP tools (browser_navigate, browser_click, browser_snapshot, browser_console_messages) to test each page. If Playwright is unavailable, skip to Phase 4.

### 3.1 Dashboard
- Navigate to http://localhost:3000
- Verify page loads (check for "Channel Settings", "Schedule" text)
- Click Style dropdown — verify 13 styles appear
- Click "Build Routine" — verify exercises populate the schedule
- Check console for errors

### 3.2 Practice
- Click "Practice" nav button
- Click on a day (e.g., first day button)
- Verify exercises are listed
- Click an exercise to open modal
- Verify modal has tabs: Practice/Tutorial/Log
- Verify metronome controls exist (BPM, time signature, subdivisions)
- Close modal
- Mark an exercise as done
- Check console for errors

### 3.3 Library
- Click "Library" nav button
- Verify "All (98)" or similar count shows
- Click a category filter (e.g., first new category)
- Verify exercises filter correctly
- Click an exercise to expand LibraryEditor
- Check console for errors

### 3.4 Learning Center
- Click "Learning" nav button
- Verify 3 main tabs: שיעורים / תרגילים / כלים

**Lessons:**
- Click שיעורים tab
- Verify category buttons appear (יסודות, קצב, סקאלות, etc.)
- Click a lesson — verify content loads with title, text, quiz
- Answer quiz — verify feedback ("נכון!" or "לא נכון")
- Click "סיום שיעור" — verify XP updates

**Exercises:**
- Click תרגילים tab
- Verify exercise mode buttons (Intervals, Chords, Scales, Progressions, Fretboard, Construction + keyboard modes)
- Click Intervals → Press Play → verify answer buttons appear
- Click Fretboard → Press "New Note" → verify fretboard shows dot
- Click Construction → verify root/scale selectors and note buttons
- Check for audio frequency warnings in console (should be none)

**Tools:**
- Click כלים tab
- Verify 9 tool tabs (Scales, Chords, Fretboard, Progressions, Circle of 5ths, Intervals, Tempo Tapper, IV Calculator, Piano)
- Click Scales — verify fretboard updates when changing root/scale
- Click Chords — verify chord diagrams load
- Click Progressions — verify presets and Play button
- Click Piano — verify keyboard renders and keys are clickable

### 3.5 Studio
- Click "Studio" nav button
- Verify transport bar (Play, Stop, Record, Loop, BPM, Time Sig, Key)
- Verify "Add Track" button opens dropdown with 3 options (Record/Upload/YouTube)

**Recording test:**
- Click Add Track → Record
- Verify new mic track appears with record arm
- Click main Record button — verify recording starts (mic permission may be needed)
- Click Stop — verify waveform appears on track

**File upload test:**
- Click Add Track → Upload File
- (Can only verify the file picker opens)

**Track controls:**
- Verify Mute/Solo buttons toggle
- Verify volume slider moves
- Verify track can be deleted via menu

**Save/Export:**
- With at least one track, click Export dropdown
- Verify "Save to Library" and "Download WAV" options exist
- Click "Save to Library" — verify it saves to recordings panel (NOT creates new track)

**Recordings panel:**
- Click recordings panel toggle
- Verify panel opens on right side
- If recordings exist, verify play/rename/download/delete buttons

### 3.6 Other Pages
- Click "Coach" — verify page loads
- Click "Report" — verify stats display
- Click "Profile" — verify form fields

### 3.7 Console Error Check
- Use browser_console_messages to check for any errors across all pages
- Report any errors found

## Phase 4: Fallback (if Playwright unavailable)

If Playwright MCP tools are not available or crash, do a code-level check:

```bash
cd c:/Users/User/guitarforge

# Check all components exist and compile
npx tsc --noEmit

# Check key files exist with expected content
wc -l src/components/StudioPage.tsx src/components/LearningCenterPage.tsx src/components/GuitarForgeApp.tsx
grep -c "export default" src/components/StudioPage.tsx
grep -c "export default" src/components/LearningCenterPage.tsx

# Check exercises count
node -e "const e = require('./src/lib/exercises.ts'); console.log('Exercises:', e.EXERCISES.length)" 2>/dev/null || echo "Can't run directly, check via grep"
grep -c "^  {" src/lib/exercises.ts

# Check categories count
grep "CATS" src/lib/constants.ts | head -3

# Check styles count
grep "STYLES" src/lib/constants.ts | head -3

# Production build (ultimate test)
npm run build 2>&1 | tail -5
```

## Reporting Format

```
## QA Report — [date]

### Build: ✅ PASS / ❌ FAIL
- TypeScript: ✅/❌
- Production build: ✅/❌

### Pages:
- Dashboard: ✅/❌ [details if fail]
- Practice: ✅/❌
- Library: ✅/❌
- Learning - Lessons: ✅/❌
- Learning - Exercises: ✅/❌
- Learning - Tools: ✅/❌
- Studio: ✅/❌
- Coach: ✅/❌
- Report: ✅/❌
- Profile: ✅/❌

### Interactions:
- Build Routine: ✅/❌
- Exercise Modal: ✅/❌
- Metronome: ✅/❌
- Library Filters: ✅/❌
- Learning Quiz: ✅/❌
- Learning Exercises: ✅/❌
- Studio Add Track: ✅/❌
- Studio Recording: ✅/❌
- Studio Save: ✅/❌
- Studio Export: ✅/❌

### Console Errors: [count]
[list any errors]

### Summary: X/Y tests passed
```
