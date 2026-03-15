# GuitarForge v3 — Full Implementation Specification
## For Claude Code — Complete Build Guide

---

## 1. PROJECT OVERVIEW

GuitarForge is an advanced guitar practice management platform for metal/rock guitarists. This spec covers the complete upgrade from the current working Next.js prototype to a full-featured application.

**Current state:** Working Next.js 16 + TypeScript + Tailwind app with 67 exercises, progressive metronome, timer, recorder, song tracking, and weekly reports. All data in localStorage.

**Target:** Full-stack app with external API integrations, Guitar Pro tab rendering, built-in ear training, DAW recording, AI backing tracks, and knowledge base.

---

## 2. TECH STACK

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js (App Router) | 16.x | React SSR/SSG, API routes |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Backend | Supabase | Latest | Auth, PostgreSQL, Storage, Edge Functions |
| Audio Engine | Tone.js | 14.x | Metronome, synth, effects, ear training |
| Tab Renderer | @coderline/alphatab | 1.x | Guitar Pro file rendering + MIDI playback |
| DAW | waveform-playlist | 4.x | Multi-track editor |
| Waveform | wavesurfer.js | 7.x | Waveform visualization + regions |
| Music Theory | tonal | 6.x | Scales, chords, intervals, keys, modes |
| Chord Diagrams | SVGuitar | Latest | SVG chord chart rendering |
| Fretboard | fretboard.js | Latest | Interactive fretboard visualization |
| YouTube | react-youtube | Latest | YouTube embed with programmatic control |
| Pitch Detection | pitchy | Latest | Guitar tuner, intonation feedback |
| SoundFont | soundfont-player | 0.12.x | Realistic instrument playback for ear training |
| MP3 Export | lamejs | Latest | Client-side WAV-to-MP3 |
| Charts | recharts | Latest | Weekly report charts |
| AI Music | Suno API | Latest | AI backing track generation |
| Deployment | Vercel | Latest | Edge, CDN, serverless |

---

## 3. EXTERNAL API INTEGRATIONS

### 3.1 Chords API (FREE, No Auth) — PRIMARY CHORD SOURCE
- **Base URL:** `https://chords.alday.dev/`
- **Endpoints:**
  - `GET /chords` — list all chords
  - `GET /chords/{key}` — chords by key (e.g., `/chords/A`)
  - `GET /chords/{key}/{suffix}` — specific chord (e.g., `/chords/A/minor`)
- **Response format:**
```json
{
  "key": "C", "suffix": "major",
  "positions": [{
    "frets": [0, 3, 2, 0, 1, 0],
    "fingers": [0, 3, 2, 0, 1, 0],
    "baseFret": 1,
    "barres": [],
    "midi": [48, 52, 55, 60, 64, 67]
  }]
}
```
- **Integration:** Cache all chord data locally on first load. Use for chord diagrams, knowledge base, and ear training chord playback.
- **Proxy:** `app/api/chords/route.ts` — server-side fetch to avoid CORS issues

### 3.2 Songsterr API (FREE, Unofficial, No Auth)
- **Search:** `GET https://www.songsterr.com/a/ra/songs.json?pattern={query}`
- **Song details:** `GET https://www.songsterr.com/a/ra/songs/{id}.json`
- **Player data:** `GET https://www.songsterr.com/a/ra/player/song/{id}.json`
- **Response includes:** song ID, title, artist, tracks (instrument, tuning, difficulty)
- **CORS:** No CORS headers — MUST proxy server-side
- **Proxy:** `app/api/songsterr/route.ts`
- **Guitar Pro files:** Player data may contain revision URLs pointing to `.gp5`/`.gpx` files at `gp.songsterr.com`
- **Integration:** Search songs, get metadata, link to Songsterr player, attempt GP file fetch for alphaTab rendering
- **Limitation:** Unofficial API, may break. iframe embedding blocked by X-Frame-Options.

### 3.3 YouTube Integration (TWO PARTS)

