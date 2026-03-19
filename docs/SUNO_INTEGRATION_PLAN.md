# Suno AI Integration Plan for GuitarForge

## 1. Suno API Capabilities (Research Summary)

### API Status
Suno does **not** offer an official public API. The ecosystem relies on unofficial reverse-engineered wrappers. GuitarForge already uses the **gcui-art/suno-api** self-hosted wrapper (see `src/lib/suno.ts`), which is the most established open-source option.

### Available Endpoints (gcui-art/suno-api)
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/generate` | POST | Simple generation from text prompt |
| `/api/custom_generate` | POST | Custom Mode — control lyrics, style tags, title, instrumental flag |
| `/api/generate_lyrics` | POST | Generate lyrics from a prompt |
| `/api/get?ids=` | GET | Poll clip status and retrieve audio URLs |
| `/api/get_limit` | GET | Check remaining credits |
| `/api/extend_audio` | POST | Extend an existing clip's length |

**GuitarForge currently uses:** `custom_generate`, `get` (polling), and `get_limit`.

### Controllable Parameters
| Parameter | Description | Notes |
|---|---|---|
| `tags` | Style/genre descriptor string | Primary way to control genre, tempo, key, instruments |
| `title` | Track title | Metadata only |
| `prompt` | Lyrics text | Empty string for instrumentals |
| `make_instrumental` | Boolean | **true** = no vocals. Already set in our code. |
| `mv` | Model version | "chirp-crow" for v5, default varies by wrapper version |
| `wait_audio` | Boolean | false = async polling (our approach), true = synchronous |

### What You CAN Control via Tags/Prompt
- **Genre/style**: "thrash metal", "blues rock", "progressive metal", "djent"
- **Tempo**: "120 BPM", "fast tempo", "slow groove"
- **Key**: "A minor", "E major" (advisory, not guaranteed)
- **Instruments**: "drums and bass only", "rhythm guitar", "no lead guitar"
- **Mood**: "aggressive", "melancholic", "energetic"
- **No vocals**: Already handled via `make_instrumental: true`

### What You CANNOT Reliably Control
- Exact BPM (it's a suggestion, not a guarantee)
- Exact key signature (Suno interprets loosely)
- Exact chord progressions
- Precise song structure (verse/chorus/bridge)
- Specific time signatures (4/4 is default; odd meters are hit-or-miss)

### Generation Details
| Aspect | Value |
|---|---|
| Generation time | 30-90 seconds typical |
| Output format | MP3 (192kbps, 48kHz) |
| WAV available | Via separate conversion endpoint |
| Default clip length | ~2 minutes |
| Extension | Can extend clips via `/api/extend_audio` |

### Model Versions Available
- V4, V4.5, V4.5 Plus, V4.5 All, V5 (latest)
- V5 has best quality but may cost more credits
- Our current code does not specify `mv`, so it uses the wrapper's default

---

## 2. Credit System

### Suno Subscription Tiers
| Plan | Monthly Cost | Credits/Month | Concurrent Jobs | Commercial Use |
|---|---|---|---|---|
| Free | $0 | 50/day (replenishes daily) | 2 | No |
| Pro | $10/mo ($8/mo annual) | 2,500/mo | 5 | Yes |
| Premier | $30/mo ($24/mo annual) | 10,000/mo | 10 | Yes |

### Cost Per Generation
- ~5 credits per short clip (~30 seconds)
- ~10 credits per standard clip (~2 minutes)
- Effective cost: ~$0.03-$0.04 per song on Premier tier

### Credit Optimization Strategies
1. **Cache everything** — never regenerate a track that already exists
2. **Use short clips** — 30-second loops are enough for most exercises
3. **Batch wisely** — generate all weekly tracks in one session
4. **Free tier math**: 50 credits/day = ~5 tracks/day = ~35 tracks/week
5. **Show credit count** in UI before generation (already have `GET /api/suno`)
6. **Confirm before generating** — prevent accidental clicks

---

## 3. Existing Implementation (What's Already Built)

### Files
- **`src/lib/suno.ts`** — API client with `generateTrack()`, `pollClips()`, `checkCredits()`, `buildPrompt()`
- **`src/app/api/suno/route.ts`** — Next.js API route (POST to generate, GET to check credits)
- **`src/components/StudioPage.tsx`** — Studio UI with Suno panel (key, mode, style, BPM inputs + generate button)

### Current Prompt Building (`buildPrompt()`)
```
"{scale}, {mode}, {style}, instrumental, guitar practice backing track, no vocals, no lead guitar, {bpm} BPM"
```
Example output: `"Am, Phrygian, Metal, instrumental, guitar practice backing track, no vocals, no lead guitar, 120 BPM"`

### Current Flow
1. User fills in Key, Mode, Style, BPM in Studio panel
2. Clicks "Generate Track"
3. POST to `/api/suno` → calls `custom_generate` with `make_instrumental: true`
4. Polls every 5 seconds for up to 2 minutes
5. On completion, adds track to Studio timeline as type `"suno"`

### What's Missing
- No caching of generated tracks
- No connection to Dashboard Channel Settings (mode, scale, style)
- No integration with Exercise Modal
- No credit display before generation
- No error recovery or retry
- Free-text inputs instead of dropdowns (typo-prone)
- No model version selection

---

## 4. Integration Ideas — Analysis

### Idea 1: Smart Backing Tracks (from Channel Settings)
**Concept:** Dashboard Channel Settings (key, mode, style) automatically pre-fill Suno generation params everywhere.

**Implementation:**
- Channel Settings state already exists: `mode`, `scale`, `style` in `GuitarForgeApp.tsx` (line 25-27)
- Pass these as props/context to Studio and Exercise Modal
- Pre-fill Suno inputs with Channel Settings values
- User can override per-generation

**Effort:** Low — wiring existing state to existing UI
**Value:** High — removes friction, ensures musical consistency across practice session
**Credits:** Same as current (user-initiated generation)

### Idea 2: Exercise-Specific Backing Tracks
**Concept:** Exercises with `bt: true` get a "Generate Backing Track" button in the Exercise Modal.

**Implementation:**
- Exercise Modal already shows exercise details (category, BPM range, styles)
- Add a "Generate Backing Track" button for `bt: true` exercises
- Use exercise's `b` (BPM range — parse midpoint), `styles[]`, and Channel Settings key/mode
- Cache generated audio URL in localStorage keyed by `exercise.id + scale + mode + style + bpm`
- Play inline via `<audio>` element or route to Studio

**Effort:** Medium
**Value:** Very High — this is the killer feature for a practice app
**Credits:** Could be expensive if users generate for many exercises. Caching is critical.

**Cache Key Format:** `suno_cache_{exerciseId}_{scale}_{mode}_{style}_{bpm}`

### Idea 3: Song-Style Backing Tracks
**Concept:** Generate backing track "in the style of" a song from the Song Library.

**Implementation:**
- `SongEntry` type has `genre`, `tempo`, `key` fields
- Build prompt: `"{key}, {genre}, in the style of {artist}, instrumental backing track, no vocals"`
- Legal concern: "in the style of" is legally gray — Suno may produce something too similar

**Effort:** Medium
**Value:** Medium — fun but legally risky, and Suno's interpretation may not match expectations
**Credits:** High risk of multiple retries to get something usable
**Recommendation:** Deprioritize. Offer as "inspired by" with a disclaimer.

### Idea 4: Weekly Practice Soundtrack
**Concept:** Auto-generate a set of backing tracks for the week based on Channel Settings.

**Implementation:**
- On Channel Settings change, offer "Generate Weekly Tracks" button
- Generate tracks for each practice category: warm-up (slow), technique (medium), improv (open)
- Store in IndexedDB (larger than localStorage allows)
- Display in Dashboard as a "Weekly Backing Tracks" panel

**Effort:** High
**Value:** High — but risky credit burn
**Credits:** ~15-20 credits per week (3-4 tracks × 5 credits each)
**Recommendation:** Phase 2. Requires good caching and credit management first.

### Idea 5: Custom Jam Generator
**Concept:** Free-text prompt input: "12-bar blues in E, slow tempo, walking bass"

**Implementation:**
- Simple text input → POST to `/api/suno` with raw prompt as tags
- No structured params needed (Suno handles free-text well)
- Could live in Studio or as a standalone "Jam" section

**Effort:** Very Low — essentially what Studio already does but with free text
**Value:** Medium — power-user feature
**Credits:** User-controlled
**Recommendation:** Easy win. Add a "Custom Prompt" toggle to existing Studio Suno panel.

---

## 5. Recommended Implementation Priority

### Phase 1: Foundation (Low effort, high impact)
1. **Wire Channel Settings to Studio Suno panel** — pre-fill key/mode/style from Dashboard
2. **Replace free-text inputs with dropdowns** — use SCALES, MODES, STYLES from constants.ts
3. **Show credit balance** before generation (already have the endpoint)
4. **Add confirmation dialog** — "This will use ~10 credits. You have 42 remaining."
5. **Add Custom Prompt toggle** — free-text alternative to structured inputs

### Phase 2: Exercise Integration (Core feature)
1. **Add "Generate Backing Track" button to Exercise Modal** for `bt: true` exercises
2. **Build prompt from exercise metadata** — BPM midpoint, styles, channel key/mode
3. **IndexedDB cache layer** — store generated audio blobs keyed by params
4. **Inline audio player** in Exercise Modal — play cached track during practice
5. **"Open in Studio" button** — send generated track to Studio for mixing

### Phase 3: Smart Features (Polish)
1. **Weekly batch generation** — generate tracks for the week in one go
2. **Generation presets** — save favorite prompt configurations
3. **Model version selector** — let user choose V4.5 vs V5 (quality vs credits)
4. **Track rating** — thumbs up/down to learn what prompts work
5. **Extend audio** — use `/api/extend_audio` for longer practice sessions

---

## 6. Technical Architecture

### Cache Layer (IndexedDB)
```
Database: guitarforge_suno_cache
Store: tracks
  Key: "{exerciseId}_{scale}_{mode}_{style}_{bpm}" or "{customHash}"
  Value: {
    id: string,          // Suno clip ID
    audioBlob: Blob,     // Downloaded MP3 data
    audioUrl: string,    // Original Suno URL (expires)
    params: { scale, mode, style, bpm },
    createdAt: number,
    duration: number,
    title: string
  }
