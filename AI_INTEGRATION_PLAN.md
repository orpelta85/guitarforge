# GuitarForge AI Integration Plan

**Date:** March 21, 2026
**Goal:** Make AI a central, integrated feature across every surface of the app — not an afterthought.

---

## 1. Current State Assessment

### 1A. Suno AI Backing Tracks

**Where it appears:**
- **Studio** — sidebar tab "Suno AI" with Generate/Library/Credits sub-tabs. Full builder (scale/mode/style/BPM selectors) + custom prompt toggle. Library with search, favorites, delete, add-to-DAW.
- **Exercise Modal** — `SunoSection` component. Auto-checks IndexedDB cache for matching track. Generate button with credit confirmation. Inline audio player with loop.
- **Dashboard** — card "AI Backing Track" with one-click generate for current channel settings. Dismissible. Shows DarkAudioPlayer when ready.
- **AI Coach** — can generate a backing track inline via quick action button.
- **Library page** — "Backing Tracks" tab shows all saved Suno tracks from IndexedDB.

**What works:**
- Generation flow is functional (POST /api/suno -> poll -> return tracks)
- IndexedDB caching avoids re-generating identical tracks (cache key = exercise+style+scale+mode+bpm)
- Library CRUD with favorites, ratings, tags
- Credit tracking (daily usage + total credits display)
- Custom prompt mode for advanced users
- 17 genre templates for style building

**What's broken / weak:**
1. **"Just sends you to Studio"** — The dashboard card and exercise modal don't feel integrated. There's no smart recommendation, no context-awareness about what the user is practicing right now.
2. **Generation takes 1-3 minutes with no streaming** — user stares at a spinner. No partial audio preview, no progress indicator.
3. **Only uses `generate` endpoint** — we have access to extend, cover, vocal separation, add instrumental, add vocals, MIDI generation, mashup, and boost style. None are used.
4. **15-day file expiration** — Suno deletes files after 15 days. We cache blobs in IndexedDB which is good, but coach-generated tracks save with `new Blob()` (empty!) so they can't be replayed offline.
5. **No smart generation** — tracks are generic. No awareness of what exercise the user is doing, what tempo they need to build up to, what key progression they're working on.
6. **Credit management is passive** — shows credits but doesn't help users spend them wisely. No "generate 3 tracks for the week" batch mode.
7. **Song library backing tracks** — the "Generate Backing" button on songs exists but is disconnected from Suno library.

### 1B. AI Coach

**Where it appears:**
- Dedicated page (`/coach` or `#coach`) with chat interface.
- Quick action buttons: suggest exercises, explain technique, build routine, daily practice, generate backing, analyze progress.

**How it works:**
- **Demo mode** (no API key): Pattern-matching on keywords, returns canned responses from `getDemoResponse()`. Generates practice plans from exercise data, recommends songs via scoring algorithm, shows progress stats from localStorage.
- **Live mode** (Anthropic API key): Sends to Claude Haiku 4.5 via `/api/coach`. System prompt is a basic guitar teacher persona. Receives user context (profile, streak, exercises done, BPM log, learning XP).

**What's broken / weak:**
1. **Demo mode is a keyword matcher** — not AI at all. Responses are random picks from arrays. Feels fake immediately.
2. **Live mode requires user's own API key** — huge friction. Most users won't have an Anthropic API key. The app should provide this.
3. **No tool use / function calling** — Coach can't actually DO anything. Can't start a timer, can't navigate to an exercise, can't modify the practice schedule, can't generate a Suno track seamlessly.
4. **Context is shallow** — sends basic stats (streak, exercises done, BPM) but doesn't include: which exercises user skips, BPM progression over time, weak categories, time spent per exercise, practice patterns.
5. **No proactive coaching** — Coach only responds when asked. Never nudges, never congratulates on milestones, never warns about skipped categories.
6. **No memory** — each session starts fresh (history is saved in localStorage but not summarized or used intelligently). The coach doesn't learn the user's patterns.
7. **Markdown rendering is basic** — custom parser, no code blocks, no tables, no links.
8. **No streaming** — waits for full response, shows typing indicator.

### 1C. AI Elsewhere

**Currently absent from:**
- Practice page (daily routine)
- Learning page (lessons, exercises, tools)
- Report/analytics page
- Song modal
- Profile page
- Onboarding