#### 3.3.1 YouTube IFrame Player API (FREE, No Key)
- **Package:** `react-youtube`
- **Capabilities:** Embed videos with full programmatic control
- **Key methods:**
  - `player.playVideo()` / `pauseVideo()` / `seekTo(seconds)`
  - `player.setPlaybackRate(rate)` — 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2
  - `player.loadVideoById({videoId, startSeconds, endSeconds})`
  - `player.getCurrentTime()` / `getDuration()`
- **A-B Loop:** Custom implementation — poll `getCurrentTime()` every 250ms, seek back to A when reaching B
- **Usage:** Embed backing tracks and tutorial videos in the exercise player
- **Limitation:** Cannot extract audio (DRM). iframe must be visible (min 200x200).

#### 3.3.2 YouTube Data API v3 (FREE with Key, 10K quota/day)
- **Search endpoint:** `GET https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q={query}&key={KEY}`
- **Cost:** 100 quota units per search call = ~100 searches/day on free tier
- **Proxy:** `app/api/youtube/route.ts` — keeps API key server-side
- **Caching:** Cache results in Supabase `youtube_cache` table (query → results JSON, TTL 24h)
- **Strategy:** Pre-populate common searches (backing tracks per scale/mode), cache aggressively, let users paste URLs directly (zero quota cost)

### 3.4 alphaTab — Guitar Pro Renderer (Open Source, MPL-2.0)
- **Package:** `@coderline/alphatab`
- **Supported formats:** .gp3, .gp4, .gp5, .gpx, .gp, MusicXML, AlphaTex
- **Key features:**
  - SVG/Canvas rendering of tab + standard notation
  - Built-in MIDI synthesizer (alphaSynth) using SoundFont2
  - Speed control (25%-150%)
  - A-B loop (mark start/end, repeat)
  - Track isolation (mute/solo per track)
  - Beat cursor following playback
  - Transpose/capo support
  - All guitar notation: bends, slides, hammer-ons, pull-offs, vibrato, harmonics, palm muting, tremolo, whammy
- **AlphaTex markup for exercises:**
```
\title "Pentatonic Exercise"
\tempo 90
.
:8 5.6 8.6 5.5 7.5 | 5.4 7.4 5.3 7.3 | 5.2 8.2 5.1 8.1 |
```
  - `fret.string` notation: `5.6` = fret 5, string 6 (low E)
  - `:8` = eighth note, `:4` = quarter, `:16` = sixteenth
  - Effects: `{b (0 4)}` bend, `{h}` hammer-on, `{p}` pull-off, `{s}` slide, `{v}` vibrato, `{pm}` palm mute
- **Next.js integration:** Client-side only (no SSR). Dynamic import with `ssr: false`. Web Workers for audio synthesis. Font files + SoundFont in `/public/`.
- **Bundle size:** ~1-2 MB minified. Lazy load only when needed.
- **SoundFont:** Required for playback. Host in `/public/soundfonts/`. 5-20 MB.

### 3.5 Suno API — AI Backing Track Generation
- **Access options:**
  - Official Suno API (apply at suno.com/api) — proper API key auth
  - Unofficial wrapper: `gcui-art/suno-api` (GitHub, 5K+ stars) — cookie-based, fragile
- **Key endpoints:**
  - `POST /api/custom_generate` — generate with lyrics, style tags, title
  - `POST /api/generate` — text-to-music
  - `GET /api/get?ids={id}` — poll generation status
  - `POST /api/extend_audio` — extend existing track
- **Controllable parameters:**
  - `tags`: style/genre (e.g., "blues", "metal", "jazz", "instrumental")
  - `make_instrumental: true` — no vocals
  - Prompt: describe BPM, key, mode, instruments (approximate adherence)
- **Prompt template for GuitarForge:**
  `"{scale} {mode}, {bpm} BPM, {style}, instrumental, guitar practice backing track, no vocals, no lead guitar"`
- **Audio output:** MP3, up to ~4 min per generation, 44.1kHz
- **Credits:** Free tier: 50 credits/day (~5 songs). Pro: $10/mo, 2500 credits.
- **Caching:** Download and store in Supabase Storage. URLs expire.
- **Stem separation:** Not built into Suno. Use Demucs (server-side Python) for separating drums/bass/guitar/other.
- **Proxy:** `app/api/suno/route.ts`