```

Why IndexedDB over localStorage:
- localStorage has ~5-10MB limit
- A single MP3 is ~2-4MB
- IndexedDB can store hundreds of MB

### Prompt Engineering Templates

**Warm-Up / Slow Practice:**
```
"{scale} {mode}, slow {style}, 60 BPM, instrumental, drums and bass only, simple groove, no lead guitar, practice backing track"
```

**Technique / Medium Tempo:**
```
"{scale} {mode}, {style}, {bpm} BPM, instrumental, rhythm guitar and drums, driving rhythm, no lead guitar, guitar practice backing track"
```

**Improv / Jam:**
```
"{scale} {mode}, {style}, {bpm} BPM, instrumental, full band, open feel, jam track, no vocals, no lead guitar"
```

**Genre-Specific Templates:**

| Style | Prompt Additions |
|---|---|
| Metal | "heavy distorted rhythm guitar, double bass drums, aggressive" |
| Blues | "12-bar blues feel, shuffled drums, warm clean guitar" |
| Jazz | "walking bass, brush drums, jazz comping guitar" |
| Djent | "polyrhythmic, 8-string guitar, tight palm mutes" |
| Neo-Classical | "orchestral, harpsichord, dramatic, classical influenced" |
| Funk | "slap bass, wah guitar, tight groove, syncopated" |

### API Route Enhancements Needed

**`POST /api/suno` — Enhanced request body:**
```typescript
{
  scale: string,
  mode: string,
  style: string,
  bpm?: number,
  title?: string,
  template?: "warmup" | "technique" | "improv" | "jam",  // NEW
  customPrompt?: string,                                   // NEW
  exerciseId?: number,                                      // NEW (for cache key)
  mv?: string                                               // NEW (model version)
}
```

**`GET /api/suno` — Already returns credits. No changes needed.**

### UI Placement

| Feature | Location | Component |
|---|---|---|
| Studio Suno panel | Already exists | `StudioPage.tsx` |
| Exercise backing track | Exercise Modal | `ExerciseModal.tsx` |
| Credit display | Navbar or Dashboard | `Navbar.tsx` or `GuitarForgeApp.tsx` |
| Weekly generation | Dashboard | `GuitarForgeApp.tsx` |
| Cache management | Profile/Settings | `ProfilePage.tsx` |

---

## 7. Prompt Engineering Best Practices (Research)

### Do's
- **Be specific with genre**: "thrash metal" not just "metal"
- **Name specific instruments**: "palm-muted rhythm guitar, double kick drums, growling bass"
- **Include BPM**: Even though not guaranteed, it guides the generation
- **Add "no vocals, no lead guitar"**: Even with `make_instrumental: true`, reinforce in tags
- **Use mood descriptors**: "aggressive", "melancholic", "uplifting" help set the vibe
- **Keep prompts under ~200 characters**: Suno ignores overly long prompts

### Don'ts
- Don't over-specify: "120 BPM, 4/4 time, Dm, verse-chorus-verse, 8 bars intro..." = mechanical results
- Don't reference specific copyrighted songs by name in the prompt
- Don't expect exact BPM or key — treat as guidance
- Don't use contradictory terms: "fast slow heavy light"

### Recommended `buildPrompt()` Upgrade
Current prompt is decent but could be improved with templates:

```
Current:  "Am, Phrygian, Metal, instrumental, guitar practice backing track, no vocals, no lead guitar, 120 BPM"
Improved: "A Phrygian, aggressive thrash metal, 120 BPM, heavy palm-muted rhythm guitar, double bass drums, instrumental backing track, no vocals, no lead guitar"
```

The key improvement: merge scale+mode into a single musical term ("A Phrygian" not "Am, Phrygian") and add genre-specific instrument descriptors.

---

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| gcui-art/suno-api wrapper breaks (Suno changes internals) | Service down | Monitor wrapper repo for updates; graceful error handling in UI |
| Credit exhaustion | No more generations | Show balance prominently; confirm before each generation; aggressive caching |
| Generated tracks don't match requested key/tempo | Poor practice experience | Caveat in UI: "AI-generated — tempo/key are approximate"; allow retry |
| Audio URL expiration | Cached URLs stop working | Download and cache the MP3 blob in IndexedDB, not just the URL |
| Legal/TOS concerns | Account ban | Use only for personal practice; don't distribute generated tracks |
| Suno quality inconsistent | User frustration | Allow thumbs up/down rating; regenerate with modified prompt |
| IndexedDB storage limits | Cache fills up | Add cache management UI (clear old tracks, set max size) |

---

## 9. Environment Setup Required

```env
# .env.local
SUNO_API_URL=https://your-suno-api-deployment.vercel.app  # gcui-art/suno-api instance
```

The gcui-art/suno-api wrapper requires:
1. A Suno account (free tier works)
2. The wrapper deployed to Vercel or Docker
3. Suno session cookie configured in the wrapper
4. The wrapper handles session keep-alive and CAPTCHA solving automatically

---

## 10. Summary

**What exists:** A working Suno integration in the Studio with basic key/mode/style/BPM inputs and generation.

**Biggest wins to implement next:**
1. Wire Channel Settings → Suno inputs (trivial, high consistency value)
2. Dropdowns instead of free-text (trivial, prevents typos)
3. Credit display + confirmation (easy, prevents waste)
4. Exercise Modal integration with caching (medium effort, killer feature)
5. Improved prompt templates per genre (easy, better generation quality)

**Credit budget on free tier:** ~5 tracks/day, ~35/week. Caching is essential.