---

## 2. Suno API — Untapped Capabilities

Based on the sunoapi.org documentation, we currently use 2 of 12+ endpoints:

| Endpoint | Status | Value for GuitarForge |
|---|---|---|
| `POST /generate` | USED | Core backing track generation |
| `GET /generate/record-info` | USED | Poll for completion |
| `GET /generate/credit` | USED | Credit balance |
| `POST /generate/extend` | NOT USED | Extend a track beyond its duration — make a 2min track into 4min |
| `POST /generate/upload-cover` | NOT USED | Re-style any audio. Upload a song, get it in a different genre |
| `POST /vocal-removal/generate` | NOT USED | Separate vocals from instrumentals — HUGE for learning songs |
| `POST /add-instrumental` | NOT USED | Generate backing music for a vocal stem |
| `POST /add-vocals` | NOT USED | Add AI vocals over instrumental |
| `POST /generate/midi` | NOT USED | Convert audio to MIDI — for notation, theory analysis |
| `POST /generate/mashup` | NOT USED | Blend multiple audio sources |
| `POST /boost-style` | NOT USED | Enhance/modify style of existing track |
| `POST /lyrics` | NOT USED | Generate lyrics (less relevant for instrumental focus) |
| `POST /generate/wav` | NOT USED | Convert to WAV for higher quality |
| `POST /music-video` | NOT USED | Generate visualizations |

### High-Value Untapped Features:

**Vocal Separation** — User uploads or links a song they want to learn. We separate vocals from instruments. They get an isolated guitar track, a backing track without guitar, or vocals-only. This is the #1 requested feature in guitar learning apps.

**Extend Track** — User has a 2-minute backing track but needs 5 minutes for a long practice session. One click to extend.

**Upload & Cover** — User has a song in one style, wants to practice the same progression in a different genre. Upload a blues track, get it back as metal.

**MIDI Generation** — Convert any backing track to MIDI. Display as notation in alphaTab. Analyze chord progressions. Show scale degrees. This bridges audio and theory.

---

## 3. Improvement Plan (Prioritized)

### P0 — Critical (Ship This Week)

#### 3.1 Server-Side AI Coach (No User API Key)
**Problem:** Users need their own Anthropic API key. Almost nobody will do this.
**Solution:**
- Move to server-side API key (`ANTHROPIC_API_KEY` in `.env.local`)
- Remove the API key input from the coach UI
- Add rate limiting (30 messages/day per session)
- Use Claude Haiku 4.5 (cheap: ~$0.001/message)
- Demo mode becomes the fallback when no server key is configured, not the default

**Files to change:** `src/app/api/coach/route.ts`, `src/components/AiCoachPage.tsx`

#### 3.2 Rich Context for AI Coach
**Problem:** Coach knows almost nothing about the user's practice patterns.
**Solution:** Build a comprehensive context builder that includes:
```
- Profile: level, years, genres, goals, gear
- This week: exercises completed (with names), exercises skipped, categories covered vs neglected
- BPM progression: for each exercise, show last 4 logged BPMs with dates
- Streaks: current, longest, total days, last active date
- Learning: XP, level, completed lessons
- Weak areas: categories with <30% completion rate
- Strong areas: categories with >80% completion rate
- Practice time patterns: which days they practice, morning/evening
- Current channel: scale, mode, style, week number
- Song library: what songs they've added, how many completed
- Suno library: how many tracks generated, most-used styles
```

**Files to change:** `src/components/AiCoachPage.tsx` (expand `getCoachContext`)

#### 3.3 Fix Coach-Generated Suno Tracks (Empty Blob Bug)
**Problem:** In `AiCoachPage.tsx` line 613, tracks are saved with `audioBlob: new Blob()` — empty. They can't be replayed from library.
**Solution:** Fetch the audio URL and convert to blob before saving, same as `downloadAndCache` does in `suno.ts`.

#### 3.4 Dashboard AI Card — Smarter Suggestions
**Problem:** Dashboard Suno card is generic "generate a practice track."
**Solution:** Make it contextual:
- If user hasn't practiced today: "Warm up with a backing track in [their scale/mode]"
- If user is working on a specific exercise: "Backing track for [exercise name]"
- If user completed a milestone: "Celebrate with a jam session"
- Show the last generated track if one exists (from library)
- One-click play from cached tracks, only generate if nothing cached

