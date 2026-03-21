# GuitarForge Redesign Plan V2

## 1. Executive Summary

GuitarForge has grown into a feature-rich guitar practice platform, but the rapid pace of development has introduced inconsistencies, unnecessary complexity, and layout problems across multiple pages. This redesign addresses concrete user feedback on every major page.

**Core changes:**

- **Dashboard:** Rename "Channel Settings" to "Weekly Focus." Simplify the Setlist (drop the 6-stage system). Rethink the layout to feel like a real training dashboard with actionable data.
- **Practice Page:** Remove song stages. Unify song picker and exercise picker. Add new sections that make the practice session more structured and useful.
- **Learn Page:** Clean up cluttered layout. Better organize lessons, exercises, and tools into clear sections.
- **Library Page:** Restructure into 6 tabs: Exercises, Styles, My Songs, My Recordings, My Backing Tracks, Song Library.
- **Studio:** Simplify layout, fix inconsistent button sizes, fix broken sidebar library, add My Recordings section.
- **AI Coach:** Visual redesign for a more prominent, visually appealing experience.
- **Modals:** Complete reimagining into 3 distinct types: Song Window, Exercise Window, Theory/Ear Training Window.
- **Audio Player:** Dark theme redesign, more useful controls.

**Why now:** The app has hit a maturity point where polish and UX consistency matter more than new features. Every page needs a second pass focused on real-world usability for a guitarist who opens this app daily.

---

## 2. Dashboard Redesign

### Current Problems

1. "Channel Settings" label is unclear — the user has to figure out what it means.
2. The Setlist section shows a 6-stage progress system per song that adds complexity without practical value for weekly planning.
3. The dashboard shows data (stats, streak, weekly schedule) but does not feel like a practical training hub. There is no clear "what should I do today" experience.
4. Suno backing track suggestion card takes up space but has limited value on the dashboard.
5. Smart Suggestions section is useful but buried below the schedule.

### New Layout (Top to Bottom)

**A. Hero Card (Keep, Refine)**
- Same position, same gradient design.
- Add today's date and day name.
- Show "Today: [categories for today]" e.g. "Warm-Up, Shred, Riffs" below the exercise count.
- Keep streak badge and Start Practice button.

**B. Stats Row (Keep As-Is)**
- 4 stat cards: Streak, Progress %, Minutes, Days Active.
- No changes needed — clean and useful.

**C. Weekly Focus (Renamed from "Channel Settings")**
- New section title: "Weekly Focus"
- Contains:
  - **Mode/Scale/Style selectors** — compact inline row with dropdowns. Currently these are somewhat hidden in the schedule editor. Move them here as the primary "channel" settings.
  - **Week counter** with Previous/Next buttons.
  - Settings icon to open the full schedule editor (same as current "Edit schedule" toggle).

**D. Weekly Schedule Grid (Keep, Refine)**
- 7-day grid showing categories, hours, progress.
- Move the "Edit schedule" toggle into the Weekly Focus header.
- Remove redundancy with settings that are now in Weekly Focus.

**E. Today's Plan (NEW)**
- A section that shows today's exercises in a clean list, with:
  - Exercise name, category color dot, duration.
  - Checkbox to mark done (same as practice page, but quick-access).
  - Click to open exercise in modal.
- This replaces the need to navigate to Practice page for quick overview.
- If no exercises are built for today, show "Build Today's Routine" button.

**F. Setlist (Simplified)**
- Title: "Weekly Songs"
- Each song shows: name, tab link, remove button.
- **Remove the 6-stage progress indicator.** Replace with a simple "Practicing / Learned" toggle or nothing.
- Add song: same input fields (name + URL) + Songsterr search.
- Optional: "Practice time" input per song (minutes to spend this week).
- Keep it compact — 2-3 songs max visible, scrollable if more.

**G. Smart Suggestions (Move Up)**
- Move from position 4 to position 5 (after Setlist), or make it a collapsible card at the top right on desktop (2-column layout).

**Remove from Dashboard:**
- Suno Backing Track suggestion card — this belongs in the Practice page or Studio, not the home screen.
- Analytics toggle — move to Report/Profile page.

### Desktop 2-Column Layout

On screens >= 1024px:
- Left column (60%): Hero Card, Today's Plan, Weekly Schedule
- Right column (40%): Stats Row (stacked), Weekly Focus, Setlist, Suggestions

