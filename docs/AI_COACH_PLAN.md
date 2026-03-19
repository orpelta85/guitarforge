# AI Guitar Coach — Planning Document

**Date:** 2026-03-19
**Status:** Research & Planning (not yet implemented)

---

## 1. Current State Analysis

### What Exists Today

The current `AiCoachPage.tsx` is a **static plan picker** — not a true AI coach. It:
- Reads user profile from `localStorage("gf-profile")`
- Offers 4 hardcoded `PLAN_TEMPLATES`: Beginner Rock, Shred Builder, Blues Master, Metal Technique
- Suggests a plan based on profile genres/level
- Stores active plan in `localStorage("gf-active-plan")`
- No conversational AI, no audio analysis, no dynamic recommendations

### Data Available in the App

| Data Source | localStorage Key | Contents |
|---|---|---|
| User profile | `gf-profile` | name, instrument, level, yearsPlaying, genres[], goals, practiceHoursPerDay, favoriteArtists, equipment |
| Main app state | `gf30` | week, mode, scale, style, dayCats, dayHrs, dayExMap, doneMap, bpmLog, noteLog, songs, songProgress, exEdits, customSongs |
| Recordings | `gf-recordings` | Array of `{ dt, d (base64 audio), id?, name? }` |
| Active plan | `gf-active-plan` | Current practice plan JSON |
| Learning state | `gf-learn` | Lesson progress, ear training scores |
| Drum patterns | `gf-studio-drums` | Studio drum machine state |
| Weekly archive | `gf-archive` | Up to 52 weeks of archived practice data |

### Exercise Library
- **67 exercises** across 23 categories (Warm-Up, Shred, Legato, Bends, Tapping, Sweep, Rhythm, Fretboard, Ear Training, Improv, Riffs, Phrasing, Modes, Composition, Songs, Dynamics, Chords, Harmonics, Picking, Arpeggios, Slide, Tunings, Keys)
- Each exercise has: id, category, name, minutes, BPM range, description, YouTube query, tips, focus areas, backing track flag, optional AlphaTex notation

### Song Library
- **333 songs** (5 manual + ~328 from Spotify import), merged and deduplicated
- Each song has: title, artist, album, year, genre, difficulty (Beginner/Intermediate/Advanced), tuning, tempo, key, optional Songsterr URL

---

## 2. AI Coach Vision

### What It Should Feel Like

A **personal guitar teacher who lives inside the app**. Not a generic chatbot — a coach that:
- Knows your skill level, goals, and taste
- Sees your practice data (what you did, how fast, how often)
- Builds and adjusts practice routines dynamically
- Recommends songs from the 333-song library that match your level and genre
- Listens to your recordings and gives specific feedback
- Tracks long-term progress and celebrates milestones
- Speaks in Hebrew (UI language) with English music terms

### Core Capabilities (Priority Order)

1. **Conversational coaching** — Ask questions, give advice, build rapport
2. **Practice plan generation** — Dynamic plans from profile + practice data (replaces static templates)
3. **Song recommendations** — From the 333-song library, matched to skill/genre/goals
4. **Practice data analysis** — "You haven't practiced legato in 2 weeks" / "Your BPM on exercise X went from 80 to 120"
5. **Recording feedback** — Pitch accuracy, timing, tone quality analysis
6. **Progress tracking** — Weekly reports, trend analysis, goal tracking

---

## 3. Technical Architecture

### 3.1 Conversational AI — Claude API

**SDK:** `@anthropic-ai/sdk` (official TypeScript SDK)
**Install:** `npm install @anthropic-ai/sdk`

**Architecture:**
```
Browser (React) → Next.js API Route → Claude API → Response streamed back
```

**Implementation:**
- Create `app/api/coach/route.ts` — POST endpoint
- Send user message + context (profile, practice summary, conversation history)
- Stream response back using Claude's streaming API
- Display in chat UI

**Model Selection:**
- **Claude Haiku 4.5** for most conversations — fast, cheap ($1/$5 per MTok)
- **Claude Sonnet 4.5** for complex analysis (practice plan generation, recording feedback) — $3/$15 per MTok
- Route based on message intent (simple question → Haiku, "build me a plan" → Sonnet)