### 3.6 tonal — Music Theory Engine (Local Library, No API)
- **Package:** `tonal` (npm)
- **Capabilities:**
  - `Scale.get("A minor")` → notes, intervals, type
  - `Chord.get("Am7")` → notes, intervals, quality
  - `Chord.detect(["A","C","E"])` → ["Am"]
  - `Scale.detect(["C","D","E","F","G","A","B"])` → ["C major"]
  - `Key.majorKey("G")` → all diatonic chords, secondary dominants
  - `Interval.distance("C4", "E4")` → "3M"
  - `Note.midi("A4")` → 69
  - 80+ scale types, 100+ chord types, all 7 modes
- **Usage:** Backbone for ear training (generate questions), fretboard diagrams, scale/chord lookups, knowledge base

### 3.7 Spotify Web API (OAuth Required) — SECONDARY
- **Useful endpoints:**
  - `GET /v1/search?q={query}&type=track` — search songs
  - `GET /v1/tracks/{id}` — track metadata, 30s preview URL
  - `GET /v1/recommendations` — recommendations with tunable features
- **NOTE:** `audio-features` and `audio-analysis` endpoints DEPRECATED for new apps (Nov 2024)
- **Still useful for:** Song search, artist metadata, 30s preview playback
- **Auth:** OAuth 2.0 Client Credentials for basic access
- **Proxy:** `app/api/spotify/route.ts`

### 3.8 Uberchord API (FREE, No Auth) — FALLBACK CHORD DATA
- **Endpoint:** `GET https://api.uberchord.com/v1/chords/{name}`
- **Returns:** chord name, string positions, fingering, component tones
- **Reliability:** Intermittent availability. Use as fallback behind chords.alday.dev.

---

## 4. FEATURE SPECIFICATIONS

### 4.1 Exercise Player Modal (Enhanced)

The exercise modal is the core UX. When opening an exercise, show a tabbed interface:

**Tab 1: Guitar Pro View (Primary)**
- If exercise has an AlphaTex definition or GP file → render with alphaTab
- Speed slider (25%-150%) synced with metronome
- A-B loop selection (mark start bar, mark end bar, loop)
- Track isolation (solo guitar, mute drums, etc.)
- Beat cursor following playback
- Transpose control
- If no GP data → show text description + tips

**Tab 2: Video / Backing Track**
- YouTube embed (react-youtube) with:
  - Auto-search from exercise `yt` field
  - Speed control buttons (0.5x, 0.75x, 1x)
  - Custom A-B loop with timestamp markers
  - Search bar to find different videos
- OR Suno AI-generated backing track (in AI Mode)
  - Display generated audio with wavesurfer.js waveform
  - Play/pause, speed control
- OR user-uploaded audio file

**Tab 3: Tutorial / Learning Mode**
- YouTube search results for tutorials on this exercise/technique
- Songsterr link for song exercises
- Direct URL if user provided one
- Links to relevant knowledge base articles

**Always visible (below tabs):**
- Timer (countdown from exercise duration)
- Progressive metronome
- Recorder with waveform visualization
- BPM log + notes input

### 4.2 alphaTab Integration — Guitar Pro Viewer

**Component:** `components/AlphaTabViewer.tsx`

```typescript
interface AlphaTabViewerProps {
  src?: string;          // URL to .gp/.gpx/.gp5 file
  tex?: string;          // AlphaTex markup string
  speed?: number;        // 0.25 to 2.0
  loopStart?: number;    // bar number
  loopEnd?: number;      // bar number
  tracks?: number[];     // track indices to display
  onBarChange?: (bar: number) => void;
}
```

**Key behaviors:**
- Dynamic import (no SSR): `const AlphaTab = dynamic(() => import('./AlphaTabViewer'), { ssr: false })`
- Load SoundFont from `/public/soundfonts/sonivox.sf2`
- Load font files from `/public/fonts/bravura/`
- Expose API methods: `play()`, `pause()`, `stop()`, `setSpeed(n)`, `setLoop(start, end)`
- Event handlers: `scoreLoaded`, `playerStateChanged`, `playerPositionChanged`