This creates a more natural information hierarchy for a training dashboard.

---

## 3. Practice Page Redesign

### Current Problems

1. Song stages (6-step system from STAGES constant) add unnecessary complexity. Most guitarists just want to practice a song, not track 6 micro-stages.
2. Song picker (shows custom songs with stages) and exercise picker (shows auto-filled exercises) look different — different widths, different styling, different interaction patterns.
3. Auto-fill button is reportedly broken in some cases.
4. The page lacks structure — it is a flat list of exercises without clear sections.

### New Layout

**A. Day Selector Bar (Keep, Refine)**
- Horizontal day tabs at the top.
- Show category tags and total minutes for selected day.
- Keep "Build Day" button.

**B. Session Timer (NEW — Top Bar)**
- A persistent bar showing:
  - Total practice time for today (counting from first exercise opened).
  - Exercises completed / total.
  - A mini progress bar.
- This gives the user a sense of "session in progress."

**C. Exercise List (Unified Design)**
- All items (exercises AND songs) use the same card component:
  - Left: category color dot + exercise/song name.
  - Center: duration, BPM range.
  - Right: Done checkbox, Open button.
- Songs show "Song" category with Songs color.
- Remove the 6-stage progress from song items. Songs are simply exercises in the list.
- Click any card to open the appropriate modal (Exercise or Song type).

**D. Exercise Picker (Unified)**
- One "Add Exercise" button that opens a picker modal.
- Picker has two tabs: "Exercises" and "Songs (Library)".
- Both tabs have search, category filter, and the same card width/style.
- Selecting an item adds it to the day's exercise list.

**E. Quick Tools Bar (NEW)**
- A sticky bar (bottom on mobile, sidebar on desktop) with:
  - Metronome (quick access — opens MetronomeBox).
  - Timer (quick access).
  - Record button (quick access — opens RecorderBox).
- These are the tools guitarists reach for constantly. Having them one tap away is critical.

**F. Remove from Practice Page:**
- Song stages and stage progress tracking.
- Different song picker UI — merge into unified exercise picker.

---

## 4. Learn Page Redesign

### Current Problems

1. The page has three sections (Lessons, Exercises, Tools) but the exercises section is cluttered with 10+ interactive exercise types crammed together.
2. Visual density is too high — too many cards, buttons, and options visible at once.
3. No clear learning path or progression.

### New Organization

**A. Tab Structure (Keep but Refine)**

Three tabs: **Lessons** | **Exercises** | **Tools**

**B. Lessons Tab (Refine)**
- Group lessons by category (Fundamentals, Rhythm, Scales, Intervals, Chords, Progressions, Advanced).
- Show category as collapsible sections.
- Each lesson card: title, short description, completion indicator (checkmark if quiz passed).
- Lesson completion data already exists in localStorage `gf-learn`.
- Add a "Recommended Next" card at the top based on completion progress.

**C. Exercises Tab (Major Cleanup)**

Current exercises:
1. Interval Ear Training
2. Chord Ear Training
3. Scale Ear Training
4. Progression Ear Training
5. Fretboard Note Quiz
6. Chord Construction
7. Interval Builder
8. Scale Builder

These should be organized into 3 clear groups:

**Ear Training:**
- Intervals (hearing)
- Chords (hearing)
- Scales (hearing — if exists)
- Progressions (hearing)

**Fretboard Knowledge:**
- Note Quiz (visual)
- Chord Construction (visual + audio)

**Theory Builders:**
- Interval Builder
- Scale Builder

Each group gets a section header. Within each group, exercises show as cards with:
- Name, icon, brief description.
- Stats (XP earned, accuracy, streak).
- "Start" button.

Remove visual clutter by:
- Not showing all settings/options until the user clicks into an exercise.
- Using a consistent card size for all exercises.
- Limiting visible stats to 1-2 key numbers per card.

**D. Tools Tab (Refine)**

Current tools: Scales reference, Chords reference, Circle of Fifths, Progressions reference.

Keep all four, but:
- Use a 2x2 grid on desktop, 1-column on mobile.
- Each tool card: icon, title, brief description. Click to expand inline or open fullscreen.
- Currently these tools are quite large when expanded. Consider opening them as full-page overlays rather than inline expanding.

---

## 5. Library Page Redesign

### Current State

The Library page currently has 4 tabs: Exercises, Styles, Songs, Song Library. The Styles tab is broken (clicking does nothing).

