# Design Audit Report #2 -- GuitarForge

**Date:** 2026-03-19
**Previous Audit:** 2026-03-18 (Score: 6.5/10)
**Auditor:** UI/UX Design Agent (design-audit + frontend-design skills)
**Resolution tested:** 1280x800 desktop, 375x812 mobile
**Pages audited:** Dashboard, Practice, Library, Songs, Studio, Learning (Lessons/Exercises/Tools), Coach, Report, Profile, Exercise Modal

---

## Overall Score: 7.0 / 10

The app has made incremental progress since the last audit. The design system foundation (globals.css) remains the strongest asset -- gold accent system, panel styling, button bevels, LED indicators, and grain textures create a genuinely distinctive "Vintage Amp" identity. The mobile bottom tab bar was added (addressing P0 from last audit), and the Learning Center tools (fretboard, scales) are visually impressive. However, critical navigation state bugs persist, layout issues remain unsolved, and several pages still lack the polish that the design system promises.

---

## What Improved Since Last Audit (6.5 -> 7.0)

### 1. Mobile Bottom Tab Bar Added
The bottom tab bar with 4 primary items (Practice, Library, Songs, Studio) + More overflow is implemented. Icons are clear, the gold active state works, and the More overlay menu is well-designed with proper z-ordering. This was the #1 priority item from the last audit.
- **File:** `src/components/Navbar.tsx` lines 26-31 (MOBILE_TABS), lines 84-115 (bottom bar JSX)
- **File:** `src/app/globals.css` lines 1001-1033 (`.mobile-tab-bar`, `.mobile-tab-item`)

### 2. Exercise Modal is Functional and Well-Designed
The exercise modal was successfully opened during testing. It features:
- Clean category tag + BPM + duration header
- Practice / Tutorial / Log tabs
- Embedded YouTube tutorial with custom URL input
- Guitar Pro tab rendering via alphaTab with speed controls (0.25x-2x), loop, metronome, bar navigation
- The modal overlay uses proper backdrop opacity and the content panel has good contrast
- **File:** `src/components/ExerciseModal.tsx`

### 3. Learning Center Tools Are Impressive
The Tools > Scales view with the full fretboard diagram is a highlight:
- Root note selector with all 12 notes in clean button grid
- Scale type selector (10 options) with clear active state (gold border)
- Scale info card showing notes + intervals with play button
- Full 16-fret fretboard with color-coded note dots and interval labels
- **File:** `src/components/LearningCenterPage.tsx`

### 4. Studio DAW Interface Maintained Quality
Transport controls, timeline with beat markers, master track panel, and drum machine sequencer all render correctly. The empty state with dashed border and "Drop a loop" message is clean.

### 5. Stat Numbers Use Oswald
The `.font-stat` class was added (globals.css line 1038) and the Dashboard stats (Done, Total, Minutes, Days Active) now use Oswald 600. This improves visual hierarchy.

### 6. Profile Page Has Clear Sections
Profile is organized into Personal, Preferred Genres, Goals & Inspiration with gold LED bullets on section headers. Genre toggle chips work well with gold active state.

---

## Critical Issues (Fix Now)

### 1. [CRITICAL] Navigation State Instability -- View Jumps Randomly
- **Impact:** 10/10 -- During testing, clicking a nav button frequently navigated to a DIFFERENT view than the one clicked. Examples observed: clicking Studio landed on Dashboard; clicking Report landed on Practice; clicking Profile opened an Exercise Modal; clicking Learning > Exercises jumped to Dashboard with Schedule Edit open.
- **Root Cause:** `src/components/GuitarForgeApp.tsx` line 61-77 -- View state is persisted to localStorage and restored on mount. HMR/Fast Refresh triggers the useEffect to re-read stale localStorage while a `setView()` call is in-flight, causing a race condition. The `view` is included in the save payload (line 77), so it writes back the stale view on the debounced timer.
- **Fix:** Either (a) remove `view` from localStorage persistence entirely and use URL hash routing instead (`window.location.hash`), or (b) use `useRef` to track the latest view and only read localStorage on true first mount (not HMR), or (c) add a `key` or guard to prevent the save effect from overwriting a view change that happened less than 500ms ago.
- **File:** `src/components/GuitarForgeApp.tsx:56-80`

