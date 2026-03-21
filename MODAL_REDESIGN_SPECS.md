# GuitarForge Modal Redesign & Page Improvement Specifications

**Version:** 1.0
**Date:** March 20, 2026
**Author:** UI/UX Designer Agent

---

## Table of Contents

1. [Design Philosophy & Principles](#1-design-philosophy--principles)
2. [Design System Reference](#2-design-system-reference)
3. [Modal Type 1: Song Window](#3-modal-type-1-song-window)
4. [Modal Type 2: Exercise Window](#4-modal-type-2-exercise-window)
5. [Modal Type 3: Theory/Ear Training Window](#5-modal-type-3-theoryear-training-window)
6. [Dark Audio Player Component](#6-dark-audio-player-component)
7. [Dashboard Improvements](#7-dashboard-improvements)
8. [Practice Page Improvements](#8-practice-page-improvements)
9. [Library 6-Tab Structure](#9-library-6-tab-structure)
10. [Studio Page Improvements](#10-studio-page-improvements)
11. [Coach Page Improvements](#11-coach-page-improvements)
12. [Global Modal Infrastructure](#12-global-modal-infrastructure)
13. [Responsive Behavior](#13-responsive-behavior)
14. [Animation & Motion](#14-animation--motion)
15. [Accessibility](#15-accessibility)

---

## 1. Design Philosophy & Principles

### Core Identity
GuitarForge is a **professional practice workstation**, not a toy. Every modal should feel like opening a dedicated rack unit in a studio -- heavy, purposeful, full of real tools. The aesthetic is **Marshall amp meets modern DAW**: warm darks, brushed metal textures, gold accents, physical-feeling controls.

### Anti-Patterns to Avoid
- **No cream/white faceplates in modal headers.** The current `.faceplate` class (cream `#F5F0E1` background) creates a jarring light band at the top of every modal. Replace with dark gradient headers that match the overall dark UI.
- **No default HTML `<audio>` elements.** The browser-native audio player is white/light and breaks the dark theme. Always use the custom DarkAudioPlayer.
- **No tiny, illegible controls.** Current exercise modals use 8-9px text for critical information. Minimum readable size is 11px for labels, 13px for body text.
- **No flat visual hierarchy.** Every section should have clear containment, spacing, and visual weight appropriate to its importance.

### Visual Priorities (per modal type)
| Priority | Song Window | Exercise Window | Theory Window |
|----------|-------------|-----------------|---------------|
| 1st | Tab player / YouTube | GP Tab + Metronome | Interactive tool |
| 2nd | GP Tab viewer | Backing track | Instructions |
| 3rd | Metadata + notes | Timer + Recorder | Tutorial video |
| 4th | Progress tracking | Notes / Log | Notes + Progress |

---

## 2. Design System Reference

### Colors (from globals.css `:root`)
```
Background tiers:
  --bg-void:      #08080a    (deepest black -- overlay backdrop)
  --bg-primary:   #121214    (page background)
  --bg-panel:     #18181c    (modal body background)
  --bg-secondary: #1a1a1e    (sections within modals)
  --bg-surface:   #1e1e22    (interactive surfaces)
  --bg-tertiary:  #222226    (hover states)
  --bg-elevated:  #26262a    (raised elements)
  --bg-recess:    #0c0c0e    (inset/recessed areas -- input fields, progress bars)

Text:
  --text-primary:   #e8e4dc  (warm off-white)
  --text-secondary: #9a9590  (medium gray)
  --text-muted:     #5c5852  (dim labels)

Accents:
  --gold:        #D4A843     (primary accent)
  --gold-bright: #EDCF72     (hover/highlight)
  --gold-dim:    #8A7020     (subtle/disabled gold)
  --crimson:     #C41E3A     (danger/alert)

LED indicators:
  --led-green:  #33CC33
  --led-red:    #FF3333
  --led-amber:  #FFAA00

Category colors: defined in COL (constants.ts) -- always use those
AI/Suno accent: #8b5cf6 (purple)
```

### Typography
```
Headings:  font-heading  = Oswald 600, letter-spacing 0.04em
Labels:    font-label    = Oswald 500 13px, letter-spacing 0.1em
Readout:   font-readout  = JetBrains Mono 13px
Body:      Source Sans 3, 15px, weight 400
```

### Spacing Scale
```
4px   -- micro (between inline elements)
8px   -- tight (within grouped controls)
12px  -- compact (between related sections)
16px  -- standard (section padding)
20px  -- comfortable (modal body padding on mobile)
24px  -- spacious (modal body padding on desktop)
32px  -- section breaks
```

### Border & Shadow
```
Borders:
  --border-subtle: #1a1916   (barely visible)
  --border-panel:  #2a2824   (standard panel edge)
  --border-accent: #3d3a34   (interactive/hover)

Shadows:
  Panel:    0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)
  Elevated: 0 8px 32px rgba(0,0,0,0.6)
  Modal:    0 24px 80px rgba(0,0,0,0.8), 0 0 1px rgba(212,168,67,0.1)
```

---

## 3. Modal Type 1: Song Window

### Purpose
A comprehensive practice environment for learning a specific song from the 2,592-song library. Designed to be a self-contained workspace where a guitarist can stay for an entire practice session on one song.

### Routing Logic
Opened when: user clicks a song from Song Library tab, or from dashboard setlist. The system checks `SongEntry` type and renders this modal.

### Header Design (DARK, not faceplate)

```
+------------------------------------------------------------------+
|                                                          [X Close]|
|                                                                   |
|  [Genre tag]  [Difficulty tag]  120 BPM  Key: Am                 |
|                                                                   |
|  Song Title Here                                    [GP] badge    |
|  Artist Name                                                      |
|  Album Name (2024) . Standard Tuning                             |
|                                                                   |
|  [heart] Add to My Songs    [star star star star half-star]       |
|                                                                   |
|  [======= Progress Bar: Learning ==================]             |
|  Status: Learning  |  Not Started  Learning  Slow  Full  Mastered|
|                                                                   |
+------------------------------------------------------------------+
```

#### Header Specs
- **Background:** `linear-gradient(180deg, #1e1c18 0%, #18181c 100%)` -- warm dark, NOT cream faceplate
- **Border-bottom:** `1px solid var(--border-panel)`
- **Padding:** 20px on mobile, 24px on desktop
- **Song title:** `font-heading text-2xl text-[var(--text-primary)]` -- large, bold, gold NOT dark text
- **Artist:** `font-label text-[14px] text-[var(--text-secondary)]`
- **Album/year:** `font-readout text-[12px] text-[var(--text-muted)]`
- **Tags:** Use existing `.tag` class with category colors
- **GP badge:** Small pill showing "GP" if `song.gp === true` or `song.gpFileName` exists. Gold border, gold text, dark fill.
- **"Add to My Songs" button:** Heart icon + text. Uses `btn-ghost` style. When added, heart fills gold and text changes to "In My Songs".
- **Star rating:** 5 stars, clickable, gold fill on rated stars, `#333` for empty. Store in localStorage keyed by song ID.
- **Progress bar:** Full-width, 6px height, uses `.practice-progress-bar` style. Maps to the 5-stage progress status.
- **Progress status buttons:** Inline row of pill buttons: Not Started / Learning / Can Play Slow / Full Speed / Mastered. Active state uses gold background.

#### Close Button
- **Position:** `sticky top-4 right-4` (floated right)
- **Style:** 36x36px circle, `bg-[var(--bg-elevated)]`, `border 1px solid var(--border-accent)`, `text-[var(--text-secondary)]`
- **Hover:** `bg-[var(--bg-tertiary)]`, `text-[var(--text-primary)]`
- **Icon:** "X" character, 18px

### Tab Bar

```
+-----------+-----------+-----------+
|  Practice |  Tutorial |    Log    |
+-----------+-----------+-----------+
```

- **Background:** `var(--bg-recess)` (#0c0c0e)
- **Tab text:** `font-label text-[12px]` (upgraded from current 10px)
- **Active indicator:** 2px bottom border in `var(--gold)`, text color `var(--gold)`
- **Inactive:** `text-[var(--text-muted)]`, transparent bottom border
- **Height:** 44px (comfortable tap target on mobile)

### Tab 1: Practice

Layout order (top to bottom):

#### Section A: YouTube Embed
```
+------------------------------------------------------------------+
| [led-gold] BACKING TRACK                                         |
|                                                                   |
| +--------------------------------------------------------------+ |
| |                                                              | |
| |              YouTube Player (16:9)                           | |
| |              Auto-search: "Song Title backing track"         | |
| |                                                              | |
| +--------------------------------------------------------------+ |
|                                                                   |
| Quick search:  [Backing Track]  [Original Song]  [Live Version]  |
|                                                                   |
| Paste URL: [___________________________________] [Load]          |
+------------------------------------------------------------------+
```

- **Auto-search behavior:** On mount, fetch `/api/youtube?q={title} {artist} backing track guitar`. Display first result as embedded iframe.
- **Quick search buttons:** `btn-ghost` style, each opens YouTube search in new tab with preset query:
  - "{title} {artist} backing track guitar" (default loaded)
  - "{title} {artist} original"
  - "{title} {artist} live"
- **Manual URL input:** `input` class, with "Load" button (`btn-gold`). Parses YouTube URL to extract video ID.
- **Section label:** LED indicator (gold) + "BACKING TRACK" in `font-label text-[11px] text-[var(--gold)]`

#### Section B: Guitar Pro Tab
```
+------------------------------------------------------------------+
| [led-gold] GUITAR PRO TAB                     [Download] [Songsterr]|
|                                                                   |
| +--------------------------------------------------------------+ |
| |                                                              | |
| |              alphaTab Player                                 | |
| |              (GpFileUploader component)                      | |
| |              Upload .gp, .gp5, .gpx files                   | |
| |                                                              | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

- **GpFileUploader:** Existing component, dynamically imported with `ssr: false`
- **Action buttons:** "Download tabs" and "Songsterr" links in `btn-ghost` style, positioned in header row
- **Empty state:** Upload prompt with drag-and-drop area, `bg-[var(--bg-recess)]` with dashed border

#### Section C: Practice Tools (collapsible row)
```
+------------------------------------------------------------------+
| [led-green] PRACTICE TOOLS                                       |
|                                                                   |
| +--------------------+ +--------------------+ +-----------------+ |
| | Metronome          | | Timer              | | Recorder        | |
| | [RotaryKnob] 120   | | 04:32  [Start]     | | [Record] [Play] | |
| +--------------------+ +--------------------+ +-----------------+ |
+------------------------------------------------------------------+
```

- **Layout:** On desktop, 3-column grid. On mobile, stacked vertically.
- **Components:** Existing `MetronomeBox`, `TimerBox`, `RecorderBox`
- **Collapsible:** Default expanded. Clicking header toggles visibility. Saves state.

### Tab 2: Tutorial

Same as current TutorialTab but with these improvements:

- **Auto-search query:** `"how to play {title} {artist} guitar tutorial"`
- **Video embed:** `aspect-video w-full rounded-lg overflow-hidden bg-black`
- **Manual URL input:** Same pattern as Practice tab
- **"Search more" button:** `btn-ghost w-full`, opens YouTube search in new tab
- **Difficulty tips panel:** Below video, show song-specific tips:
  - Tuning required (if not standard)
  - Key signature
  - Tempo with metronome link
  - Suggested practice sections

### Tab 3: Log (renamed from "Notes")

```
+------------------------------------------------------------------+
| [led-gold] PRACTICE LOG                                          |
|                                                                   |
| Star Rating:  [star] [star] [star] [star] [star]                |
|                                                                   |
| Progress:  [Not Started] [Learning] [Slow] [Full] [Mastered]    |
|                                                                   |
| +--------------------------------------------------------------+ |
| | Personal Notes                                                | |
| | [textarea, 6 rows, auto-save to localStorage]                | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [led-green] RECORDINGS                                           |
| +--------------------------------------------------------------+ |
| | [RecorderBox component]                                       | |
| | Previous recordings listed with DarkAudioPlayer               | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [led-amber] SESSION HISTORY                                     |
| +--------------------------------------------------------------+ |
| | Date        | BPM    | Duration | Notes                      | |
| | 2026-03-20  | 120    | 15 min   | Getting smoother...         | |
| | 2026-03-18  | 100    | 20 min   | First attempt               | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

- **Star rating:** 5 stars, gold fill, stored per song ID
- **Progress status:** Same pill buttons as header, synced
- **Notes textarea:** `input` class, 6 rows, auto-saves with 500ms debounce
- **RecorderBox:** Existing component
- **Session history:** Table showing past practice sessions (stored in localStorage). Columns: Date, BPM achieved, Duration, Short note.

---

## 4. Modal Type 2: Exercise Window

### Purpose
Focused technical practice environment for the 67 exercises in the exercise library. Emphasis on repetitive drilling with tempo tools.

### Routing Logic
Opened when: user clicks an exercise from Practice view or Library. System checks `Exercise` type and renders this modal.

### Header Design (DARK)

```
+------------------------------------------------------------------+
| [Timer icon] [Record icon]                           [Done] [X]  |
|                                                                   |
|  [Category tag: Shred]   80-160 BPM   15 min                    |
|                                                                   |
|  Exercise Title Here                                              |
|  Focus: Speed, Accuracy, Alternate Picking                       |
+------------------------------------------------------------------+
```

#### Header Specs
- **Background:** `linear-gradient(180deg, #1e1c18 0%, #18181c 100%)` -- same dark gradient as Song Window
- **Toolbar row (top):** Timer icon button + Record icon button on left. "Done" button (`btn-gold`, compact) + Close "X" on right.
  - Timer icon: 24x24, `var(--led-green)` color, circular background `var(--bg-surface)`. Clicking scrolls to or toggles TimerBox.
  - Record icon: 24x24, `var(--led-red)` color, same circular bg. Clicking scrolls to or toggles RecorderBox.
  - These are **always visible** even when scrolling (sticky toolbar).
- **Category tag:** Uses `.tag` class with `COL[ex.c]` color
- **BPM range:** `font-readout text-[12px] text-[var(--text-secondary)]`
- **Duration:** `font-readout text-[12px] text-[var(--text-secondary)]`
- **Exercise name:** `font-heading text-xl text-[var(--text-primary)]`
- **Focus areas:** `font-label text-[11px] text-[var(--text-muted)]` -- from `ex.f`

### Tab Bar

```
+-----------+-----------+-----------+
|  Practice |  Tutorial |    Log    |
+-----------+-----------+-----------+
```

Same styling as Song Window tabs.

### Tab 1: Practice

Layout order reflects priority for technical exercises:

#### Section A: Description & Tips
```
+------------------------------------------------------------------+
| Exercise description text here. Multiple lines of detailed        |
| explanation about the technique, what to focus on, and common     |
| mistakes to avoid.                                                |
|                                                                   |
| +-- TIP -------------------------------------------------------+ |
| | [led-gold] Practice slowly at first. Focus on clean           | |
| | articulation before building speed...                         | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

- **Description:** `text-[14px] text-[var(--text-secondary)] leading-7` -- upgraded from current 13px
- **Tip box:** `bg-[var(--gold)]/5 border border-[var(--gold)]/15`, with LED indicator. `text-[12px] text-[var(--gold)]/80 leading-5`

#### Section B: Guitar Pro Tab (PROMINENT)
```
+------------------------------------------------------------------+
| [led-gold] GUITAR PRO TAB                     [Download] [Songsterr]|
|                                                                   |
| +--------------------------------------------------------------+ |
| |                                                              | |
| |              alphaTab Player                                 | |
| |              Shows built-in tex OR uploaded .gp file         | |
| |              Height: 300px minimum                           | |
| |                                                              | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

- **Height:** Minimum 300px for the alphaTab container (current has no min-height, often feels cramped)
- **If `ex.tex` exists:** Render inline using alphaTab
- **Upload/download:** Same as Song Window

#### Section C: Metronome (PROMINENT -- above backing track)
```
+------------------------------------------------------------------+
| [led-amber] METRONOME                                            |
|                                                                   |
| +--------------------------------------------------------------+ |
| |  BPM: [RotaryKnob] 120                                      | |
| |                                                              | |
| |  [60] ==========[thumb]==================== [240]            | |
| |                                                              | |
| |  Time: [4/4]  [3/4]  [6/8]  [7/8]  [5/4]                  | |
| |  Sub:  [quarter] [eighth] [triplet] [sixteenth]             | |
| |                                                              | |
| |  [>>>>> PLAY / STOP <<<<<]                                  | |
| |                                                              | |
| |  [x] Progressive Mode                                       | |
| |  Start: 80  Target: 160  Increment: +5 every [4] bars      | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

- **This is the existing MetronomeBox component**, but displayed MORE prominently
- **Progressive mode highlight:** When progressive is enabled, show a mini progress indicator: "80 -> 160 BPM, +5/4bars"
- **Start BPM:** Pre-populated from `ex.b` (parse the range, use the low end)
- **Section order matters:** Metronome ABOVE backing track because for exercises, tempo control is more important than accompaniment

#### Section D: Backing Track
```
+------------------------------------------------------------------+
| [led-purple] AI BACKING TRACK (SUNO)                             |
|                                                                   |
| +--------------------------------------------------------------+ |
| |  Style: [Metal ▼]                                            | |
| |  Am Aeolian / 120 BPM                                       | |
| |                                                              | |
| |  [DarkAudioPlayer -- if cached track exists]                 | |
| |  or                                                          | |
| |  [Generate AI Backing Track] button                          | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [led-gold] YOUTUBE BACKING                                       |
| +--------------------------------------------------------------+ |
| |  Search: [{scale} {mode}]  [{style} Jam]  [Slow Blues]      | |
| |  Paste URL: [_______________________________] [Load]         | |
| |  [YouTube embed if loaded]                                   | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

- **Suno section:** Only shown if `needsBacking` (ex.bt || BACKING_CATS.includes(ex.c))
- **DarkAudioPlayer:** Replaces `<audio>` element (see Section 6)
- **YouTube section:** Search buttons + manual URL paste. Shown for ALL exercises (sometimes useful even for non-backing exercises)
- **Visibility note:** When `needsBacking` is false, collapse the Suno section but keep YouTube available behind an expandable toggle

#### Section E: Practice Tools
```
+------------------------------------------------------------------+
| [led-green] TIMER                                                |
| +--------------------------------------------------------------+ |
| |  [TimerBox component -- pre-set to ex.m minutes]             | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [led-red] RECORDER                                               |
| +--------------------------------------------------------------+ |
| |  [RecorderBox component]                                     | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

- **Timer:** Pre-set to exercise duration (`ex.m`)
- **Recorder:** Storage key uses `week-day-exerciseId` format (existing)
- **Layout:** Stacked vertically. On desktop with enough width, could be side-by-side

### Tab 2: Tutorial
Same as current TutorialTab implementation. Auto-fetches YouTube tutorial using `ex.yt` query.

### Tab 3: Log
```
+------------------------------------------------------------------+
| [led-gold] SESSION LOG                                           |
|                                                                   |
| BPM Achieved: [input]          Date: March 20, 2026             |
|                                                                   |
| Notes: [textarea]                                                |
|                                                                   |
| [led-red] RECORDINGS                                             |
| [RecorderBox component]                                          |
+------------------------------------------------------------------+
```

- Same as current log tab but with:
  - Larger input fields (current are too small)
  - Date auto-filled and formatted properly
  - RecorderBox with DarkAudioPlayer for playback

---

## 5. Modal Type 3: Theory/Ear Training Window

### Purpose
Interactive learning environment for theory-based and ear training exercises. These exercises are fundamentally different from technique exercises -- they need interactive tools (fretboard diagrams, interval trainers, chord viewers) rather than metronomes and backing tracks.

### Routing Logic
Opened when: user clicks an exercise where `ex.c` is one of: `"Ear Training"`, `"Fretboard"`, `"Modes"`, `"Keys"`, `"Chords"`. System checks category and renders this modal variant.

### Which Categories Map to Theory Window
```typescript
const THEORY_CATS = ["Ear Training", "Fretboard", "Modes", "Keys", "Chords"];
```

### Header Design

```
+------------------------------------------------------------------+
|                                                          [X Close]|
|                                                                   |
|  [Category tag: Ear Training]   15 min                           |
|                                                                   |
|  Exercise Title Here                                              |
|  Focus: Interval Recognition, Relative Pitch                    |
+------------------------------------------------------------------+
```

- Same dark gradient header as other modals
- No toolbar icons (timer/recorder less critical for theory)
- Simpler metadata line

### Tab Bar

```
+-----------+-----------+-----------+-----------+
|   Lesson  |   Tool    |  Tutorial |    Log    |
+-----------+-----------+-----------+-----------+
```

Note: 4 tabs instead of 3. The "Tool" tab links to Learning Center interactive tools.

### Tab 1: Lesson

```
+------------------------------------------------------------------+
| [led-gold] INSTRUCTIONS                                          |
|                                                                   |
| Exercise description text. For theory exercises, this should be  |
| more detailed -- explaining the concept, why it matters, and     |
| step-by-step instructions for how to practice it.                |
|                                                                   |
| +-- TIP -------------------------------------------------------+ |
| | [led-gold] Focus on hearing the quality of each interval      | |
| | before trying to name it...                                   | |
| +--------------------------------------------------------------+ |
|                                                                   |
| +-- STEPS ------------------------------------------------------+ |
| | 1. Play the reference note                                   | |
| | 2. Play the target interval                                  | |
| | 3. Sing the interval back                                    | |
| | 4. Check on the fretboard                                    | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

- **Description:** Same styling as Exercise Window but with more room
- **Steps panel:** If the exercise description contains numbered steps, parse and render them in a styled list with step numbers in gold circles

### Tab 2: Tool

```
+------------------------------------------------------------------+
| [led-gold] INTERACTIVE TOOL                                      |
|                                                                   |
| +--------------------------------------------------------------+ |
| |                                                              | |
| |  [Linked Learning Center Component]                          | |
| |                                                              | |
| |  For "Ear Training" -> Interval Trainer                      | |
| |  For "Fretboard"    -> Fretboard Visualizer                  | |
| |  For "Modes"        -> Scale Explorer                        | |
| |  For "Keys"         -> Circle of Fifths                      | |
| |  For "Chords"       -> Chord Diagram                         | |
| |                                                              | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [Open Full Tool in Learning Center >>]                           |
+------------------------------------------------------------------+
```

- **Tool mapping:** Based on `ex.c`, embed the relevant interactive component from LearningCenterPage
- **Fallback:** If no matching tool, show a link to open Learning Center with "Open in Learning Center" button
- **Link button:** `btn-ghost w-full`, navigates to Learning Center view and closes modal

### Tab 3: Tutorial
Same as other modals -- YouTube tutorial auto-search.

### Tab 4: Log
Same as Exercise Window log tab -- BPM (optional for theory), notes, recordings.

---

## 6. Dark Audio Player Component

### Problem
The current codebase uses `<audio>` elements with default browser styling:
```html
<audio src={sunoTrack.audioUrl} controls loop
  className="w-full h-8 [&::-webkit-media-controls-panel]:bg-[#1a1a1a]" />
```
This renders a white/light audio player that breaks the dark theme. The webkit hack only partially works and is Chrome-only.

### Solution: DarkAudioPlayer Component

```
+------------------------------------------------------------------+
| [Play/Pause]  0:45 / 3:12  [======|===============]  [Vol] [DL] [Loop] |
+------------------------------------------------------------------+
```

#### Component Interface
```typescript
interface DarkAudioPlayerProps {
  src: string;
  title?: string;
  subtitle?: string;  // e.g. "AI Generated - Metal / Am Aeolian / 120 BPM"
  loop?: boolean;
  onEnded?: () => void;
  showDownload?: boolean;
  showLoop?: boolean;
  compact?: boolean;   // Single row, no title
}
```

#### Visual Spec

**Container:**
- Background: `var(--bg-recess)` (#0c0c0e)
- Border: `1px solid var(--border-subtle)`
- Border-radius: 8px
- Padding: 12px 16px
- Box-shadow: `inset 0 2px 6px rgba(0,0,0,0.4)`

**Title row (when not compact):**
- Title: `font-label text-[11px] text-[var(--text-secondary)]`
- Subtitle: `font-readout text-[10px] text-[var(--text-muted)]`

**Controls row:**
- **Play/Pause button:** 32x32px circle, `bg-[var(--bg-surface)]`, border `var(--border-panel)`. Icon: play triangle or pause bars, `var(--gold)` color. Hover: `bg-[var(--bg-tertiary)]`, gold glow.
- **Time display:** `font-readout text-[12px] text-[var(--text-secondary)]`. Format: `0:45 / 3:12`
- **Seek bar:** Full-width slider
  - Track: 4px height, `var(--bg-tertiary)` background, rounded
  - Fill: `linear-gradient(90deg, var(--gold-dim), var(--gold))`
  - Thumb: 12px circle, `var(--gold)`, with 2px dark border. On hover: 14px with gold glow
  - Buffered: `var(--bg-elevated)` showing loaded portion
- **Volume button:** Speaker icon, 20x20, `var(--text-muted)`. Click toggles mute. Hover shows volume slider popup.
- **Download button** (when showDownload): Download arrow icon, 20x20, `var(--text-muted)`. Creates download link.
- **Loop button** (when showLoop): Loop icon, 20x20. Active: `var(--gold)`. Inactive: `var(--text-muted)`.

**Compact mode:**
- Single row: `[Play] [time] [seek bar] [volume] [controls]`
- No title/subtitle
- Height: ~44px
- Used inline within other components

**States:**
- Loading: Pulsing animation on seek bar, play button disabled
- Error: Red tint on container, error message replaces time
- Playing: Play button becomes pause, LED-green indicator dot

#### Implementation Notes
- Use `useRef<HTMLAudioElement>` internally -- the `<audio>` element is hidden (`display: none`)
- Listen to `timeupdate`, `loadedmetadata`, `ended`, `error` events
- Seek bar uses `input[type=range]` with custom CSS (all webkit/moz/ms prefixes for cross-browser)
- Volume state persists in localStorage key `gf-audio-volume`

---

## 7. Dashboard Improvements

### Current State Analysis
The dashboard currently has:
1. Hero card (Today's Practice)
2. Stats row (4 cards)
3. Weekly schedule (7-day grid)
4. Smart suggestions
5. Setlist (songs with add form)

### Proposed Improvements

#### 7A: Replace "Smart Suggestions" with "Weekly Focus"
```
+------------------------------------------------------------------+
| [led-amber] THIS WEEK'S FOCUS                                   |
|                                                                   |
| +------------------------+ +------------------------------------+ |
| | TECHNIQUE FOCUS        | | THEORY FOCUS                      | |
| |                        | |                                    | |
| | Alternate Picking      | | Aeolian Mode                      | |
| | You've been working    | | Learn the intervals and            | |
| | on this for 3 weeks.   | | characteristic notes.              | |
| | Current max: 140 BPM   | |                                    | |
| |                        | | [Practice Now >>]                  | |
| | [Practice Now >>]      | |                                    | |
| +------------------------+ +------------------------------------+ |
|                                                                   |
| WEEKLY GOAL: 5 hours practice                                    |
| [==========|============================] 2.5 / 5 hrs           |
+------------------------------------------------------------------+
```

- **Data source:** Analyze which categories the user practices most, which exercises have the most BPM log entries, and the current mode/scale settings
- **Technique focus:** Pick the category with most exercises this week. Show max BPM from logs.
- **Theory focus:** Based on current mode/scale. Link to Learning Center.
- **Weekly goal:** Total hours target (sum of dayHrs). Show progress bar based on estimated completed minutes.

#### 7B: Simplify Setlist
```
+------------------------------------------------------------------+
| [led-green] MY SONGS                                [Manage >>]  |
|                                                                   |
| +--------------------------------------------------------------+ |
| | [note] Master of Puppets - Metallica        Stage 3/6  [>>]  | |
| | [note] Eruption - Van Halen                 Stage 1/6  [>>]  | |
| | [note] Fade to Black - Metallica            Stage 5/6  [>>]  | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [+ Add Song]  (opens song library picker)                        |
+------------------------------------------------------------------+
```

- Remove inline form fields (name + URL inputs)
- "Add Song" button opens a mini-picker that searches SONG_LIBRARY
- Each song row is clickable -- opens Song Window modal
- "Manage" link goes to Library > Songs tab
- Show max 5 songs. If more, show "View all in Library"

#### 7C: Add "Quick Start" Actions
```
+------------------------------------------------------------------+
| QUICK START                                                       |
|                                                                   |
| [Play] Start Practice   [music] Jam Mode   [mic] Studio         |
| [book] Learning Center  [brain] AI Coach   [chart] Report       |
+------------------------------------------------------------------+
```

- 6 action buttons in a 3x2 or 6x1 grid
- Each is a `btn-ghost` with icon + label
- Clicking navigates to the respective view
- Responsive: 3x2 on mobile, 6x1 on desktop

#### 7D: Add "Recent Activity" Feed
```
+------------------------------------------------------------------+
| [led-gold] RECENT ACTIVITY                                       |
|                                                                   |
| Today                                                            |
|   [check] Completed "String Skipping" exercise  (12 min)        |
|   [bpm]   Hit 140 BPM on "Alternate Picking Drill"              |
|                                                                   |
| Yesterday                                                        |
|   [check] Completed 4/6 exercises                                |
|   [star]  Started learning "Fade to Black"                       |
+------------------------------------------------------------------+
```

- **Data source:** Parse doneMap, bpmLog, noteLog to reconstruct activity
- **Grouping:** By date
- **Max items:** Show last 10 activities, "View full report" link to Report view
- **Icons:** Small colored indicators per activity type

#### 7E: Add "Daily Tip"
```
+------------------------------------------------------------------+
| TIP OF THE DAY                                                    |
| "Always warm up with chromatic exercises before speed work.       |
|  Cold fingers + fast playing = injury risk."                      |
|                                           — Focus: Injury Prevention |
+------------------------------------------------------------------+
```

- Rotating tips from a predefined array (can start with 30-50 tips)
- Tip selection based on day of year (deterministic, not random)
- Subtle styling: `bg-[var(--bg-secondary)]`, quote marks in gold
- Dismissable per session (but returns next day)

#### 7F: Streak Enhancement
Current streak is shown in the hero card. Enhance with:
- **Calendar heatmap** (optional, in Report view): Small monthly grid showing practice days
- **Longest streak** displayed alongside current
- **Milestone badges** at 7, 14, 30, 60, 100, 365 days

### Dashboard Layout Order (revised)
1. Hero Card (Today's Practice -- keep as-is, it's good)
2. Stats Row (4 cards -- keep, add "Longest Streak" tooltip)
3. Quick Start Actions (new)
4. Weekly Schedule (keep, but close editor by default)
5. Weekly Focus (replaces Smart Suggestions)
6. My Songs / Setlist (simplified)
7. Recent Activity (new)
8. Daily Tip (new)

---

## 8. Practice Page Improvements

### Current State
The practice page shows the selected day's exercises in a list, with checkboxes and modals.

### Proposed Improvements

#### 8A: Focus Mode Enhancement
```
+------------------------------------------------------------------+
| FOCUS MODE                                               [Exit]  |
|                                                                   |
| Exercise 3 of 6                                                  |
| ============== Progress: 50% ===================================  |
|                                                                   |
| +--------------------------------------------------------------+ |
| |                                                              | |
| |  [Full Exercise Modal -- embedded, not popup]                | |
| |  All practice tools visible inline                           | |
| |                                                              | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [<< Previous]  [Mark Done & Next >>]                             |
+------------------------------------------------------------------+
```

- Focus mode shows one exercise at a time, full-width
- Progress indicator shows position in day's exercises
- Navigation: Previous / Next buttons
- "Mark Done & Next" combines completing exercise and advancing

#### 8B: Exercise Card Improvements
```
+------------------------------------------------------------------+
| [checkbox]  [Category]  Exercise Name                   [15 min] |
|             Focus: Speed, Accuracy                      [80 BPM] |
|             [========== 3/5 sessions this week ========]         |
+------------------------------------------------------------------+
```

- Add mini progress indicator showing how many times this exercise was completed this week
- Show BPM log trend (if available): small sparkline or just "last: 120 BPM"
- Click anywhere on card (not just exercise name) to open modal

#### 8C: Day Summary Bar
```
+------------------------------------------------------------------+
| Sunday - Week 1          3/6 done   45/90 min   [Build Routine] |
| Metal . Am Aeolian                                               |
| [==================|================================] 50%         |
+------------------------------------------------------------------+
```

- Sticky at top while scrolling exercises
- Shows: day name, week number, completion ratio, time spent/total, progress bar
- "Build Routine" quick action if no exercises generated yet

---

## 9. Library 6-Tab Structure

### Current State
4 tabs: Exercises, Styles, Songs, Song Library+

### Proposed 6-Tab Structure

```
+----------+--------+--------+----------+--------+---------+
| Exercises | Songs  | Styles | Routines | Stats  | Import  |
+----------+--------+--------+----------+--------+---------+
```

#### Tab 1: Exercises (enhanced existing)
- Keep current grouped/flat view toggle
- Add: exercise difficulty indicator (based on BPM range)
- Add: "Times practiced" counter per exercise
- Add: Quick-add to today's routine button per exercise
- Improve: Expand exercise cards to show description preview

#### Tab 2: Songs (merge "Songs" + "Song Library+")
```
+------------------------------------------------------------------+
| [Search: _______________________________________________]        |
|                                                                   |
| FILTERS:                                                          |
| Genre: [All] [Metal] [Hard Rock] [Classic Rock] [Blues] ...     |
| Difficulty: [All] [Beginner] [Intermediate] [Advanced]           |
| Status: [All] [Learning] [Mastered] [Not Started]                |
| Sort: [Name] [Artist] [Difficulty] [Recently Practiced]          |
|                                                                   |
| MY SONGS (4)                                              [>>]   |
| +------+------+------+------+                                    |
| | Song | Song | Song | Song |  (horizontal scroll cards)         |
| +------+------+------+------+                                    |
|                                                                   |
| ALL SONGS (2,592)                                                |
| +--------------------------------------------------------------+ |
| | [GP] Master of Puppets - Metallica     Advanced   120 BPM    | |
| |      Thrash Metal . Drop D . 1986                    [heart] | |
| +--------------------------------------------------------------+ |
| | [GP] Fade to Black - Metallica         Intermediate 114 BPM  | |
| |      Thrash Metal . Standard . 1984                  [heart] | |
| +--------------------------------------------------------------+ |
| ...                                                              |
| [Load More]                                                      |
+------------------------------------------------------------------+
```

- **My Songs section:** Horizontal scrollable row of cards for songs the user has added to their collection. Each card shows title, artist, progress status, and a mini progress bar.
- **All Songs section:** Virtualized list (load 20, then "Load More"). Each row clickable to open Song Window modal.
- **Heart button:** Toggle add/remove from My Songs collection
- **GP badge:** Show for songs with Guitar Pro tabs available
- **Status filter:** "Learning" / "Mastered" / etc. based on localStorage progress data
- **Sort options:** Name, Artist, Difficulty, Recently Practiced, BPM

#### Tab 3: Styles
- Keep existing grid of style cards
- Add: Click a style to filter exercises AND songs by that style
- Add: Style description / characteristics
- Add: Key artists per style
- Add: Recommended exercises per style

#### Tab 4: Routines (NEW)
```
+------------------------------------------------------------------+
| [led-gold] SAVED ROUTINES                         [+ Create New] |
|                                                                   |
| +--------------------------------------------------------------+ |
| | "Speed Week" Routine                          5 exercises     | |
| | Focus: Alternate Picking, String Skipping     90 min total    | |
| | [Load] [Edit] [Delete]                                        | |
| +--------------------------------------------------------------+ |
| | "Theory Thursday" Routine                     4 exercises     | |
| | Focus: Ear Training, Modes                    60 min total    | |
| | [Load] [Edit] [Delete]                                        | |
| +--------------------------------------------------------------+ |
|                                                                   |
| PRESET ROUTINES                                                   |
| +--------------------------------------------------------------+ |
| | "Beginner Daily" — 30 min warm-up + fundamentals              | |
| | "Intermediate Shred" — 60 min technique focus                 | |
| | "Advanced Theory" — 45 min theory + ear training              | |
| | "Song Learning" — 60 min song-focused routine                 | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

- **Save current routine:** Button in Practice view to save current day's exercise list as a named routine
- **Load routine:** Replaces current day's exercises with saved routine
- **Preset routines:** Curated exercise lists for common goals
- **Storage:** localStorage with key `gf-routines`

#### Tab 5: Stats (NEW)
```
+------------------------------------------------------------------+
| [led-gold] LIBRARY STATISTICS                                    |
|                                                                   |
| Total Exercises: 67                                              |
| Total Songs: 2,592                                               |
| Songs with GP Tabs: 847                                          |
|                                                                   |
| EXERCISES BY CATEGORY                                            |
| [Bar chart -- horizontal bars showing exercise count per cat]    |
|                                                                   |
| SONGS BY GENRE                                                    |
| [Bar chart -- top 10 genres by song count]                       |
|                                                                   |
| SONGS BY DIFFICULTY                                              |
| [Pie/donut chart -- Beginner/Intermediate/Advanced split]        |
|                                                                   |
| MY PRACTICE COVERAGE                                             |
| Categories practiced: 12/23                                      |
| [Grid showing which categories have been practiced]              |
+------------------------------------------------------------------+
```

- Uses recharts (already in project) for visualizations
- Shows library overview stats
- "My Practice Coverage" tracks which exercise categories the user has actually practiced

#### Tab 6: Import (NEW)
```
+------------------------------------------------------------------+
| [led-gold] IMPORT / EXPORT                                       |
|                                                                   |
| IMPORT                                                            |
| [Upload GP files]  Batch upload Guitar Pro files                 |
| [Import from Songsterr]  Search and import songs                 |
| [Import from CSV]  Import custom exercise list                   |
|                                                                   |
| EXPORT                                                            |
| [Export Practice Data]  Download practice history as JSON/CSV    |
| [Export Routines]  Download saved routines                        |
| [Backup All Data]  Full localStorage backup                      |
+------------------------------------------------------------------+
```

- Bulk GP file upload
- Songsterr search integration (existing SongsterrSearch component)
- CSV import for custom exercises
- Full data export/backup

---

## 10. Studio Page Improvements

### Current Issues to Address
- The studio page has its own audio tools but lacks integration with practice tools
- The drum machine / sequencer could benefit from better visual hierarchy

### Proposed Improvements

#### 10A: Project Concept
Add the concept of a "project" that ties together:
- Backing track (Suno or YouTube)
- Metronome settings
- Recording takes
- Notes

#### 10B: Better Track List
```
+------------------------------------------------------------------+
| TRACKS                                          [+ Add Track]    |
|                                                                   |
| +--------------------------------------------------------------+ |
| | [mute] [solo] Track 1: Rhythm Guitar  [volume slider] [pan]  | |
| | [DarkAudioPlayer waveform]                                    | |
| +--------------------------------------------------------------+ |
| | [mute] [solo] Track 2: Lead Guitar    [volume slider] [pan]  | |
| | [DarkAudioPlayer waveform]                                    | |
| +--------------------------------------------------------------+ |
| | [mute] [solo] Track 3: AI Backing     [volume slider] [pan]  | |
| | [DarkAudioPlayer waveform]                                    | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

- Each track gets a DarkAudioPlayer with waveform view
- Mute/Solo/Volume/Pan per track
- "Add Track" menu: Record, Upload File, Generate AI, Import from YouTube

---

## 11. Coach Page Improvements

### Current State
AI Coach page uses the chat-style interface.

### Proposed Improvements

#### 11A: Context-Aware Suggestions
```
+------------------------------------------------------------------+
| [led-gold] AI COACH                                              |
|                                                                   |
| BASED ON YOUR PRACTICE:                                          |
| +--------------------------------------------------------------+ |
| | "You've been focusing on speed exercises but your BPM has     | |
| |  plateaued at 140. Try incorporating legato exercises to      | |
| |  build fluency at lower tempos before pushing speed."         | |
| +--------------------------------------------------------------+ |
|                                                                   |
| SUGGESTED NEXT STEPS:                                            |
| [x] Add "Legato Runs" to tomorrow's practice                    |
| [x] Try "Progressive Tempo" on Alternate Picking at 100-140     |
| [ ] Record yourself playing at current max BPM                  |
|                                                                   |
| ASK THE COACH:                                                    |
| [text input: "How can I break through my speed plateau?"]        |
+------------------------------------------------------------------+
```

- Coach analyzes practice data (doneMap, bpmLog) to give specific suggestions
- Actionable checkboxes that modify the practice routine
- Pre-populated question suggestions based on practice patterns

---

## 12. Global Modal Infrastructure

### Modal Container Styling Updates

Replace the cream faceplate header pattern across all modals:

**Current (problematic):**
```html
<div className="faceplate px-3 sm:px-5 py-3 sm:py-4">
  <!-- cream background, dark text -->
</div>
```

**New (dark header):**
```html
<div className="modal-header px-4 sm:px-6 py-4 sm:py-5">
  <!-- dark gradient background, light text -->
</div>
```

#### New CSS class: `.modal-header`
```css
.modal-header {
  background: linear-gradient(180deg, #1e1c18 0%, var(--bg-panel) 100%);
  border-bottom: 1px solid var(--border-panel);
  position: relative;
}
.modal-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212,168,67,0.15) 50%, transparent);
}
```

### Modal Overlay Updates
```css
.exercise-modal-overlay {
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(4px);  /* add subtle blur */
}

.exercise-modal-content {
  box-shadow: 0 24px 80px rgba(0,0,0,0.8), 0 0 1px rgba(212,168,67,0.1);
}
```

### Section Dividers
Replace `<div className="divider-gold" />` with a more refined divider:
```css
.section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--border-panel) 20%, var(--border-panel) 80%, transparent);
  margin: 16px 0;
}
```

### Scroll Behavior
- Modal content area should scroll independently of the page
- Sticky elements (toolbar, tab bar) should remain fixed within the modal
- On mobile: modal takes full viewport height
- On desktop: modal has max-height of `calc(100vh - 32px)` with internal scroll

---

## 13. Responsive Behavior

### Breakpoints
```
Mobile:    < 640px   (sm)  -- full-width modal, stacked layouts
Tablet:    640-1024px      -- modal max-width 760px, 2-col grids
Desktop:   > 1024px  (lg)  -- modal max-width 860px, 3-col grids
```

### Mobile-Specific Adjustments
- Modal takes full viewport (`min-height: 100vh`, no border-radius)
- Tab bar becomes scrollable horizontal if > 3 tabs
- Practice tools stack vertically
- YouTube embed at full width
- Close button fixed at top-right corner
- "Done" button full-width at bottom of modal

### Desktop-Specific Adjustments
- Modal centered with margin, border-radius 8px
- Practice tools can be 2-3 column grid
- YouTube embed + notes side-by-side on wide screens
- Keyboard shortcuts:
  - `Escape` -- close modal
  - `1/2/3` -- switch tabs
  - `Space` -- play/pause metronome or audio
  - `D` -- mark done

---

## 14. Animation & Motion

### Modal Open/Close
```css
/* Overlay */
@keyframes modal-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Content */
@keyframes modal-content-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```
- Duration: 200ms
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo)

### Tab Switching
- Content fades in: `opacity 0 -> 1` over 150ms
- Optionally: slide direction based on tab index (left/right)

### Progress Updates
- Progress bars animate width changes over 500ms with ease timing
- Checkmarks appear with a scale-in animation (0 -> 1.1 -> 1, 200ms)
- BPM counters animate numerically (count up/down)

### Micro-interactions
- Button press: `transform: translateY(1px) scale(0.98)` on `:active`
- LED indicators: subtle pulse when active (`box-shadow` animation)
- Star rating: each star scales up slightly on hover

---

## 15. Accessibility

### Keyboard Navigation
- All modals trap focus within when open
- Tab order follows visual layout
- `Escape` closes modal
- `Enter/Space` activates buttons
- Arrow keys navigate tabs

### Screen Reader
- Modal has `role="dialog"` and `aria-modal="true"`
- `aria-label` on modal describes content: "Song: Master of Puppets by Metallica"
- Tab panels use `role="tablist"`, `role="tab"`, `role="tabpanel"` with proper `aria-selected` and `aria-controls`
- Audio player has `aria-label="Audio player"` with spoken state ("Playing", "Paused")
- Progress indicators use `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

### Color Contrast
- All text meets WCAG AA (4.5:1 ratio minimum)
- Gold (#D4A843) on dark (#18181c) = ~7.2:1 ratio (passes AAA)
- Muted text (#5c5852) on dark (#18181c) = ~2.8:1 (fails for body text -- use `#9a9590` minimum for readable text, reserve `#5c5852` for decorative labels only)
- Error red (#C41E3A) on dark = ~4.6:1 (passes AA)

### Focus Indicators
- All interactive elements show visible focus ring: `outline: 2px solid var(--gold); outline-offset: 2px`
- Focus ring only shows on keyboard navigation (`:focus-visible`), not on mouse click

---

## Implementation Priority

### Phase 1: Foundation (implement first)
1. `DarkAudioPlayer` component
2. `.modal-header` CSS class (dark header replacing faceplate)
3. Modal infrastructure updates (overlay blur, scroll behavior)

### Phase 2: Song Window
4. New `SongModal.tsx` rewrite with dark header
5. Practice tab with auto-YouTube + GP viewer
6. Log tab with ratings, progress, recordings

### Phase 3: Exercise Window
7. Update `ExerciseModal.tsx` with dark header and sticky toolbar
8. Reorder sections: Description > Tab > Metronome > Backing > Tools
9. Replace all `<audio>` with `DarkAudioPlayer`

### Phase 4: Theory Window
10. Add category detection for theory exercises
11. Create theory modal variant with Tool tab
12. Link to Learning Center interactive tools

### Phase 5: Dashboard & Pages
13. Dashboard: Weekly Focus, Quick Start, Recent Activity
14. Library: 6-tab structure
15. Practice page: Focus mode, card improvements

---

## File Mapping

| Spec Section | File(s) to Create/Modify |
|---|---|
| DarkAudioPlayer | `src/components/DarkAudioPlayer.tsx` (NEW) |
| Modal CSS | `src/app/globals.css` (MODIFY) |
| Song Window | `src/components/SongModal.tsx` (REWRITE) |
| Exercise Window | `src/components/ExerciseModal.tsx` (MODIFY) |
| Theory Window | `src/components/TheoryModal.tsx` (NEW) or branch within ExerciseModal |
| Dashboard | `src/components/GuitarForgeApp.tsx` (MODIFY -- dash section) |
| Library tabs | `src/components/GuitarForgeApp.tsx` (MODIFY -- lib section) |
| Routines | `src/components/RoutinesTab.tsx` (NEW) |
| Library Stats | `src/components/LibraryStats.tsx` (NEW) |
| Import/Export | `src/components/ImportExportTab.tsx` (NEW) |

---

*End of specification.*