### New 6-Tab Structure

**Tab 1: Exercises**
- Keep as-is: grouped exercise library with search and category filter.
- Shows all 67+ exercises in collapsible category groups.
- Click to open Exercise modal.

**Tab 2: Styles (Fix + Enhance)**
- Currently broken — needs implementation.
- Content per style (Metal, Hard Rock, Blues, Jazz, etc.):
  - Description of the style.
  - Key techniques used (e.g., Metal: palm muting, tremolo picking, sweep picking).
  - Recommended exercises from the exercise library (filtered by style tag).
  - Recommended songs from the song library (filtered by genre).
  - Suggested scales/modes (e.g., Metal: Aeolian, Phrygian, Harmonic Minor).
  - Example YouTube video or Suno backing track in that style.
- This becomes a "style guide" — the user picks their style and gets a curated view of relevant content.

**Tab 3: My Songs**
- Songs the user has personally added or marked as "Add to My Songs."
- Source: custom songs added via Setlist + songs marked from Song Library.
- Each card shows: title, artist, progress status (Not Started / Learning / Can Play Slow / Full Speed / Mastered).
- "Add to My Songs" button needs to be added to the SongModal component.
- Data stored in localStorage key `gf-my-songs`.

**Tab 4: My Recordings**
- All recordings made via RecorderBox across all exercises.
- Currently recordings are stored in IndexedDB `gf-studio` store with metadata in localStorage `gf-recordings`.
- List view: recording name, date, duration, associated exercise (if known), play/download/delete buttons.
- Audio player: dark themed (not the default white browser player).

**Tab 5: My Backing Tracks**
- All Suno-generated backing tracks from the `gf-suno-lib` IndexedDB store.
- Currently accessible only through Studio's library sidebar.
- List view: track title, style/scale/mode/bpm, date, play/delete/download buttons.
- "Generate New" button that links to Studio or opens a generation dialog.

**Tab 6: Song Library**
- The existing 2,592+ song database (currently in the "Songs" view).
- Move the full song library browser here — genre tabs, search, difficulty filter.
- Keep all current functionality but as a Library sub-tab.
- Add "Add to My Songs" button per song card (heart icon or button).

### Implementation Notes

- The "Songs" view in the nav (`view === "songs"`) should be removed as a top-level nav item.
- Its content moves to Library > Song Library tab.
- Nav simplifies to: Home, Practice, Learn, Studio, Library.
- The Songs nav item in MAIN_NAV can be repurposed or removed.

---

## 6. Studio Improvements

### Current Problems

1. Messy layout — transport controls, track list, mixer, library sidebar all compete for space.
2. Button sizes are inconsistent (some tiny, some large).
3. Left sidebar library (Suno tracks) does not work properly.
4. Too many features visible at once — drum machine, effects, amp presets, input settings.
5. No "My Recordings" section visible in studio.

### Redesign Approach

**A. Simplified Top Bar**
- Transport controls in a clean horizontal bar: Rewind, Play, Stop, Record, Loop.
- All buttons: same size (36x36px), same style, consistent icons.
- BPM display + tap tempo on the right.
- Time signature selector on the far right.
- Remove shortcut hints from the transport bar (too cluttered). Put them in a help tooltip.

**B. Track Area (Center)**
- Clean vertical track list.
- Each track: name, color stripe, waveform, volume slider, pan knob, mute/solo/arm buttons.
- Collapsed by default — expand for effects.
- Track header buttons all same size and alignment.

**C. Right Panel: Context Sidebar**
- Tabs: **Library** | **Effects** | **Recordings**
- **Library tab:**
  - Suno-generated tracks (from IndexedDB).
  - Import from file.
  - Add drum track.
  - Fix: currently the library sidebar loads tracks but drag-to-add and play buttons are inconsistent. Ensure each track has: Play preview, Add to project, Delete.
- **Effects tab:**
  - Shows effects for the selected track only.
  - Amp presets at the top.
  - Individual effect controls below.
- **Recordings tab (NEW):**
  - All saved recordings from `gf-studio` IndexedDB.
  - Play, rename, add to project, delete.
  - This replaces the need for a separate recordings page.

**D. Bottom Panel: Drum Machine**
- Only visible when a drum track is selected or "Add Drum" is clicked.
- Collapsible. Not visible by default.
- Preset selector + pattern grid when expanded.