**Exercise AlphaTex examples to add to exercise data:**
```
// Chromatic 1-2-3-4 exercise
\title "Chromatic 1-2-3-4"
\tempo 80
.
:16 5.6 6.6 7.6 8.6 5.5 6.5 7.5 8.5 | 5.4 6.4 7.4 8.4 5.3 6.3 7.3 8.3 |
5.2 6.2 7.2 8.2 5.1 6.1 7.1 8.1 |
```

**File upload flow:**
- User uploads .gp/.gpx file in Library or Song management
- File stored in Supabase Storage bucket `gpfiles`
- URL saved to exercise override or song record
- AlphaTabViewer loads from Supabase signed URL

### 4.3 Built-in Ear Training Module

**Page:** `app/ear-training/page.tsx`
**Engine:** Tone.js PolySynth + soundfont-player + tonal

#### 4.3.1 Interval Trainer
- Tone.js plays two notes (ascending, descending, or harmonic)
- User identifies the interval from buttons
- Configurable: which intervals to include (start with P4, P5, octave)
- Score tracking, streak counter
- Uses tonal for interval generation: `Note.transpose("C4", "5P")` → "G4"
- Uses soundfont-player with acoustic_guitar_nylon for realistic tone
- Difficulty levels: Easy (3 intervals) → Hard (all 12)

#### 4.3.2 Chord Quality Trainer
- Tone.js PolySynth plays a chord (3-4 notes simultaneously)
- User identifies: Major, Minor, Diminished, Augmented, Dom7, Maj7, Min7
- Uses tonal `Chord.get()` to generate chord notes
- Configurable difficulty

#### 4.3.3 Scale/Mode Identifier
- Play a scale over a drone note
- User identifies: Aeolian, Dorian, Phrygian, Lydian, Mixolydian, Ionian, Locrian
- Drone note using Tone.js oscillator
- Scale notes from tonal `Scale.get()`
- Focus on characteristic notes

#### 4.3.4 Drone + Interactive Fretboard
- Continuous drone on selected root (Tone.js oscillator)
- fretboard.js interactive fretboard diagram
- User clicks notes → hear them against the drone
- Color-coded: green = consonant (root, 5th), yellow = mild tension (3rd, 6th), red = strong tension (2nd, 7th)
- Shows interval name for each note relative to drone

### 4.4 DAW — Recording Studio

**Page:** `app/studio/page.tsx`
**Engine:** waveform-playlist + Tone.js effects + Web Audio API

#### 4.4.1 Multi-Track Editor
- Import backing track (from Suno, uploaded file, or Supabase storage)
- Record guitar over backing track using MediaRecorder
  - CRITICAL: `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`
- Multiple takes on separate tracks
- Waveform visualization per track (waveform-playlist)
- Per-track controls: volume, pan, mute, solo
- Effects chain via Tone.js: reverb, delay, EQ (3-band)

#### 4.4.2 Loop Station
- Record a chord progression/riff (4-8 bars)
- Auto-loop on completion
- Record additional layers over the loop
- Each layer = separate track with volume/mute

#### 4.4.3 Export
- Export full mix as WAV (OfflineAudioContext) or MP3 (lamejs)
- Save to Supabase Storage
- Link recordings to exercises/songs

### 4.5 Knowledge Base

**Page:** `app/knowledge/page.tsx`

#### 4.5.1 Chord Library
- Search by chord name or notes
- Data from chords.alday.dev API (cached)
- Render diagrams with SVGuitar
- Multiple voicings per chord
- Audio playback via Tone.js PolySynth or soundfont-player
- Filter by: chord type, root note, difficulty

#### 4.5.2 Scale/Mode Reference
- All scales and modes from tonal library
- Interactive fretboard (fretboard.js) showing scale positions
- Characteristic notes highlighted with different color
- Audio playback (play the scale ascending/descending)
- Interval formula display
- Mode comparison (Aeolian vs Dorian vs Phrygian side-by-side)

#### 4.5.3 Theory Reference
- Circle of fifths (interactive SVG diagram)
- Interval chart with audio examples
- Common chord progressions by genre
  - Metal: i-bVI-bVII-i, i-bII-i, i-iv-v
  - Blues: I7-IV7-V7 (12-bar)
  - Rock: I-IV-V-I, I-bVII-IV-I