**System Prompt Structure:**
```
[SYSTEM] You are a guitar coach for GuitarForge. Hebrew UI, English music terms.
[CACHED] User profile JSON, exercise library summary, song library summary
[CACHED] Practice data summary (aggregated stats, not raw logs)
[DYNAMIC] Recent conversation history (last 10-20 messages)
[USER] Current message
```

### 3.2 Audio Analysis — Pitch Detection

**For clean guitar (high feasibility):**
- **Library:** `pitchy` (npm) — McLeod Pitch Method, works in browser
- Accuracy: Good for monophonic clean signals
- Detects fundamental frequency (Hz) with clarity score (0-1)
- Can map Hz → note name → compare against expected notes

**For distorted guitar (medium-low feasibility):**
- Distortion adds harmonics that confuse pitch detection
- Second harmonic can dominate fundamental
- Octave errors are common
- Possible mitigations: low-pass filter before analysis, use autocorrelation (more robust than FFT for harmonics)
- Realistic expectation: ~70-80% accuracy on moderate gain, ~50-60% on high gain

**For rhythm/timing (medium-high feasibility):**
- Onset detection via spectral flux or energy thresholds
- Compare detected onsets against metronome grid
- Accuracy within ~10-20ms is achievable for clear attacks
- Works better with picked notes than legato

**Tone.js integration:**
- Tone.js `Analyser` provides FFT data but no built-in pitch detection
- Can use Tone.js FFT output as input to pitchy or custom autocorrelation
- Already in the project — no new dependency for FFT

**Recommended approach:**
```
Microphone → Web Audio API → AnalyserNode → pitchy (pitch) + custom onset detector (timing)
                                           ↓
                                    Results JSON → Claude API → Human-readable feedback
```

### 3.3 What's Realistic vs. Science Fiction

| Capability | Feasibility | Notes |
|---|---|---|
| Detect single clean notes | HIGH | pitchy handles this well |
| Detect chords (clean) | MEDIUM | Needs chromagram analysis, partial |
| Detect single distorted notes | MEDIUM | Octave errors common, needs filtering |
| Detect distorted chords | LOW | Too many overlapping harmonics |
| Timing/rhythm accuracy | HIGH | Onset detection is well-solved |
| Tone quality assessment | LOW | Subjective, no reliable automated method |
| "Did you play the right notes?" | MEDIUM | Works for clean monophonic passages against known reference |
| Real-time scrolling feedback (Yousician-style) | HIGH complexity | Needs note-by-note reference, tight sync, significant UI work |
| General "how did that sound?" | MEDIUM | Send audio features (pitch contour, timing) to Claude for interpretation |

**Recommended MVP scope:** Pitch detection on clean guitar + timing analysis. Send results summary to Claude for human-readable feedback. Do NOT attempt Yousician-style real-time scrolling feedback in v1.

---

## 4. Integration Plan

### 4.1 Where the AI Coach Lives in the UI

**Option A: Dedicated page (current `AiCoachPage`)** — Replace the static plan picker with a full chat interface. Coach tab in nav.

**Option B: Chat sidebar/drawer** — Slide-out panel accessible from any page. Can see context of what user is currently doing.

**Option C: Overlay/floating button** — Small FAB in corner, expands to chat.

**Recommendation: Option A for MVP, evolve to A+B.**
- Replace `AiCoachPage.tsx` with a chat-based coach page
- Keep the plan templates as "quick actions" the coach can suggest
- Phase 2: Add a mini-coach sidebar accessible from practice/studio pages

### 4.2 Page Layout

```
┌─────────────────────────────────────────┐
│  AI Practice Coach            [Clear]   │
│  Your personal guitar teacher           │
├─────────────────────────────────────────┤
│                                         │
│  [Coach] Hey! I see you've been         │
│  focusing on Shred exercises this       │
│  week. Your BPM on Chromatic 1-2-3-4   │
│  went from 80 to 105 — solid progress. │
│                                         │
│  [You] What should I practice today?    │
│                                         │
│  [Coach] Based on your schedule and     │
│  recent focus, I'd suggest:             │
│  1. Warm-Up: Spider Exercise (5 min)    │
│  2. Legato: Hammer-Pull Chains (10 min) │
│  3. ...                                 │
│  [Add to today's practice ▶]            │
│                                         │
│  ─── Quick Actions ───                  │
│  [Build Practice Plan] [Recommend Song] │
│  [Analyze Recording] [Weekly Report]    │
│                                         │
├─────────────────────────────────────────┤
│  [Record 🎤]  [Type message...]  [Send] │
└─────────────────────────────────────────┘
```