**E. Button Consistency**
- Define 3 button sizes for Studio:
  - Small (transport, track controls): 32x32px
  - Medium (sidebar actions): full-width, 36px height
  - Text buttons: font-label text-[11px], same padding everywhere

---

## 7. AI Coach Improvements

### Current Problems

1. Visually plain — just a chat interface with no personality.
2. The quick action buttons are useful but feel like an afterthought.
3. No visual distinction between the coach and a generic chatbot.

### Redesign

**A. Coach Header (NEW)**
- A header card at the top with:
  - Coach avatar/icon (stylized guitar pick or amp icon, not a generic bot).
  - Title: "AI Coach" with a subtitle showing the user's current context (e.g., "Week 3 / Metal / Am Aeolian").
  - Connection status: "Demo Mode" or "API Connected" indicator.

**B. Quick Actions (Elevated)**
- Move quick action buttons from below the chat to a horizontal bar above the chat input.
- Use pill-shaped buttons with icons:
  - "Practice Plan" (calendar icon)
  - "Song Recs" (music icon)
  - "My Progress" (chart icon)
  - "Theory Help" (book icon)
  - "Backing Track" (waveform icon)
- These should feel like the primary way to interact, not an afterthought.

**C. Chat Messages (Style Upgrade)**
- User messages: right-aligned, subtle gold tint background.
- Coach messages: left-aligned, slightly elevated card with a subtle gradient.
- Bold text in coach responses uses gold color (already done via renderContent).
- Add a "copy" button on coach messages for long responses.

**D. Context Card (NEW — Collapsible)**
- A small collapsible card at the top showing what the coach knows:
  - Player level, genres, streak, exercises done this week.
  - "The more you use GuitarForge, the better my advice gets."
- This makes the coach feel personalized and encourages profile completion.

**E. Visual Theme**
- Background: subtle gradient from #121214 to #0f0f12 (darker at top).
- Chat area: slightly recessed (inset shadow).
- Overall feel: like talking to a knowledgeable guitar instructor in a dimly lit studio.

---

## 8. Three Modal Types

### Current State

There are currently two modals:
- `ExerciseModal.tsx` — used for all exercises (practice, tutorial, log tabs).
- `SongModal.tsx` — used for songs from Song Library (practice, tutorial, notes tabs).

Both share similar structure but have differences in header style, tab names, and content.

### New Architecture: 3 Modal Types

All three share a common modal shell (overlay, close button, max-width, scrollable content) but differ in layout and content.

---

### TYPE 1: SONG WINDOW

**When opened:** Clicking any song from Song Library, My Songs, or Setlist.

**Header (Dark — No Faceplate)**
- Background: `#1a1a1e` with subtle border, NOT the cream faceplate.
- Layout:
  - Song title (font-heading, large, white/cream text).
  - Artist name (font-label, gold text, smaller).
  - Metadata row: genre tag, difficulty tag, key, tempo, tuning — all inline.
  - "Add to My Songs" heart/button (if not already in My Songs).
- Close button: top-right, same as current.

**Section 1: Backing Track (Open by Default)**
- YouTube embed: auto-search "[song title] [artist]" on YouTube and embed first result.
- Below: search bar to find different YouTube video.
- Below: buttons: "Backing Track" search, "Live Performance" search.
- Suno AI generation option (collapsed by default).

**Section 2: Guitar Pro Tabs**
- GpFileUploader component (same as current).
- Download tabs button.
- Songsterr link.

**Section 3: Metronome**
- MetronomeBox component.
- Pre-set to the song's tempo if known.

**Bottom Tabs: Practice | Tutorial | Log**
- **Practice tab:** YouTube embed (default — the backing track from Section 1) + backing track search shortcuts.
- **Tutorial tab:** auto-search "[song title] [artist] guitar tutorial" on YouTube. Show result.
- **Log tab:** practice notes, rating (1-5 stars), progress status dropdown (Not Started / Learning / Slow / Full Speed / Mastered), practice history.

---

### TYPE 2: EXERCISE WINDOW

**When opened:** Clicking any exercise from Practice page, Library, or Learn page.

**Header (Dark — No Faceplate)**
- Background: `#1a1a1e`, NOT cream faceplate.
- Layout:
  - Category tag (colored) + BPM range + duration.
  - Exercise title (font-heading, large).
  - **Description:** Full exercise description text. This should be prominent and readable (font-size 14px, line-height 1.7). Current description is small and easy to miss.
  - Tips section: gold-tinted card with exercise tips (already exists, keep style).