- Tuning reference (standard, drop D, DADGAD, etc.)

### 4.6 AI Mode (Suno Integration)

**Toggle in Dashboard settings**

When AI Mode is ON:
- Each exercise with `bt: true` gets a "Generate Backing Track" button
- Auto-prompt: `"{scale} {mode}, {bpm} BPM, {style}, instrumental, guitar backing track, no vocals"`
- User can edit prompt before generating
- Generated track appears in the exercise player (wavesurfer.js waveform)
- Track cached in Supabase Storage (keyed by prompt hash)
- Cost display: credits used this session
- Stem separation button (if Demucs is configured server-side)

### 4.7 Enhanced Weekly Report

**Page:** `app/report/page.tsx` (enhanced from current `log` view)

- Practice time per day (bar chart — recharts)
- Completion percentage per category (pie chart)
- BPM progress over weeks (line chart) — track max clean BPM per exercise
- Song progress (stages completed per song, with recordings)
- Recordings timeline (listen to recordings chronologically)
- Streak counter (consecutive days practiced)
- Personal notes/reflections textarea
- Compare with previous weeks

### 4.8 Enhanced Practice View

Additional features for daily practice:
- Drag-and-drop reordering (use @dnd-kit/core instead of react-beautiful-dnd — more maintained)
- Exercise time tracking (how long actually spent, not just timer)
- Quick-complete: swipe or long-press to mark done
- Session timer: total practice time counter for the day
- Focus mode: hide everything except current exercise

---

## 5. DATABASE SCHEMA (Supabase PostgreSQL)

```sql
-- Profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings (extracted for clarity)
CREATE TABLE user_settings (
  user_id UUID REFERENCES profiles(id) PRIMARY KEY,
  current_week INT DEFAULT 1,
  mode TEXT DEFAULT 'Aeolian',
  scale TEXT DEFAULT 'Am',
  style TEXT DEFAULT 'Doom Metal',
  day_categories JSONB DEFAULT '{}',
  day_hours JSONB DEFAULT '{}',
  ai_mode_enabled BOOLEAN DEFAULT FALSE,
  suno_credits_used INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exercise overrides (user customizations)
CREATE TABLE exercise_overrides (
  user_id UUID REFERENCES profiles(id),
  exercise_id INT NOT NULL,
  name TEXT,
  duration_min INT,
  description TEXT,
  youtube_query TEXT,
  tips TEXT,
  personal_notes TEXT,
  gp_file_url TEXT,
  alphatex TEXT,
  PRIMARY KEY (user_id, exercise_id)
);

-- Songs
CREATE TABLE songs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  artist TEXT,
  songsterr_url TEXT,
  songsterr_id INT,
  gp_file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Song progress per week per stage
CREATE TABLE song_progress (
  user_id UUID REFERENCES profiles(id),
  song_id INT REFERENCES songs(id) ON DELETE CASCADE,
  week INT NOT NULL,
  stage_index INT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  bpm_achieved TEXT,
  notes TEXT,
  PRIMARY KEY (user_id, song_id, week, stage_index)
);

-- Daily routines (exercise list per day)
CREATE TABLE daily_routines (
  user_id UUID REFERENCES profiles(id),
  week INT NOT NULL,
  day TEXT NOT NULL,
  exercises JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, week, day)
);

-- Exercise completion logs
CREATE TABLE exercise_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  week INT NOT NULL,
  day TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  bpm_achieved TEXT,
  notes TEXT,
  time_spent_sec INT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audio recordings
CREATE TABLE recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  exercise_id TEXT,
  song_id INT REFERENCES songs(id),
  week INT,
  day TEXT,
  storage_path TEXT NOT NULL,
  duration_sec FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI-generated backing tracks (cache)
CREATE TABLE ai_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  prompt_hash TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  mode TEXT,
  scale TEXT,
  style TEXT,
  bpm INT,
  storage_path TEXT NOT NULL,
  suno_clip_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- YouTube search cache
CREATE TABLE youtube_cache (
  query TEXT PRIMARY KEY,
  results JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chord data cache
CREATE TABLE chord_cache (
  key TEXT NOT NULL,
  suffix TEXT NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (key, suffix)
);

-- Practice stats (daily aggregates)
CREATE TABLE practice_stats (
  user_id UUID REFERENCES profiles(id),
  week INT NOT NULL,
  day TEXT NOT NULL,
  total_minutes INT DEFAULT 0,
  exercises_completed INT DEFAULT 0,
  exercises_total INT DEFAULT 0,
  streak_days INT DEFAULT 0,
  PRIMARY KEY (user_id, week, day)
);

-- Ear training scores
CREATE TABLE ear_training_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  exercise_type TEXT NOT NULL, -- 'interval', 'chord', 'scale'
  difficulty TEXT,
  correct INT DEFAULT 0,
  total INT DEFAULT 0,
  details JSONB,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ear_training_scores ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own data
CREATE POLICY "Users own data" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users own data" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON exercise_overrides FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON songs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON song_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON daily_routines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON exercise_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON recordings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON ai_tracks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON practice_stats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON ear_training_scores FOR ALL USING (auth.uid() = user_id);

-- Storage buckets
-- recordings: private, user audio recordings
-- gpfiles: private, Guitar Pro files
-- ai-tracks: private, Suno-generated backing tracks
```