### 2. [CRITICAL] Mobile Responsive Breakpoint Fails After HMR
- **Impact:** 9/10 -- On initial fresh page load at 375px, the mobile bottom tab bar renders correctly and the desktop nav is hidden. However, after any HMR/Fast Refresh (triggered by state changes during navigation), the app reverts to showing the desktop 9-item horizontal nav at 375px wide. This means during active development or when the dev server pushes updates, mobile users see the desktop layout.
- **Root Cause:** Tailwind CSS 4 classes (`hidden sm:flex` / `flex sm:hidden`) should be pure CSS media queries. The failure only happens after HMR, suggesting that Tailwind's CSS is being reinjected in a way that loses the media query context, or a parent element's style is being recalculated.
- **Fix:** Investigate if the `sm:` breakpoint is being properly compiled by Tailwind CSS 4. Test with `npm run build` to see if the production build has the same issue. If it's HMR-only, it may be acceptable for production but still degrades DX significantly.
- **File:** `src/components/Navbar.tsx:61,84`

### 3. [HIGH] Practice Page Has 60% Empty Space
- **Impact:** 7/10 -- With 1 exercise on Sunday, the Practice page shows a single exercise card and then vast empty dark space below. This is the primary page users visit daily and it feels broken/incomplete.
- **Fix:** Add contextual content below the exercise list: "Suggested Exercises" section, a mini weekly progress summary, or a motivational stat card. At minimum, add a visual empty-state illustration or a prominent "Add more exercises" CTA.
- **File:** `src/components/GuitarForgeApp.tsx` (Practice view section)

### 4. [HIGH] Library / Songs Pages Have No Virtualization
- **Impact:** 7/10 -- Library renders all 120 exercises as flat DOM nodes. Songs page renders 338 songs as DOM nodes (visible from the filter count "ALL (338)"). Both cause extremely long scrollable pages and potential performance issues.
- **Fix:** Either (a) collapse categories by default with expand/collapse, (b) paginate with 20 items per page, or (c) use `@tanstack/virtual` for virtual scrolling.
- **File:** `src/components/GuitarForgeApp.tsx` (Library view), song rendering section

---

## Page-by-Page Findings