### 4.3 Data Flow

```
┌──────────────┐
│  localStorage │ ← gf-profile, gf30, gf-recordings, gf-learn, gf-archive
└──────┬───────┘
       │ Read on page load + before each API call
       ▼
┌──────────────┐     ┌───────────────┐
│  Coach Page  │────▶│ /api/coach    │ (Next.js Route Handler)
│  (React)     │◀────│               │
└──────────────┘     └───────┬───────┘
       │                     │
       │                     ▼
       │             ┌───────────────┐
       │             │  Claude API   │
       │             │  (Haiku/Sonnet)│
       │             └───────────────┘
       │
       ▼ (for recording analysis)
┌──────────────┐
│  Web Audio   │ → pitchy (pitch) → onset detector (timing)
│  Analysis    │ → Results JSON → sent to Claude with next message
└──────────────┘
```

### 4.4 API Route Design

**`POST /api/coach`**

Request body:
```typescript
{
  messages: ChatMessage[],        // conversation history
  context: {
    profile: UserProfile,         // from gf-profile
    practiceStats: PracticeSummary, // aggregated from gf30
    recentExercises: string[],    // last 7 days
    bpmProgress: BpmSummary[],    // key exercises + BPM trends
    streakDays: number,
    weeklyMinutes: number,
    audioAnalysis?: {             // if recording was analyzed
      pitchAccuracy: number,      // 0-100%
      timingAccuracy: number,     // 0-100%
      detectedNotes: string[],
      tempoEstimate: number,
    }
  },
  action?: "plan" | "song" | "analyze" | "report" | "chat"
}
```

Response: Streamed Claude response (text/event-stream)

### 4.5 Conversation History Storage

- Store in `localStorage("gf-coach-history")`
- Keep last 50 messages max
- On each API call, send last 10-20 messages as conversation context
- Periodically ask Claude to summarize older conversation into a "memory" block
- Memory block cached in system prompt for continuity

### 4.6 Context Summarization Strategy

To minimize tokens, do NOT send raw localStorage data. Build summaries:

```typescript
function buildPracticeSummary(appData: AppData): PracticeSummary {
  return {
    totalExercisesDone: Object.keys(appData.doneMap).filter(k => appData.doneMap[k]).length,
    categoriesThisWeek: [...new Set(/* extract categories from doneMap keys */)],
    bpmHighlights: /* top 5 exercises with biggest BPM gains */,
    streakDays: /* calculate from doneMap dates */,
    weakAreas: /* categories not practiced in 14+ days */,
    currentWeek: appData.week,
    currentMode: appData.mode,
    currentScale: appData.scale,
    currentStyle: appData.style,
  };
}
```

---

## 5. Cost Analysis

### Per-Conversation Estimates

| Component | Tokens | Cost (Haiku) | Cost (Sonnet) |
|---|---|---|---|
| System prompt | ~800 | cached: $0.00008 | cached: $0.00024 |
| User profile + practice summary | ~500 | cached: $0.00005 | cached: $0.00015 |
| Exercise library summary | ~2,000 | cached: $0.0002 | cached: $0.0006 |
| Song library summary | ~1,500 | cached: $0.00015 | cached: $0.00045 |
| Conversation history (20 msgs) | ~3,000 | $0.003 | $0.009 |
| User message | ~100 | $0.0001 | $0.0003 |
| Response (avg) | ~500 | $0.0025 | $0.0075 |
| **Total per message** | | **~$0.006** | **~$0.018** |

### Monthly Estimates (per user)

| Usage Pattern | Messages/Month | Monthly Cost (Haiku) | Monthly Cost (Sonnet) |
|---|---|---|---|
| Light (2 msgs/day) | 60 | $0.36 | $1.08 |
| Medium (5 msgs/day) | 150 | $0.90 | $2.70 |
| Heavy (10 msgs/day) | 300 | $1.80 | $5.40 |