---

### P1 — High Value (Next 2 Weeks)

#### 3.5 Vocal Separation for Song Learning
**Problem:** Users want to learn songs but can't isolate the guitar or remove it.
**Solution:**
- New API route: `POST /api/suno/separate`
- In Song Modal: "Separate Tracks" button
- User provides a URL or uploads audio
- Returns: vocals stem, instrumental stem, (optionally guitar isolated)
- Display stems with individual volume controls
- "Practice without guitar" mode — play the backing without the guitar track

**UX Flow:**
1. User opens a song in the library
2. Clicks "AI Stems" button
3. Uploads audio or provides URL
4. Waits ~1 min for separation
5. Gets 2 stems: vocal + instrumental
6. Can play instrumental-only as a backing track
7. Stems saved to IndexedDB

**New files:** `src/app/api/suno/separate/route.ts`, new UI section in Song Modal

#### 3.6 Extend Track
**Problem:** Generated tracks are 2-4 minutes. Practice sessions can be 15-30 minutes.
**Solution:**
- New API route: `POST /api/suno/extend`
- In Suno Library and Studio: "Extend" button on any track
- Takes the Suno audio ID + desired continuation point
- Returns extended version
- Cache the extended version

**UX Flow:**
1. User has a backing track playing
2. Clicks "Extend" (or track auto-extends when nearing end during practice)
3. Generation happens, new segment appended
4. Seamless playback continues

**New files:** `src/app/api/suno/extend/route.ts`

#### 3.7 AI Coach — Tool Use / Actions
**Problem:** Coach gives advice but can't execute anything.
**Solution:** Give the coach "tools" it can invoke:
- `navigate(page)` — take user to a specific page/exercise
- `startExercise(id)` — open exercise modal for a specific exercise
- `generateBackingTrack(params)` — create a Suno track inline
- `buildRoutine(params)` — create and apply a weekly practice plan
- `addSong(query)` — search and add a song to user's library
- `setMetronome(bpm)` — set metronome BPM

Implementation: Use Claude's tool_use feature. Parse tool calls from response. Execute client-side. Show results inline in chat.

**Files to change:** `src/app/api/coach/route.ts` (add tools), `src/components/AiCoachPage.tsx` (handle tool results)

#### 3.8 Smart Exercise Recommendations
**Problem:** No AI-driven exercise suggestions based on user data.
**Solution:** Add an AI recommendation engine to the Practice page:
- Analyze which categories user neglects
- Check BPM plateaus (same BPM for 2+ weeks = plateau)
- Suggest exercises that complement what they've been doing
- "You've been focusing on Shred all week. Your Rhythm skills need attention."
- Show as a card at top of Practice page

**UX:** Subtle card: "Coach suggests: [Exercise Name] — you haven't done [Category] in 5 days"

#### 3.9 Proactive Coach Notifications
**Problem:** Coach is passive, only responds to direct questions.
**Solution:** Smart notification system:
- After 3-day streak: "Keep it up! Want a challenge?"
- After completing a hard exercise: "You nailed [exercise]! Try it 10 BPM faster?"
- When BPM plateaus: "You've been at 120 BPM for 2 weeks on [exercise]. Here's a technique to break through."
- On category neglect: "Your Ear Training is falling behind. 10 minutes today?"
- These appear as coach "bubbles" on the dashboard, not full chat messages

---

### P2 — Advanced (Month 2)

#### 3.10 Upload & Cover / Re-Style
**Problem:** Users want variety but regenerating is expensive.
**Solution:**
- New API route: `POST /api/suno/cover`
- "Re-style" button on any Suno track
- Choose a new genre/style, keep the same progression
- E.g., turn a Metal backing track into Blues, or Acoustic

**UX Flow:**
1. User has a backing track in Metal
2. Clicks "Re-style"
3. Picks new genre from dropdown
4. Gets the same musical content in a new style
5. Both versions saved to library

#### 3.11 MIDI Generation & Theory Analysis
**Problem:** Backing tracks are audio-only. No way to see what's happening musically.
**Solution:**
- New API route: `POST /api/suno/midi`
- Convert any backing track to MIDI
- Display MIDI in alphaTab as notation
- Analyze: extract chord progression, show scale degrees, identify key
- "This track uses: Am - F - C - G (i - VI - III - VII in A minor)"