---

## 6. FILE STRUCTURE

```
guitarforge/
├── app/
│   ├── layout.tsx                    # Root layout (dark theme, RTL)
│   ├── page.tsx                      # Dashboard
│   ├── practice/
│   │   └── page.tsx                  # Daily practice view
│   ├── library/
│   │   └── page.tsx                  # Exercise library + editor
│   ├── ear-training/
│   │   └── page.tsx                  # Ear training module
│   ├── studio/
│   │   └── page.tsx                  # DAW / recording studio
│   ├── knowledge/
│   │   └── page.tsx                  # Knowledge base
│   ├── report/
│   │   └── page.tsx                  # Weekly report
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── callback/route.ts         # OAuth callback
│   │   └── signup/page.tsx
│   └── api/
│       ├── songsterr/route.ts        # Songsterr proxy
│       ├── youtube/route.ts          # YouTube search proxy
│       ├── chords/route.ts           # Chords API proxy
│       ├── suno/route.ts             # Suno AI proxy
│       └── spotify/route.ts          # Spotify proxy
├── components/
│   ├── GuitarForgeApp.tsx            # Main app shell (nav + state)
│   ├── ExerciseModal.tsx             # Exercise player (tabbed)
│   ├── AlphaTabViewer.tsx            # Guitar Pro renderer
│   ├── MetronomeBox.tsx              # Progressive metronome (Tone.js)
│   ├── TimerBox.tsx                  # Countdown timer
│   ├── RecorderBox.tsx               # Audio recorder + waveform
│   ├── YouTubePlayer.tsx             # YouTube embed with A-B loop
│   ├── DawEditor.tsx                 # Multi-track DAW
│   ├── LoopStation.tsx               # Loop recording mode
│   ├── EarTrainer.tsx                # Ear training exercises
│   ├── IntervalTrainer.tsx           # Interval identification
│   ├── ChordTrainer.tsx              # Chord quality identification
│   ├── ScaleTrainer.tsx              # Scale/mode identification
│   ├── DroneExplorer.tsx             # Drone + fretboard
│   ├── FretboardDiagram.tsx          # Interactive fretboard
│   ├── ChordDiagram.tsx              # SVG chord chart
│   ├── CircleOfFifths.tsx            # Interactive circle of fifths
│   ├── WaveformPlayer.tsx            # wavesurfer.js wrapper
│   ├── SunoGenerator.tsx             # AI backing track generator
│   ├── WeeklyChart.tsx               # recharts wrapper
│   └── AuthGuard.tsx                 # Auth protection wrapper
├── lib/
│   ├── types.ts                      # TypeScript types
│   ├── constants.ts                  # Days, categories, colors, modes, scales
│   ├── exercises.ts                  # 67 exercises data
│   ├── exercises-alphatex.ts         # AlphaTex notation for exercises
│   ├── helpers.ts                    # URL builders, autoFill
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   ├── server.ts                 # Server Supabase client
│   │   └── middleware.ts             # Auth middleware
│   ├── audio.ts                      # Tone.js utilities
│   ├── theory.ts                     # tonal wrappers for app needs
│   └── suno.ts                       # Suno API client
├── hooks/
│   ├── useLocalStorage.ts            # localStorage persistence
│   ├── useSupabase.ts                # Supabase client hook
│   ├── useMetronome.ts               # Tone.js metronome hook
│   ├── useRecorder.ts                # MediaRecorder hook
│   ├── useTimer.ts                   # Timer hook
│   ├── useAlphaTab.ts                # alphaTab hook
│   ├── useAudioContext.ts            # Web Audio context hook
│   └── useTone.ts                    # Tone.js initialization hook
├── public/
│   ├── soundfonts/                   # SoundFont2 files for alphaTab
│   ├── fonts/bravura/                # Music notation font for alphaTab
│   └── manifest.json                 # PWA manifest
└── middleware.ts                      # Supabase auth refresh
```