### Cost Optimization Strategies

1. **Use Haiku by default** — Route 80% of messages to Haiku ($1/$5 per MTok). Only use Sonnet for complex tasks (plan generation, detailed analysis).
2. **Prompt caching** — Cache system prompt + exercise/song library summaries. Reduces input cost by 90% for cached portions. Cache write is 25% premium, but cache reads are 10% of base cost.
3. **Summarize context aggressively** — Never send raw exercise list (67 exercises = ~8K tokens). Send a compressed summary (~2K tokens).
4. **Conversation memory** — Every 20 messages, ask Claude to compress conversation into a ~200 token summary. Use that instead of full history.
5. **Rate limiting** — Cap at 20 messages/hour per user to prevent abuse.
6. **Client-side intent detection** — Simple keyword matching to route "quick" questions to Haiku, complex ones to Sonnet.

### Feasibility for Free App

At Haiku rates with caching, a light user costs ~$0.36/month. This is viable if:
- The app has a freemium model (free tier: 10 messages/day, pro: unlimited)
- Or the developer absorbs cost for a small user base (<100 users = ~$36/month)
- Or the user provides their own API key (power-user option)

**Recommendation:** Start with "bring your own API key" model. Add a hosted option later if user base grows.

---

## 6. Recording Analysis Flow

### Step-by-Step Process

1. User records in Studio or via coach page microphone button
2. Audio captured as `Blob` / base64 (already working in `StudioPage.tsx`)
3. Client-side analysis pipeline runs:
   ```
   AudioBuffer → pitchy.findPitch() at 50ms intervals → note sequence
   AudioBuffer → onset detection → timing grid
   ```
4. Analysis results packaged as JSON:
   ```json
   {
     "duration": 12.5,
     "detectedNotes": ["E4", "G4", "A4", "E4", "B3", ...],
     "noteTimings": [0.0, 0.25, 0.52, 0.76, 1.01, ...],
     "pitchAccuracy": 82,
     "timingDeviation": { "mean": 18, "max": 45, "unit": "ms" },
     "tempoEstimate": 120,
     "clarity": 0.78
   }
   ```
5. JSON sent to Claude with context: "The user just played exercise X (expected notes: ..., expected BPM: ...)"
6. Claude returns human-readable feedback in Hebrew