**Integration points:**
- Studio: "View as notation" button on any track
- Learning page: auto-generated theory analysis
- Exercise Modal: show chord changes in real-time during playback

#### 3.12 AI Practice Session
**Problem:** User opens the app and doesn't know where to start.
**Solution:** "AI Practice Session" mode:
1. User clicks "Start AI Session" on dashboard
2. Coach analyzes their data and generates a focused 30-60 min session
3. Automatically queues exercises in order
4. Generates a matching backing track for improv/application exercises
5. Tracks completion and adjusts difficulty mid-session
6. Ends with a summary: "You practiced 45 min, improved BPM on 2 exercises, covered 4 categories"

#### 3.13 AI Song Difficulty Analysis
**Problem:** Song library has static difficulty ratings.
**Solution:**
- When user adds a song, AI analyzes: tempo, key, techniques required
- Compares to user's current skill level
- Rates: "This song is slightly above your level — focus on the sweep picking section"
- Suggests prerequisite exercises

#### 3.14 Recording Analysis (Future)
**Problem:** Users record themselves but get no feedback.
**Solution:**
- User records in Studio
- AI analyzes: timing accuracy (vs metronome), note clarity, tempo consistency
- Provides specific feedback: "Your timing drifts at bar 8-12. Try practicing that section at 80% speed."
- This requires audio analysis capabilities beyond Suno — possibly a separate ML model

#### 3.15 AI-Powered Warm-Up Generator
**Problem:** Warm-ups are always the same.
**Solution:**
- Daily AI-generated warm-up based on what user will practice
- If practicing sweep picking later, warm-up focuses on arpeggio stretches
- If practicing blues improv, warm-up includes pentatonic patterns
- 5-minute targeted warm-up with metronome auto-set

---

## 4. New API Routes Needed

```
POST /api/suno/extend     — Extend a track (audioId, continueAt, model)
POST /api/suno/separate   — Vocal/instrumental separation (audioId or uploadUrl)
POST /api/suno/cover      — Re-style a track (uploadUrl, style, model)
POST /api/suno/midi       — Generate MIDI from audio (audioId or uploadUrl)
POST /api/suno/add-instrumental — Generate backing for uploaded vocal
POST /api/coach            — (existing, upgrade to use server key + tool_use)
```

---

## 5. UX Flows — Detailed

### Flow A: Exercise with AI Backing Track (Improved)
```
1. User opens exercise (e.g., "Alternate Picking Pentatonic")
2. System checks IndexedDB cache for matching track
3. IF cached: auto-play with loop, show "AI Backing Track" section
4. IF not cached: show smart suggestion card:
   "Generate a [Am Aeolian Metal] backing track at [exercise BPM]?"
   [Generate] [Use YouTube Instead]
5. User clicks Generate
6. Progress: "Generating... (~60s)" with animated waveform
7. Track arrives, auto-plays, cached for next time
8. Below player: [Extend +2min] [Re-style] [Save to Library]
```

### Flow B: Learn a Song with AI Stems
```
1. User browses Song Library, opens "Master of Puppets"
2. Song modal shows: difficulty, tuning, techniques, YouTube embed
3. NEW: "AI Practice Tools" section:
   - [Separate Stems] — upload audio, get vocal/instrumental
   - [Generate Backing] — Suno backing in the song's key/style
   - [Slow Down] — (future: time-stretch without pitch shift)
4. User clicks "Separate Stems"
5. Uploads MP3 or provides URL
6. Gets: Vocals | Instrumental | (future: Guitar isolated)
7. Plays instrumental-only as backing track for practice
8. Stems saved to library
```

### Flow C: AI Practice Session
```
1. Dashboard: "Start AI Session" button (prominent)
2. Coach analyzes: weak categories, BPM plateaus, streak status
3. Generates personalized session:
   "Today's 45-min session:
    - 5 min: Chromatic Warm-Up (metronome 80 BPM)
    - 10 min: Alternate Picking Speed Build (your plateau: 140 BPM)
    - 10 min: Phrasing — Blues Licks (neglected category)
    - 10 min: Improv over AI backing track (Am Dorian Metal 120BPM)
    - 10 min: Song practice — Master of Puppets intro riff"
4. User clicks "Start"
5. App queues exercises, auto-navigates, sets metronome
6. Between exercises: quick coach tip
7. End: summary with stats
```