---

## 7. IMPLEMENTATION PHASES

### Phase 1 — Supabase + Auth + Migration (Priority: HIGH)
- [ ] Set up Supabase project (auth, database, storage)
- [ ] Create database tables (SQL above)
- [ ] Set up RLS policies
- [ ] Create Supabase client utilities (client.ts, server.ts)
- [ ] Add auth middleware
- [ ] Create login/signup pages
- [ ] Migrate localStorage persistence to Supabase
- [ ] Keep localStorage as offline fallback
- [ ] Create storage buckets (recordings, gpfiles, ai-tracks)

### Phase 2 — YouTube Integration + Enhanced Player (Priority: HIGH)
- [ ] Install react-youtube
- [ ] Create YouTubePlayer component with A-B loop
- [ ] Add YouTube search API route with caching
- [ ] Enhance ExerciseModal with tabbed interface (GP / Video / Tutorial)
- [ ] Auto-search backing tracks from exercise `yt` field
- [ ] Speed control UI for YouTube player
- [ ] Songsterr API proxy route
- [ ] Search songs via Songsterr, display results

### Phase 3 — alphaTab / Guitar Pro (Priority: HIGH)
- [ ] Install @coderline/alphatab
- [ ] Create AlphaTabViewer component (client-only)
- [ ] Set up SoundFont + font files in /public
- [ ] Write AlphaTex notation for key exercises (warmup, pentatonic, chromatic)
- [ ] Add `alphatex` field to exercise type and data
- [ ] GP file upload flow (Library + Song management → Supabase Storage)
- [ ] Speed slider synced with alphaTab playback
- [ ] A-B loop in alphaTab
- [ ] Track isolation controls

### Phase 4 — Tone.js Metronome + Audio Engine (Priority: MEDIUM)
- [ ] Install tone
- [ ] Replace Web Audio metronome with Tone.js Transport
- [ ] Progressive BPM ramping using Tone.Transport.bpm.rampTo()
- [ ] Accent beat 1, subdivisions
- [ ] Time signature support (4/4, 3/4, 6/8, 7/8)
- [ ] Click sound options (classic, woodblock, rimshot)
- [ ] Enhance RecorderBox with waveform visualization (AnalyserNode)
- [ ] Disable voice processing for guitar input

### Phase 5 — Ear Training (Priority: MEDIUM)
- [ ] Install tonal, soundfont-player
- [ ] Create ear training page with 4 exercise types
- [ ] IntervalTrainer: play 2 notes, identify interval
- [ ] ChordTrainer: play chord, identify quality
- [ ] ScaleTrainer: play scale, identify mode
- [ ] DroneExplorer: drone + interactive fretboard
- [ ] Score tracking, difficulty progression
- [ ] Save scores to Supabase ear_training_scores table

### Phase 6 — Knowledge Base (Priority: MEDIUM)
- [ ] Install svguitar, fretboard.js
- [ ] Chords API proxy route + caching
- [ ] Chord library page with search and diagrams
- [ ] Scale/mode reference with interactive fretboard
- [ ] Theory reference (circle of fifths, intervals, progressions)
- [ ] Audio playback for all references (Tone.js)