### What We Do NOT Send to Claude
- Raw audio data (too large, Claude can't process audio)
- Full waveform arrays
- We only send the **analysis summary** (small JSON)

### Clean vs. Distorted Guitar Strategy

| Signal Type | Strategy |
|---|---|
| Clean electric | Full pitch + timing analysis. High confidence. |
| Acoustic | Full analysis. Very good accuracy. |
| Light overdrive | Pitch analysis with low-pass pre-filter. Medium confidence. |
| High gain distortion | Timing/rhythm only. Skip pitch detection. Tell user: "For best note feedback, record clean." |

---

## 7. New Types & Interfaces

```typescript
// New types to add to src/lib/types.ts

interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  audioAnalysis?: AudioAnalysisResult;
}

interface AudioAnalysisResult {
  duration: number;
  detectedNotes: string[];
  noteTimings: number[];
  pitchAccuracy: number;
  timingDeviation: { mean: number; max: number };
  tempoEstimate: number;
  clarity: number;
  signalType: "clean" | "distorted" | "acoustic" | "unknown";
}

interface PracticeSummary {
  totalExercisesDone: number;
  categoriesThisWeek: string[];
  bpmHighlights: { exercise: string; from: number; to: number }[];
  streakDays: number;
  weakAreas: string[];
  currentWeek: number;
  currentMode: string;
  currentScale: string;
  currentStyle: string;
  weeklyMinutes: number;
}

interface CoachState {
  messages: CoachMessage[];
  memory: string;           // compressed summary of older conversation
  lastSummaryAt: number;    // message index of last compression
}
```

---

## 8. New Dependencies

| Package | Purpose | Size | Required |
|---|---|---|---|
| `@anthropic-ai/sdk` | Claude API client | ~200KB | Yes |
| `pitchy` | Pitch detection (McLeod method) | ~15KB | Yes |
| — | Onset detection | Custom (~100 lines) | Built in-house |

**No other new libraries needed.** Tone.js (already installed) provides FFT data. Web Audio API (browser-native) provides microphone access.

---

## 9. Environment Variables

```env
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

The API key must NEVER be exposed to the client. All Claude API calls go through the Next.js route handler (`/api/coach`).

---

## 10. Implementation Phases

### Phase 1 — Conversational Coach (MVP)
**Effort: 2-3 days**

- [ ] Install `@anthropic-ai/sdk`
- [ ] Create `app/api/coach/route.ts` with streaming response
- [ ] Build system prompt with profile + practice summary context
- [ ] Replace `AiCoachPage.tsx` with chat interface
- [ ] Implement conversation history in localStorage (`gf-coach-history`)
- [ ] Add quick action buttons: "Build Plan", "Recommend Song", "Weekly Report"
- [ ] Context summarization function (`buildPracticeSummary`)
- [ ] Prompt caching for system prompt + library summaries

### Phase 2 — Smart Recommendations
**Effort: 1-2 days**

- [ ] Song recommendation tool: Coach searches 333-song library by genre/difficulty/key
- [ ] Exercise recommendation: Coach picks from 67 exercises based on gaps in practice
- [ ] "Add to today's practice" action from coach suggestions
- [ ] Dynamic plan generation (replace hardcoded templates)

### Phase 3 — Recording Analysis
**Effort: 3-4 days**

- [ ] Install `pitchy`
- [ ] Build audio analysis pipeline (pitch detection + onset detection)
- [ ] Add microphone recording button to coach page
- [ ] Pre-filter for distorted signals (low-pass)
- [ ] Signal type detection (clean/distorted/acoustic)
- [ ] Package analysis results as JSON
- [ ] Send to Claude with exercise context for feedback
- [ ] Display feedback with pitch accuracy % and timing deviation

### Phase 4 — Long-Term Intelligence
**Effort: 2-3 days**

- [ ] Conversation memory compression (summarize every 20 messages)
- [ ] Weekly progress reports (auto-generated)
- [ ] Trend analysis: "Your legato speed improved 15% this month"
- [ ] Goal tracking: "You wanted to master sweep picking — here's where you are"
- [ ] Practice streak awareness and motivation
- [ ] Archive analysis (up to 52 weeks of history from `gf-archive`)

### Phase 5 — Sidebar Integration
**Effort: 1-2 days**

- [ ] Mini-coach sidebar accessible from practice/studio pages
- [ ] Context-aware: knows which exercise/song user is currently viewing
- [ ] Quick feedback: "How was that?" button after completing an exercise

**Total estimated effort: 9-14 days**

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| API costs spiral | HIGH | Rate limiting, BYOK model, Haiku default, aggressive caching |
| Pitch detection unreliable on distorted guitar | MEDIUM | Clearly communicate limitations. Default to timing-only for high gain. |
| API key exposure | HIGH | Server-side route handler only. Never send key to client. |
| localStorage quota exceeded (conversation history) | LOW | Cap at 50 messages, compress regularly |
| Latency on Claude responses | MEDIUM | Streaming responses, optimistic UI, loading indicators |
| User expects Yousician-level real-time feedback | HIGH | Set expectations in UI. "Record and analyze" not "play along with feedback" |
| Hebrew prompt quality | MEDIUM | Test Hebrew system prompts thoroughly. Claude handles Hebrew well. |

---

## 12. Open Questions

1. **BYOK vs. hosted API key?** — BYOK is simpler to start but adds friction. Hosted is smoother UX but costs money.
2. **Should the coach page replace the current AiCoachPage entirely?** — Yes, the static templates add no value once the AI can generate dynamic plans.
3. **Supabase integration?** — When Supabase is added, conversation history and practice data move from localStorage to the database. The coach API route would read from Supabase instead. Plan for this abstraction now.
4. **Voice input?** — Browser Speech Recognition API could let users talk to the coach instead of typing. Low effort, high UX value. Consider for Phase 2.
5. **Offline mode?** — Coach requires internet (API calls). Should we cache the last generated plan for offline use? Probably yes.