### Dashboard
**Score: 6/10**
- Channel Settings still appears first, before practice content -- priority is wrong
- The 4-column stat row (Done/Total/Minutes/Days Active) uses Oswald font now (improvement)
- Progress bar with segmented VU-meter style at 100% looks great
- Schedule day cards with gold border on active day work well
- "FINISH WEEK & ARCHIVE" and "RESET ALL" buttons at bottom are properly styled (gold + danger)
- **Issue:** "REMOVE" buttons on Setlist use `btn-danger` class which is crimson -- consistent with design system now (improved from last audit's red complaint)
- **Issue:** No visual hierarchy -- everything has equal weight. The user's eye has no clear landing point.

### Practice
**Score: 5.5/10**
- Progress bar at top (1/1 EXERCISES 100%) is clear and well-styled
- Day tab strip (SUNDAY through SATURDAY) uses Oswald with proper active state
- Exercise card shows category tag (WARM-UP), exercise name, metadata -- good information density
- **Issue:** Native `<select>` dropdowns for "+ Exercise" and "+ Song" with 100+ options -- nearly unusable (flagged in last audit, not fixed)
- **Issue:** Massive empty space below the single exercise card
- **Issue:** "Mark undone" button text is plain -- should be a ghost button with icon
- **Issue:** UP/DN/SWAP/DEL buttons are tiny text labels -- should be icon buttons with proper touch targets

### Library
**Score: 6.5/10**
- Tab strip (Exercises/Styles/Songs/Song Library+) works well with gold active state
- Search input has proper recessed styling
- Category filter pills with count (e.g., "WARM-UP (6)") are color-coded per COL constants -- good
- Exercise list items show category tag, exercise name (Oswald), and metadata in monospace -- consistent
- "+" button on each exercise for adding to schedule is clear
- **Issue:** 22 category pills wrap to 3 lines -- overwhelming. Consider grouping into collapsible sections
- **Issue:** All 120 items rendered as a flat list with no pagination or grouping
- **Issue:** Category tag colors (green, red, blue, etc.) sometimes clash with the warm gold palette

### Songs
**Score: 6/10**
- "SONG LIBRARY" heading uses Oswald -- correct
- Search bar and difficulty filter pills (ALL/BEGINNER/INTERMEDIATE/ADVANCED) work well
- Song cards show name, difficulty badge, artist, genre/key/BPM
- Difficulty badges use appropriate colors (green=beginner, yellow=intermediate, red=advanced)
- **Issue:** 338 songs in one flat list -- extremely long page, no pagination
- **Issue:** Song cards are information-sparse -- no progress indicator (0/6 stages), no album art
- **Issue:** "+ ADD SONG" button uses ghost style but is easy to miss

### Studio
**Score: 8/10** (best page)
- Transport controls (rewind, stop, play, record, loop) are authentic DAW-style
- BPM display in segment-display style (JetBrains Mono, gold text, recessed background)
- Time display "00:00.0" with ghost overlay "88:88.8" is a clever detail
- Master volume slider with dB readout works
- Timeline with numbered beat markers (1-16) is clear
- Empty state with dashed border and musical note icon is inviting
- Bottom status bar (4/4, 120 BPM, Am, 0 tracks, SNAP) is proper DAW convention
- Drum machine sequencer (when opened) has gold-colored active steps -- looks great
- **Issue:** "Add Track" dropdown menu items use emoji icons instead of consistent SVG icons
- **Issue:** On mobile, the Studio page overflows horizontally (the timeline doesn't adapt)

### Learning Center - Lessons
**Score: 6.5/10**
- Header with "LEARNING CENTER" title, subtitle, LV.1 badge, 50 XP, and segmented progress bar is well-designed
- Three-tab strip (Lessons/Exercises/Tools) with gold active state is clear
- Category sub-filters (Fundamentals, Rhythm, Scales, etc.) work well
- Lesson list items show title, subtitle, and "+50 XP" badge on first available lesson
- LED dot indicators next to each lesson (off = not started)
- **Issue:** Header takes ~200px of vertical space on every sub-tab view (flagged last audit, not fixed)
- **Issue:** No visual distinction between completed/locked/available lessons -- all look the same
- **Issue:** "Best streak: 0" text is small and uses monospace font, feels out of place

### Learning Center - Exercises
**Score: 6/10**
- 17 exercise type buttons (Intervals, Chords, Scales, etc.) + 3 sub-tabs (Exercise, Achievements, Reference) create good navigation
- Large play button with "PRESS PLAY TO BEGIN" is clear
- Score display "0/0" with Settings and Reset buttons
- **Issue:** Too many navigation layers: main tabs (Lessons/Exercises/Tools) > exercise types (17 buttons wrapping to 2 lines) > sub-tabs (Exercise/Achievements/Reference) -- cognitive overload
- **Issue:** "Press play to begin" gives no context about what exercise will happen
- **Issue:** 17 exercise type buttons wrapping to 2 lines is visually messy

### Learning Center - Tools
**Score: 7.5/10**
- 9 tool buttons (Scales, Chords, Fretboard, etc.) are well-organized
- Root note selector with 12 note buttons in a clean grid
- Scale type selector with 10 options and gold active border
- Scale info card with name, description, notes, play button -- excellent
- Interval display with colored dots (gold for root, gray for others) and interval labels
- Full fretboard diagram with 16 frets, 6 strings, and color-coded note dots is impressive
- Fret numbers on top, string names on left, dot markers on frets 3/5/7/9/12/15
- **Issue:** Root note dots on the fretboard use gold for root but the same gold for all other notes too -- hard to distinguish root from non-root at a glance
- **Issue:** "Show intervals" checkbox is small and easy to miss

### Coach
**Score: 6/10**
- "AI PRACTICE COACH" header with subtitle is clean
- 2x2 grid layout for 4 practice plans is good use of space
- Each plan card shows: name (Oswald), duration/phases, phase tags, "START THIS PLAN" button
- "RECOMMENDED" badge on Beginner Rock Foundation is visible
- **Issue:** All 4 plans look identical -- same card layout, same gold buttons, no visual personality per plan (flagged last audit, not fixed)
- **Issue:** "Set up your profile first" banner takes too much vertical space for a suggestion
- **Issue:** No preview of what exercises are inside each plan

### Report
**Score: 6.5/10**
- "WEEK 1" heading with mode/key/style subtitle is informative
- Segmented VU-meter progress bar at top (100%) is consistent with Dashboard
- Stat cards (5 Minutes Done, 1 Days Active, 100% Completion) use Oswald font
- Daily Practice bar chart renders with proper axis labels
- Category pie chart (By Category) with warm-up slice in orange/amber
- Category Breakdown with mini progress bar per category
- Songs section with stage checklist (6 stages per song)
- **Issue:** Charts are small -- the daily practice chart has very small axis labels
- **Issue:** The "By Category" pie chart and label section are half-width, leaving empty space on the right
- **Issue:** No comparison to previous weeks, no trend indicators

### Profile
**Score: 6.5/10**
- Clean section organization: Personal, Preferred Genres, Goals & Inspiration
- Gold LED bullets on section headers (PERSONAL, PREFERRED GENRES, GOALS & INSPIRATION)
- 2-column layout for form fields on desktop
- Genre toggle chips with gold active state for Metal/Hard Rock
- "SAVE PROFILE" button uses gold style
- **Issue:** "PRACTICE GOALS" label is cut off as "ACTICE GOALS" due to a rendering overlap with something (visible in screenshot)
- **Issue:** No save confirmation feedback -- clicking Save Profile gives no visual response
- **Issue:** Form fields use standard recessed input styling which is consistent, but feels generic compared to the rest of the app

### Exercise Modal
**Score: 7.5/10**
- Clean overlay with proper backdrop
- Header with category tag (WARM-UP), BPM range, duration, "DONE" button
- Three tabs (Practice, Tutorial, Log) with gold active state
- Practice tab shows exercise description, iron rule callout in warning style
- Guitar Pro tab section with alphaTab rendering, speed controls, loop, metronome
- Tutorial tab with embedded YouTube video and custom URL input
- **Issue:** The modal appears to intercept navigation clicks (clicking Profile while modal context is active opens the modal instead of navigating)
- **Issue:** The "DONE" button with checkmark should be more prominent -- it's the primary action

---

## Typography Audit

### Where Oswald Is Used Correctly
- Navbar buttons -- uppercase with letter-spacing (`.nav-btn`)
- Panel headers ("CHANNEL SETTINGS", "SETLIST", "SCHEDULE") -- `.panel-header`
- Section titles ("SONG LIBRARY", "AI PRACTICE COACH", "LEARNING CENTER")
- Button text (`.btn-gold`, `.btn-ghost`, `.btn-danger`)
- Category filter pills and tags
- Stat numbers on Dashboard (`.font-stat`)
- Day names in Practice/Schedule (SUNDAY, MONDAY...)

### Where Oswald Is Still Missing
- **Song titles** in Song Library cards ("Master of Puppets", "Enter Sandman") use body font. These should use Oswald 600 for impact.
  - **File:** `src/components/GuitarForgeApp.tsx` (song card rendering)
- **Exercise names** in Library list items -- currently using body font, should be Oswald
  - **File:** `src/components/GuitarForgeApp.tsx` (library exercise list)
- **Report chart labels** (Sunday, Monday, etc. on the bar chart) use default recharts font -- should match the app's typography
  - **File:** `src/components/WeeklyCharts.tsx`

### Font Size Consistency
The design system defines clear sizes but some pages break the hierarchy:
- Library category pills are 11px but there are 22 of them, creating visual noise
- Exercise card metadata text uses monospace (`font-readout`) at 13px -- appropriate
- "Best streak: 0" in Learning Center uses monospace at ~13px -- feels disconnected from the heading nearby

---

## Color Audit

### Gold System Status: Working Well
- `--gold: #D4A843` is consistently used for active states, headings, buttons
- `.btn-gold` 4-stop gradient remains premium and tactile
- LED indicators (`.led-on`, `.led-gold`) render with proper glow
- Progress bars use segmented gold VU-meter style

### Color Issues Found
1. **Category tag colors vs warm palette** -- Tags like WARM-UP (green), SHRED (red), LEGATO (blue) use system colors from COL that sometimes clash with the warm gold theme. Consider warming these colors slightly.
   - **File:** `src/lib/constants.ts` (COL object)

2. **Background layer separation is still subtle** -- `--bg-panel: #0f0e0d` vs `--bg-primary: #0A0A0A` is nearly imperceptible. Panels don't clearly separate from the page background on most monitors.
   - **File:** `src/app/globals.css:9` vs `globals.css:8`

3. **Difficulty badge colors** in Songs page (green=Beginner, yellow=Intermediate, red=Advanced) are standard traffic-light colors. These could use the gold system instead: Beginner=#8A7020, Intermediate=#D4A843, Advanced=#C41E3A.
   - **File:** `src/components/GuitarForgeApp.tsx` (song difficulty badge rendering)

---

## Spacing & Layout Audit

### Consistent Spacing
- Panel padding is consistent at 16px (`.panel-header: padding 10px 16px`)
- Button padding is consistent (`.btn-gold: 8px 20px`, `.btn-ghost: 8px 20px`)
- Mobile buttons properly increase to `10px 14px` with 44px min-height

### Spacing Issues
1. **Dashboard sections** have inconsistent vertical gaps between panels (some 16px, some 24px)
2. **Library exercise list** items have no visible separator or gap between them -- they run together
3. **Practice page** has no bottom padding, content sits right against the viewport bottom
4. **Learning Center header** has excessive top padding creating 200px+ of header before content

---

## Top 10 Fixes Ranked by Visual Impact

| Rank | Fix | Impact | Effort | File(s) |
|------|-----|--------|--------|---------|
| **1** | **Fix navigation state race condition** -- View jumps to wrong page on click | Critical UX | Medium | `GuitarForgeApp.tsx:56-80` |
| **2** | **Reorganize Dashboard** -- Move Channel Settings behind collapsible/gear icon, lead with today's practice summary | High visual | Medium | `GuitarForgeApp.tsx` (dash view) |
| **3** | **Replace native `<select>` exercise picker** with searchable typeahead/command palette | High UX | Medium | `GuitarForgeApp.tsx` (practice view) |
| **4** | **Add Library pagination or category grouping** -- Collapse categories by default, 20 items per page | High visual | Low-Med | `GuitarForgeApp.tsx` (lib view) |
| **5** | **Fill Practice page empty space** -- Add "Suggested Exercises" section or session timer below the exercise list | High visual | Low | `GuitarForgeApp.tsx` (practice view) |
| **6** | **Compact Learning Center header** -- Reduce to single 60px row with inline level/XP info | Medium visual | Low | `LearningCenterPage.tsx` |
| **7** | **Add Song card progress indicators** -- Show 0/6 stages on each song card with mini progress bar | Medium visual | Low | `GuitarForgeApp.tsx` (songs view) |
| **8** | **Differentiate Coach plan cards** -- Add unique accent color or icon per plan | Medium visual | Low | `AiCoachPage.tsx` |
| **9** | **Add page transition animation** -- 150ms fade+slide on view switch using `.animate-fade-in` | Medium polish | Low | `GuitarForgeApp.tsx` (view rendering) |
| **10** | **Use Oswald for song/exercise titles** -- Apply `.font-heading` to exercise names in Library and song names in Songs | Medium polish | Low | `GuitarForgeApp.tsx` |

---

## Before/After Descriptions for Each Fix

### Fix 1: Navigation State Race Condition
- **Before:** User clicks "Report" button, app shows Practice page. User clicks "Studio", app shows Dashboard. Navigation is unreliable and confusing.
- **After:** Every nav click immediately and reliably shows the correct page. View state uses URL hash (`#studio`, `#report`) so browser back/forward also works. No localStorage race conditions.

### Fix 2: Dashboard Reorganization
- **Before:** First thing visible is "CHANNEL SETTINGS" with Week/Mode/Key/Style dropdowns. User must scroll past configuration to see their practice status.
- **After:** Dashboard leads with a hero card: "Today: Sunday -- 1 exercise, 5 min" with a prominent "Start Practice" button. Weekly progress bar is immediately visible. Channel Settings is behind a collapsible gear section at the bottom.

### Fix 3: Exercise Picker
- **Before:** Native browser `<select>` dropdown with 120+ exercise names in a flat list. User must scroll through the entire list to find an exercise. No search, no categories.
- **After:** Clicking "+ Exercise" opens a floating search palette. User types "sweep" and sees 5 matching exercises filtered instantly. Exercises are grouped by category with colored headers.

### Fix 4: Library Pagination
- **Before:** All 120 exercises render in one scrollable list. Page is extremely long. User must scroll through everything to find an exercise in the "Harmonics" category.
- **After:** Exercises are grouped by category (Warm-Up, Shred, Legato...). Each category is collapsed by default showing only the header with count. Clicking expands to show exercises. A "Show All" toggle returns to the flat list.

### Fix 5: Practice Empty Space
- **Before:** Single exercise card followed by 500+ pixels of empty dark space. Page feels broken.
- **After:** Below the exercise list, a "Suggestions" section shows 3 recommended exercises based on the user's profile/style. A mini progress card shows "This week: 1/7 days practiced". Empty days show "Rest day" with a calming illustration.

### Fix 6: Learning Center Header
- **Before:** Header occupies ~200px with title, subtitle, XP bar, level badge, streak counter all stacked vertically.
- **After:** Single 60px row: `LEARNING CENTER | LV.1 50XP [======>] | Best streak: 0`. The tab strip (Lessons/Exercises/Tools) sits immediately below.

### Fix 7: Song Card Progress
- **Before:** Song cards show name, difficulty badge, artist, genre/key/BPM. No indication of learning progress.
- **After:** Each song card includes a mini 6-segment progress bar showing stages completed (e.g., 2/6 with stages 1-2 lit green). Last practiced date shown in muted text.

### Fix 8: Coach Plan Differentiation
- **Before:** All 4 plan cards look identical -- same panel background, same gold button, same layout.
- **After:** Each plan has a subtle accent: Beginner=green accent stripe, Shred=red, Blues=blue, Metal=purple. A difficulty meter (1-5 bars) is visible. The "RECOMMENDED" badge glows with animated gold pulse.

### Fix 9: Page Transitions
- **Before:** Switching views is instant with no animation -- content pops in abruptly.
- **After:** View content fades in with a 200ms ease-out animation (using existing `.animate-fade-in` class from globals.css line 839). Feels smoother and more intentional.

### Fix 10: Oswald for Titles
- **Before:** Exercise names ("Chromatic 1-2-3-4 Hand Sync") and song names ("Master of Puppets") use Source Sans 3 body font -- they blend into descriptions.
- **After:** Exercise and song titles use Oswald 600 uppercase, creating clear visual hierarchy between the title and the metadata below it.

---

## Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| Visual Identity | 8/10 | Gold system, grain texture, amp aesthetic are genuinely distinctive |
| Typography | 6.5/10 | Oswald/Source Sans/JetBrains Mono stack is good but inconsistently applied |
| Color | 7/10 | Gold system works, but category colors clash and background layers are too close |
| Spacing | 6/10 | Button/panel padding is consistent, but vertical rhythm between sections varies |
| Layout | 5.5/10 | Practice empty space, Library/Songs flat lists, Dashboard wrong priority |
| Components | 7.5/10 | Buttons, inputs, LEDs, VU bars are well-crafted. Native `<select>` is the weak link |
| Responsiveness | 4/10 | Mobile bottom bar exists but breakpoint fails after HMR. Studio overflows on mobile |
| Navigation | 3/10 | Critical state management bug makes navigation unreliable |
| Motion | 5/10 | Button press/hover animations exist, but no page transitions or completion feedback |
| Polish | 6/10 | Design system promises premium, but execution has gaps |

**Overall: 7.0 / 10** (up from 6.5)

The biggest improvement opportunity is fixing the navigation state bug (Fix #1) -- it undermines trust in the entire app. After that, reorganizing Dashboard and adding Library grouping would have the highest visual impact for the lowest effort.

---

*Report generated by the UI/UX Design Agent. Do NOT implement fixes yet -- review recommendations first.*