### Phase 7 — DAW / Recording Studio (Priority: LOWER)
- [ ] Install waveform-playlist, wavesurfer.js, lamejs
- [ ] Create studio page with multi-track editor
- [ ] Record guitar over backing tracks
- [ ] Per-track volume/pan/mute/solo
- [ ] Effects: reverb, delay, EQ (Tone.js)
- [ ] Loop station mode
- [ ] Export WAV/MP3
- [ ] Save recordings to Supabase Storage

### Phase 8 — Suno AI Mode (Priority: LOWER)
- [ ] Suno API proxy route
- [ ] SunoGenerator component
- [ ] Auto-generate prompts from dashboard settings
- [ ] Cache tracks in Supabase Storage
- [ ] AI Mode toggle in dashboard
- [ ] Credit tracking

### Phase 9 — Enhanced Reports + Polish (Priority: LOWER)
- [ ] Install recharts
- [ ] Practice time charts (bar chart per day)
- [ ] BPM progress charts (line chart over weeks)
- [ ] Category completion pie chart
- [ ] Streak tracking
- [ ] PWA manifest + service worker
- [ ] Mobile responsive polish
- [ ] Performance optimization (lazy loading, code splitting)

---

## 8. KEY TECHNICAL NOTES

### Client-Side Only Libraries (No SSR)
These must use `dynamic(() => import(...), { ssr: false })`:
- alphaTab
- Tone.js
- waveform-playlist
- wavesurfer.js
- fretboard.js

### Audio Context User Gesture Requirement
All audio playback must be initiated by a user gesture (click/tap). Use a global "Start Audio" button or attach `Tone.start()` / `new AudioContext()` to the first user interaction.

### RTL Support
- App UI is RTL (Hebrew)
- Music content (notation, tab, theory) is LTR
- Use `dir="ltr"` on music-specific containers

### Offline Capability
- Keep localStorage as fallback when Supabase is unavailable
- Service worker caches static assets + exercise data
- Recordings queue for upload when back online

### Bundle Size Management
- alphaTab: ~2 MB — lazy load only on exercise modal open
- Tone.js: ~150 KB — lazy load on first audio interaction
- waveform-playlist: lazy load only on studio page
- SoundFont: 5-20 MB — load on demand, cache in browser

---

## 9. DESIGN SYSTEM

| Token | Value | Usage |
|-------|-------|-------|
| bg-primary | #0a0a0a | Main background |
| bg-card | #111111 | Card backgrounds |
| bg-input | #111111 | Input backgrounds |
| border-default | #222222 | Default borders |
| border-input | #333333 | Input borders |
| text-primary | #e5e5e5 | Main text |
| text-secondary | #888888 | Secondary text |
| text-muted | #555555 | Muted text |
| accent-primary | #f59e0b | Amber — primary accent |
| accent-success | #22c55e | Green — completion, success |
| accent-danger | #ef4444 | Red — danger, recording |
| accent-info | #6366f1 | Indigo — links, Songsterr |
| accent-song | #10b981 | Emerald — songs |
| Category colors | See COL in constants.ts | Per-category colors |

Font: `system-ui, -apple-system, sans-serif`
Direction: RTL for UI, LTR for music content
Border radius: 6-8px (cards), 4px (inputs/buttons)

---

## 10. EXISTING CODE REFERENCE

The current working codebase is at `C:\Users\User\guitarforge\` with this structure:
- `src/lib/types.ts` — all TypeScript types
- `src/lib/constants.ts` — DAYS, CATS, COL, MODES, SCALES, STYLES, STAGES, defaults
- `src/lib/exercises.ts` — 67 exercises data
- `src/lib/helpers.ts` — ytSearch, btSearch, ssSearch, makeSongItem, autoFill
- `src/components/GuitarForgeApp.tsx` — main app with all 4 views
- `src/components/ExerciseModal.tsx` — exercise player modal
- `src/components/MetronomeBox.tsx` — progressive metronome
- `src/components/TimerBox.tsx` — countdown timer
- `src/components/RecorderBox.tsx` — audio recorder

All existing functionality must be preserved. New features are additions, not replacements.