**Top Toolbar (NEW — Sticky)**
- A sticky bar just below the header:
  - Record button (red circle, starts recording).
  - Timer display (elapsed time since exercise opened).
  - Metronome quick-toggle (click to start/stop at exercise BPM).
  - Done button.

**Section 1: Guitar Pro Tabs**
- GpFileUploader with AlphaTex notation if available.
- Tab download and Songsterr links.

**Section 2: Metronome (ABOVE Backing Track)**
- MetronomeBox component.
- Pre-set to the exercise's BPM midpoint.
- Prominent placement — this is the most important tool for exercises.

**Section 3: Backing Track**
- YouTube embed (if user has pasted a URL).
- YouTube search shortcuts.
- Suno AI generation (same as current, but below metronome).

**Section 4: Recorder**
- RecorderBox component.
- Shows "My recordings for this exercise" list.

**Bottom Tabs: Practice | Tutorial | Log**
- Same as current but with reordered sections within Practice tab (metronome above backing track).

---

### TYPE 3: THEORY / EAR TRAINING WINDOW

**When opened:** Clicking theory/ear training exercises from Learn page. Specifically exercises with categories: "Ear Training", "Fretboard", "Modes" (and exercises that are interactive quizzes).

**Header (Dark)**
- Category tag + exercise title.
- Description styled as a "lesson introduction" — larger text, more padding, feels educational.

**Main Content: Interactive Exercise Area**
- Full-width interactive area for the specific exercise type:
  - **Interval Ear Training:** Play button, answer options, streak counter, accuracy display.
  - **Chord Ear Training:** Same pattern.
  - **Fretboard Quiz:** Fretboard visualization with click targets.
  - **Scale Builder:** Interactive scale diagram.
- This area is the focus — no tabs, no distracting sections.
- Design like a learning module: clean, spacious, focused.

**Sidebar / Bottom: Reference**
- Collapsible reference panel:
  - For intervals: interval names table with reference songs.
  - For chords: chord quality chart.
  - For fretboard: note names reference.
- "Connected Topics" links to relevant Learn page lessons.

**Progress Bar**
- At the top: XP earned, current level, streak, accuracy percentage.
- Achievement badges if any are unlocked.

**No metronome, no backing track, no recorder** — these are not relevant for theory exercises.

### Modal Type Detection Logic

```
function getModalType(exercise: Exercise): "song" | "exercise" | "theory" {
  if (exercise.c === "Songs" || exercise.songId) return "song";
  if (["Ear Training", "Fretboard", "Modes"].includes(exercise.c) && isInteractiveExercise(exercise)) return "theory";
  return "exercise";
}
```

For SongEntry items (from Song Library), always use Type 1.

---

## 9. Audio Player Redesign

### Current Problem

The default HTML `<audio>` element with `controls` attribute renders a white/light player that clashes badly with the dark theme. Buttons are hard to see.

### Solution: Custom Audio Player Component

Create a `DarkAudioPlayer` component that replaces all `<audio controls>` elements.

**Visual Design:**
- Background: `#111113` with `1px solid #1a1a1a` border.
- Rounded corners: 8px.
- Height: 44px.