### Flow D: Proactive Coach (Dashboard Integration)
```
1. User opens app (dashboard)
2. AI Coach card shows contextual message:
   - Morning: "Good morning! Ready for Day 12 of your streak?"
   - After long break: "Welcome back! Let's ease in with a warm-up."
   - After milestone: "You hit 160 BPM on Spider Walk! New record."
   - Category alert: "You haven't done Ear Training in 8 days."
3. Each message has a CTA button:
   - [Start Warm-Up] [Open Exercise] [Start AI Session]
4. Tapping the coach avatar opens full chat
```

---

## 6. Technical Architecture

### AI Coach Upgrade
```
Current:  User -> AiCoachPage -> /api/coach -> Claude Haiku (basic chat)
Proposed: User -> AiCoachPage -> /api/coach -> Claude Haiku (with tools)
                                                    |
                                            Tool calls:
                                            - generateBackingTrack
                                            - getExerciseRecommendations
                                            - analyzePracticeData
                                            - buildWeeklyPlan
                                                    |
                                            Results sent back to Claude
                                            for natural language response
```

### Suno Integration Architecture
```
Current:  Component -> /api/suno (generate only) -> sunoapi.org
Proposed: Component -> /api/suno/* (multiple endpoints) -> sunoapi.org
                           |
                    /api/suno/generate  (existing)
                    /api/suno/extend    (new)
                    /api/suno/separate  (new)
                    /api/suno/cover     (new)
                    /api/suno/midi      (new)
                           |
                    All results cached in IndexedDB (with blobs)
                    Track metadata in localStorage for quick access
```

### Credit Budget Strategy
```
50 credits/day, ~10 credits per generation = 5 generations/day

Proposed allocation:
- 2 generations for exercise backing tracks (auto-cached, reused)
- 1 generation for song practice (stems or backing)
- 1 generation for coach-requested tracks
- 1 reserve for extend/cover/restyle

Smart caching reduces actual usage:
- Same exercise + same settings = cache hit (0 credits)
- "Generate on channel change" = 3 tracks/week max
- Extend is cheaper than regenerate
- Stems are one-time per song
```

---

## 7. Implementation Order

| Phase | Items | Timeline | Impact |
|---|---|---|---|
| **Week 1** | 3.1 (server AI key), 3.2 (rich context), 3.3 (blob fix), 3.4 (smart dashboard) | 3-4 days | Coach becomes usable for everyone |
| **Week 2** | 3.7 (coach tools), 3.8 (exercise recommendations), 3.9 (proactive coaching) | 4-5 days | AI feels integrated, not isolated |
| **Week 3** | 3.5 (vocal separation), 3.6 (extend track) | 3-4 days | Massive value for song learning |
| **Week 4** | 3.10 (re-style), 3.15 (warm-up generator), 3.12 (AI practice session) | 5-6 days | Premium differentiation |
| **Month 2** | 3.11 (MIDI/theory), 3.13 (song analysis), 3.14 (recording analysis) | Ongoing | Deep integration |

---

## 8. Success Metrics

- **Coach engagement:** >50% of active users interact with coach weekly
- **Backing track usage:** >3 tracks generated per active user per week
- **AI session adoption:** >30% of practice sessions started via AI recommendation
- **Credit efficiency:** <20 credits/day average per user (caching working)
- **Retention impact:** users who use AI features retain 2x better at 30 days

---

## 9. Summary

The current AI in GuitarForge is functional but disconnected. Suno generates tracks but feels like a separate tool. The Coach responds to questions but can't take action. Neither system is aware of the other.

The vision: AI should be the connective tissue of the app. The Coach knows what you practiced, suggests what to do next, generates the backing track you need, and guides your session. Suno is not a "generate and listen" tool — it's the engine that powers personalized practice material. Every surface of the app should have AI-powered suggestions that feel natural and helpful, not bolted on.

**Three biggest wins for minimal effort:**
1. Server-side API key for Coach (removes all friction)
2. Rich practice context sent to Coach (makes responses actually useful)
3. Vocal separation for songs (killer feature no competitor has built-in)