**Controls (left to right):**
1. Play/Pause button (gold icon, 28x28px).
2. Progress bar (gold fill on dark track, seekable).
3. Current time / Total time (font-readout, #555 text).
4. Volume slider (compact, gold).
5. Speed control (0.5x / 0.75x / 1x / 1.25x / 1.5x / 2x — dropdown).
6. Loop toggle (icon, gold when active).
7. Download button (icon).

**Usage:** Replace every instance of:
```html
<audio src={url} controls className="..." />
```
With:
```html
<DarkAudioPlayer src={url} loop={true} />
```

Affected locations:
- ExerciseModal: Suno backing track player.
- SongModal: any audio playback.
- Studio: track preview in library sidebar.
- Library > My Recordings tab.
- Library > My Backing Tracks tab.

---

## 10. Priority Order

### Phase 1 — Critical UX Fixes (Highest Impact, 1-2 days)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Remove 6-stage song system everywhere | S | High — simplifies entire Practice + Dashboard flow |
| 2 | Rename "Channel Settings" to "Weekly Focus" | XS | Medium — clarity |
| 3 | Fix Styles tab in Library (currently broken) | M | High — reported broken |
| 4 | Create DarkAudioPlayer component | M | High — fixes white player issue everywhere |
| 5 | Unify exercise/song picker UI in Practice page | M | High — consistency |

### Phase 2 — Modal Reimagining (Highest Complexity, 3-5 days)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 6 | Type 1: Song Window (dark header, reordered sections) | L | High |
| 7 | Type 2: Exercise Window (sticky toolbar, metronome above backing) | L | High |
| 8 | Type 3: Theory Window (lesson-style layout) | L | Medium |
| 9 | Modal type detection and routing | S | Required for 6-8 |

### Phase 3 — Page Redesigns (2-3 days)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 10 | Dashboard: Today's Plan section + 2-column desktop layout | L | High |
| 11 | Dashboard: Simplified Setlist | M | Medium |
| 12 | Practice: Session timer bar + quick tools | M | Medium |
| 13 | Learn page: reorganize exercises into 3 groups | M | Medium |
| 14 | AI Coach: header, elevated quick actions, visual upgrade | M | Medium |

### Phase 4 — Library Restructure (2-3 days)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 15 | Library: My Songs tab + "Add to My Songs" button | M | High |
| 16 | Library: My Recordings tab | M | Medium |
| 17 | Library: My Backing Tracks tab | M | Medium |
| 18 | Library: Move Song Library from Songs nav to Library tab | M | Medium |
| 19 | Library: Styles tab with curated content per style | L | Medium |

### Phase 5 — Studio Cleanup (2-3 days)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 20 | Studio: unified button sizing and transport bar | M | Medium |
| 21 | Studio: context sidebar with Library/Effects/Recordings tabs | L | High |
| 22 | Studio: fix library sidebar track loading and interaction | M | High |
| 23 | Studio: collapsible drum machine | S | Low |

---

## 11. Estimated Effort Per Item

| Size | Definition | Time Estimate |
|------|-----------|---------------|
| XS | Config change, rename, copy update | < 30 min |
| S | Single component change, simple logic | 1-2 hours |
| M | New component or significant refactor of existing one | 3-6 hours |
| L | Multiple components, new data flow, complex UI | 1-2 days |
| XL | Architecture change, multiple page redesign | 3+ days |

### Total Estimated Effort

- Phase 1: 1.5-2 days
- Phase 2: 3-5 days
- Phase 3: 2-3 days
- Phase 4: 2-3 days
- Phase 5: 2-3 days

**Total: 10-16 working days** for full implementation across all phases.

### Recommended Approach

Start with Phase 1 (quick wins that fix broken/annoying things), then Phase 2 (modals are the core interaction — fixing them improves everything), then tackle pages in order of user frequency: Dashboard > Practice > Library > Learn > Studio > Coach.

---

## Appendix: Data Model Changes

### New localStorage Keys

- `gf-my-songs` — Array of `{ songId: number, addedDate: string, status: string }` for user's personal song collection.
- Remove `songLibProgress` usage of 6-stage system. Replace with simple status string per song.

### Constants Changes

- `STAGES` constant in `constants.ts` — can be deprecated. Keep in code for backward compatibility but stop rendering stage UI.
- Add `SONG_STATUSES = ["Not Started", "Learning", "Can Play Slow", "Full Speed", "Mastered"]` to constants.

### Component File Changes

| File | Change |
|------|--------|
| `ExerciseModal.tsx` | Refactor into Exercise Window (Type 2). Remove faceplate header. Add sticky toolbar. |
| `SongModal.tsx` | Refactor into Song Window (Type 1). Dark header. Reorder sections. |
| `TheoryModal.tsx` | **New file.** Theory/Ear Training Window (Type 3). |
| `DarkAudioPlayer.tsx` | **New file.** Custom dark-themed audio player. |
| `GuitarForgeApp.tsx` | Remove song stages, simplify Setlist, add Today's Plan, restructure Library tabs. |
| `LearningCenterPage.tsx` | Reorganize exercises into 3 groups. Clean up layout. |
| `StudioPage.tsx` | Unify button sizes. Add context sidebar. Fix library. |
| `AiCoachPage.tsx` | Add coach header. Elevate quick actions. Visual refresh. |
| `Navbar.tsx` | Remove "Songs" from MAIN_NAV (merged into Library). |

---

*Document generated: 2026-03-20*
*For: GuitarForge Practice Management Platform*
*Author: Project Manager (Claude)*
