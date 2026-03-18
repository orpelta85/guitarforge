# Design Audit Report -- GuitarForge

**Date:** 2026-03-18
**Auditor:** UI/UX Design Agent (ui-ux-design + frontend-design skills)
**Resolution tested:** 1280x800 desktop + mobile (responsive breakpoints observed)
**Pages audited:** Dashboard, Practice, Library, Songs, Studio, Learning (Lessons/Exercises/Tools), Coach, Report, Profile

---

## Overall Score: 6.5 / 10

The app has a **strong conceptual identity** ("Vintage Amp x Modern DAW") that is genuinely distinctive and avoids generic AI-slop aesthetics. The gold/dark color system, grain texture, panel styling, and amp-inspired typography create real character. However, execution inconsistencies, layout issues, and missing polish hold it back from feeling production-grade.

---

## What's Working Well

1. **Distinctive identity** -- The Marshall amp / guitar pedal aesthetic is genuinely memorable. The grain texture, gold accent system, panel shadows, and segment displays create a cohesive world that no other practice app has.

2. **CSS design system is strong** -- `globals.css` has well-crafted variables, panel classes (`.panel`, `.panel-header`, `.faceplate`), button styles (`.btn-gold`, `.btn-ghost`), and typography classes (`.font-heading`, `.font-label`, `.font-readout`). This is a real foundation.

3. **Gold accent consistency** -- The warm gold (#D4A843) is used consistently as the primary accent. The gradient system on `.btn-gold` (4-stop gradient with beveled shadow) is premium and tactile.

4. **Studio page** -- The DAW interface has legitimate character. Transport controls, timeline with beat markers, track panel, and the empty state ("Drop a loop or audio file") all feel purposeful. The status bar at the bottom is a nice DAW convention.

5. **Noise grain overlay** -- The SVG fractalNoise texture at 2.2% opacity adds subtle depth without being distracting. This is a strong design detail.

6. **Font stack is thoughtful** -- Oswald for headings/labels, Source Sans 3 for body, JetBrains Mono for readouts. Three fonts, each with a clear role.

7. **Category color system** -- Using COL constants for exercise categories gives visual variety without chaos.

---

## Critical Issues (Fix Now)

### 1. [Navbar] Navigation Overflows on Narrow Viewports
- **Impact:** 9 nav items in a horizontal strip don't fit on screens < ~1100px. Items get cut off ("STUDI..." visible in several screenshots). The overflow-x-auto with hidden scrollbar means users may not realize they can scroll.
- **Fix:** At `< md`, switch to a bottom tab bar with 5 primary items + "More" menu. Or use a hamburger menu. At `md-lg`, consider grouping (e.g., Learning/Coach/Report under "Learn" dropdown).

### 2. [All Pages] Viewport/Responsive Breakpoint is Fragile
- **Impact:** During testing, pages frequently rendered in mobile layout even at 1280px wide when HMR triggered re-renders. This suggests responsive state may be tied to initial render or that breakpoint logic has race conditions.
- **Fix:** Audit all responsive breakpoints. Ensure they use CSS media queries (Tailwind classes) rather than JavaScript-based viewport detection that could be stale.

### 3. [Library] No Virtualization for 120+ Exercise List
- **Impact:** The Library page renders ALL 120 exercises as DOM nodes simultaneously. Full-page screenshot shows an extremely long scrollable list with no pagination or virtual scrolling. This will feel sluggish and is overwhelming to browse.
- **Fix:** Either (a) virtualize with `react-window` or `@tanstack/virtual`, or (b) paginate with 20 items per page, or (c) collapse categories by default so users expand what they need.

### 4. [Practice] Massive Empty Space When Few Exercises
- **Impact:** With only 1 exercise assigned to Sunday, the Practice page has ~60% empty space below the exercise card. Feels broken/incomplete.
- **Fix:** Fill the space with contextual content: suggested exercises, motivational stats, a mini-fretboard, or tips.

### 5. [Exercise Modal] Cannot Audit -- Navigation Instability
- **Impact:** The exercise modal could not be reliably opened during automated testing due to HMR-triggered state resets. This also affects real users if any re-render causes the app to navigate away from their current view.
- **Fix:** Persist view state more robustly. Consider using URL hash or Next.js routing so page state survives re-renders.

---

## High Impact Improvements (Next Sprint)

### 1. [Dashboard] Too Dense, Unclear Hierarchy
- **What:** Dashboard shows Channel Settings, Setlist, Week Progress, and Schedule all stacked vertically. Everything has equal visual weight.
- **Why:** Users need to see at-a-glance: "What should I practice today?" and "How am I doing?" -- not a settings panel.
- **How:** Reorganize into two columns on desktop. Left: Today's Practice (prominent) + Weekly Progress. Right: Channel Settings (collapsible) + Setlist. Move Schedule into a compact calendar widget. Add a hero stat: "5 minutes today / 2h goal".

### 2. [Dashboard] Channel Settings Should Not Be the First Thing Visible
- **What:** The very first section is "Channel Settings" (Week/Mode/Key/Style dropdowns). This is configuration, not the primary use case.
- **Why:** Users open the app to practice, not to change their mode. Settings should be accessible but secondary.
- **How:** Move Channel Settings behind a gear icon or collapsible section. Lead with today's practice summary.

### 3. [Learning] Header Takes Too Much Vertical Space
- **What:** The Learning Center header (title, subtitle, XP bar, level badge, streak) occupies ~200px of vertical space on every sub-tab.
- **Why:** Once you've seen your level/XP, you want to interact with content. The header should shrink after first view.
- **How:** Compact the header to a single 60px row: "Learning Center | LV.1 50XP [===>] | Lessons / Exercises / Tools". Use the full header only on first visit or when explicitly expanded.

### 4. [Learning > Exercises] "Press Play to Begin" Empty State is Vague
- **What:** The Exercises tab shows a large play button and "Press play to begin" with no context about what will happen.
- **Why:** Users don't know what exercise type they're about to do, what the rules are, or what to expect.
- **How:** Add a brief description: "Interval Recognition -- Listen and identify the interval. You'll hear two notes." Show the exercise type name prominently. Add difficulty indicator.

### 5. [Songs] Song Cards Are Too Sparse
- **What:** Each song takes up a large card but shows minimal info: name, difficulty badge, artist, genre/key/BPM on one line.
- **Why:** There's room for more useful data: progress stages completed, last practiced date, album art placeholder.
- **How:** Add a progress indicator (0/6 stages) directly on the card. Consider a compact list view option for users with many songs.

### 6. [Coach] Plans All Look Identical
- **What:** 4 practice plans are listed with identical card layouts. No visual differentiation between Beginner Rock Foundation, Shred Speed Builder, Blues Guitar Mastery, and Metal Technique Complete.
- **Why:** Each plan has a very different personality. They should feel different.
- **How:** Give each plan a subtle accent color or icon. Add a difficulty meter. Show what exercises are included (preview). Add estimated time commitment per week.

### 7. [Report] Charts Are Small and Hard to Read
- **What:** The daily practice bar chart and category pie chart are rendered small, especially on mobile where they're barely readable.
- **Why:** This is the page where users want to understand their progress. Charts should be the hero.
- **How:** Make charts full-width. Add interactive tooltips. Show trends (this week vs last). Add a "personal best" highlight.

### 8. [Profile] Form Feels Like an Afterthought
- **What:** Profile is a standard form with no visual flair. Generic input fields, dropdown selects, basic layout.
- **Why:** This is where users define their identity. It should feel personal and engaging.
- **How:** Add a profile "card" at the top showing current settings as a summary. Use toggle chips instead of a multi-select for genres. Add visual icons next to instrument selection.

---

## Creative Ideas (Make It Unforgettable)

### 1. Amp Power-On Animation
- **Where:** App load / splash screen
- **Impact:** HIGH -- first impression
- **Description:** When the app first loads, show the GuitarForge logo with a brief "amp warming up" animation: LED blinks from off to green, a subtle hum sound (optional), and the UI "powers on" with a brief golden glow. 1.5 seconds max. This sets the tone immediately.

### 2. Tube Glow on Active State
- **Where:** Active nav item, completed exercises
- **Impact:** MEDIUM -- ambient delight
- **Description:** When a nav item is active or an exercise is completed, add a subtle warm amber glow animation (like a vacuum tube warming up). CSS only:
```css
.active-glow {
  box-shadow: 0 0 12px rgba(212,168,67,0.3), inset 0 0 8px rgba(212,168,67,0.1);
  animation: tube-warm 2s ease-in-out infinite alternate;
}
@keyframes tube-warm {
  from { box-shadow: 0 0 8px rgba(212,168,67,0.2); }
  to { box-shadow: 0 0 16px rgba(212,168,67,0.35); }
}
```

### 3. VU Meter for Practice Intensity
- **Where:** Dashboard or Practice page sidebar
- **Impact:** MEDIUM -- gamification
- **Description:** A vintage VU meter (analog needle gauge) that shows today's practice intensity based on exercises completed vs. target. The needle animates smoothly. When you hit 100%, the needle enters the "red zone" with a satisfying visual.

### 4. Exercise Card "Stomp" Animation
- **Where:** Practice page, when marking exercise done
- **Impact:** HIGH -- satisfying feedback
- **Description:** When a user clicks "Done" on an exercise, animate it like stomping a guitar pedal: the card presses down briefly (translateY + scale), the LED turns green, and there's a subtle click sound. This makes the completion feel physical and rewarding.

### 5. Fretboard Heatmap on Profile
- **Where:** Profile page or Dashboard
- **Impact:** MEDIUM -- data visualization
- **Description:** Show a guitar fretboard where positions light up based on which exercises/scales/modes the user has practiced. Over time, the fretboard fills with warm colors. This visualizes progress in a guitar-native way.

---

## Typography Audit

### Where Oswald Is Used Correctly
- `.font-heading` (headings, section titles) -- Good
- `.font-label` (section headers like "CHANNEL SETTINGS", "SETLIST") -- Good
- `.btn-gold` and `.btn-ghost` button text -- Good
- Navbar buttons -- Good, uppercase with letter-spacing

### Where Oswald Should Be Used But Isn't
- **Song titles** in Song Library -- Currently using body font. Song names like "Master of Puppets" would look more impactful in Oswald 600.
- **Exercise names** in Library list -- The exercise title should be Oswald, not Source Sans.
- **Stats numbers** in Report (5 Minutes, 1 Days Active, 100% Completion) -- These large numbers should use Oswald 700 for more impact. Currently they're body font.
- **Day names** in Practice view (SUNDAY, MONDAY...) -- Already uppercase but should explicitly use Oswald for consistency with the amp-panel aesthetic.

### Font Size Scale Recommendations
Current state is inconsistent. Recommended scale:
```
10px -- micro labels (status bar items)
11px -- nav items on mobile (current, OK)
12px -- panel headers, small labels
13px -- nav items desktop, button text, .font-label (current, OK)
14px -- exercise descriptions, secondary text
15px -- body text (current base, OK)
18px -- card titles (exercise names, song names)
22px -- section headings ("LEARNING CENTER", "SONG LIBRARY")
28px -- page hero numbers (stats like "100%", "5 min")
36px -- splash/hero text
```

---

## Color Audit

### Is the Gold System Working?
**Yes, strongly.** The gold system is the app's most distinctive visual element:
- `--gold: #D4A843` -- Primary accent (buttons, active states, headings)
- `--gold-bright: #EDCF72` -- Hover states
- `--gold-dim: #8A7020` -- Shadows, pressed states
- `--gold-dark: #B8922E` -- Border accents

The 4-stop gradient on `.btn-gold` is particularly well-crafted.

### Contrast Layers
The background depth system is well-defined but **could use more visible separation**:
- `#050505` (void) -> `#0A0A0A` (primary) -> `#0F0E0D` (panel) -> `#141414` (secondary) -> `#161514` (surface) -> `#1E1B18` (tertiary)

**Issue:** The difference between some of these layers (0A vs 0F vs 14) is almost imperceptible on most monitors. Consider:
- Increasing the gap between panel and page background (make panels `#181818` or `#1A1A1A`)
- Using more visible borders to delineate sections
- Adding subtle gold accent lines between sections (you already have `navbar-accent-line` -- extend this pattern)

### Color Inconsistencies Found
1. **Category pill colors** use system colors (green, blue, red, etc.) from COL which sometimes clash with the warm gold aesthetic. Consider tinting all category colors slightly warm.
2. **"REMOVE" button** on Dashboard setlist uses bright red text (`#ef4444`) which feels jarring against the warm palette. Use `--crimson: #C41E3A` instead for consistency.
3. **Progress bar green** (#22c55e) is a cool green that doesn't match the warm palette. Consider a warmer green like `#4CAF50` or `#6B8E23` (olive).
4. **Difficulty badges** (Beginner=green, Intermediate=yellow, Advanced=red) use standard traffic-light colors that feel generic. Consider using the gold system: Beginner=#8A7020, Intermediate=#D4A843, Advanced=#C41E3A.

---

## Motion Audit

### What Animations Exist
1. **Button press** -- `.btn-gold:active` has `translateY(2px) scale(0.98)` with 80ms transition. Excellent tactile feel.
2. **Button hover** -- `.btn-gold:hover` changes gradient + box-shadow. Clean.
3. **Nav transitions** -- Generic `transition: all 0.12s ease` on nav buttons.
4. **LED glow** -- The green LED in the navbar has a static glow. No animation.
5. **No page transitions** -- Switching views is instant with no cross-fade or slide.

### What's Missing
1. **Page transitions** -- Views switch instantly. Adding a 150ms fade would feel smoother.
2. **Exercise completion** -- No animation when marking done. This is the most important micro-interaction in the app.
3. **Progress bar fill** -- The XP progress bar and weekly progress bar have no fill animation. They should animate on load.
4. **List stagger** -- Exercise list in Library appears all at once. A staggered reveal (50ms delay per item) would feel polished.
5. **Modal open/close** -- Exercise modal presumably uses a hard show/hide. Should have a scale+fade entrance.
6. **Metronome pulse** -- The LED or BPM display could pulse to the beat when the metronome is active.

### Recommended High-Impact Micro-Interactions
```css
/* Progress bar fill animation */
.progress-fill {
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Exercise completion -- LED turn on */
@keyframes led-on {
  0% { box-shadow: none; background: var(--led-off); }
  50% { box-shadow: 0 0 12px var(--led-green); }
  100% { box-shadow: 0 0 6px var(--led-green); background: var(--led-green); }
}

/* Page view transition */
.view-enter {
  animation: fadeSlideIn 0.2s ease-out;
}
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Staggered list reveal */
.list-item {
  animation: fadeIn 0.3s ease-out both;
}
.list-item:nth-child(1) { animation-delay: 0ms; }
.list-item:nth-child(2) { animation-delay: 30ms; }
.list-item:nth-child(3) { animation-delay: 60ms; }
/* etc. */
```

---

## Component-by-Component Analysis

### Navbar
- **Strengths:** Distinctive look with amp-panel styling, gold accent line, LED indicator, Oswald font.
- **Issues:** Too many items (9) for horizontal layout. No active state "glow" effect -- just an underline. No mobile adaptation (should become bottom tab bar).
- **Suggestions:**
  - Reduce to 5-6 primary nav items + "More" overflow
  - Add warm glow to active item (not just underline)
  - Consider grouping: Learning + Coach + Report = "Learn" dropdown
  - Add subtle active state pulse/glow animation

### Dashboard
- **Strengths:** Functional, shows all key info. Channel Settings dropdowns work well.
- **Issues:** No visual hierarchy. Settings first = wrong priority. Stats section (Done/Total/Minutes/Days) uses equal-weight layout that doesn't highlight the important number.
- **Suggestions:**
  - Hero section: "Today: Practice Sweep Arpeggios (12min)" with a big Start button
  - Collapse Channel Settings by default
  - Make the progress stat numbers use `.font-heading` at 28px
  - Add a "streak" visual (fire icon or consecutive day counter)

### Practice
- **Strengths:** Day tabs are clear. Exercise cards show category + name + metadata.
- **Issues:** Very sparse with 1 exercise. No visual "flow" or session feel. The combobox for adding exercises is a native `<select>` with 100+ options -- nearly unusable.
- **Suggestions:**
  - Replace native `<select>` with a searchable command palette / typeahead
  - Add exercise card hover effect (slight lift + gold border glow)
  - Show a "Session timer" at the top that accumulates as you complete exercises
  - Add "Start Session" flow that walks through exercises sequentially

### Library
- **Strengths:** Good category filtering with counts. Search bar present. "+" button to add exercises to schedule.
- **Issues:** Extremely long flat list (120 items). Category pills wrap across two lines in some views. No exercise card preview on hover.
- **Suggestions:**
  - Group by category with collapsible sections (default collapsed)
  - Add grid view option (2-3 columns with cards)
  - Show exercise difficulty/duration more prominently
  - Add "Recently Practiced" and "Recommended" sections at top

### Songs Page
- **Strengths:** Clean layout. Difficulty badges are clear. Search + filter work well.
- **Issues:** Cards are large but information-sparse. No progress visualization. No album art or visual identity per song.
- **Suggestions:**
  - Add a progress bar (0/6 stages) on each song card
  - Show last practiced date
  - Add a mini stage checklist visible on the card
  - Consider card layout with album art placeholder (genre-based default images)

### Studio (DAW)
- **Strengths:** Most impressive page visually. Transport controls feel authentic. Timeline with beat markers works. Master track panel at bottom.
- **Issues:** Empty state could be more inviting. "0 tracks" label is small and easy to miss.
- **Suggestions:**
  - Make the empty state more engaging: show a demo project or "Quick Start" options (Record, Import, Drum Machine)
  - Add track type icons in the Add Track menu
  - The master volume slider could use a VU meter visualization

### Learning Center
- **Strengths:** Three clear tabs (Lessons/Exercises/Tools). Good category filtering. XP/Level gamification is motivating.
- **Issues:** Header is too tall. Lessons list items are plain with no visual differentiation between completed/locked/available. The "+50 XP" badge only appears on one lesson.
- **Suggestions:**
  - Add completion checkmarks and lock icons to lesson list
  - Show estimated time per lesson
  - Add a "Continue where you left off" section
  - Make the fretboard diagram (in Tools > Scales) use the gold color for root notes and a warmer palette for intervals

### Learning > Tools > Scales
- **Strengths:** Fretboard diagram is functional and well-implemented. Scale info card with play button is nice. Interval labels are clear.
- **Issues:** Root note selector buttons are small and tightly packed. Scale type buttons wrap across two lines. Fretboard is small and hard to read at some viewport sizes.
- **Suggestions:**
  - Make fretboard full-width and taller
  - Use gold (#D4A843) for root notes and amber variants for other scale degrees
  - Add position/box filtering (show only position 1, 2, etc.)

### Learning > Tools > Chords
- **Strengths:** Chord diagrams are well-rendered SVGs. Multiple voicings shown. Click-to-hear is good UX.
- **Issues:** On narrow viewports, the layout is cramped. Chord type selector has too many options in a flat list (14 types).
- **Suggestions:**
  - Group chord types: Basic (Major/Minor/7/Maj7/m7) | Extended (9/Add9/6) | Altered (Dim/Aug/m7b5/Dim7) | Suspended (Sus2/Sus4)
  - Make diagrams slightly larger
  - Add a "Common Progressions using this chord" section

### Coach
- **Strengths:** Plans have clear structure (weeks, phases, phase names). "Recommended" badge is helpful.
- **Issues:** All plans look identical. No preview of what's inside. No visual personality per plan. The "Set up your profile first" banner is too prominent when it should be a subtle nudge.
- **Suggestions:**
  - Add a unique accent color per plan (Beginner=green, Shred=red, Blues=blue, Metal=purple)
  - Show a sample week preview on hover/expand
  - Make the profile suggestion a dismissible toast, not a permanent banner
  - Add difficulty/intensity meter

### Report
- **Strengths:** Shows key stats (minutes, days, completion). Bar chart and pie chart provide visual data. Song progress with stage tracking is thorough.
- **Issues:** Dense layout on mobile. Chart labels are small. No comparison to previous weeks. No motivational framing ("Great week!" or "You're behind").
- **Suggestions:**
  - Add week-over-week comparison arrows (up/down indicators)
  - Full-width charts with larger labels
  - Add a "Weekly Summary" text block: "You practiced 5 minutes across 1 day this week. Your focus was Warm-Up exercises."
  - Color-code completed days green in the daily log

### Profile
- **Strengths:** Covers all necessary fields. Genre selection with toggle buttons is good.
- **Issues:** Generic form layout. No visual personality. "Save Profile" button at the bottom with no confirmation.
- **Suggestions:**
  - Add a profile summary card at the top showing current saved state
  - Add a "guitarist avatar" or icon selector
  - Show a save confirmation toast
  - Group into collapsible sections: Identity / Preferences / Goals

---

## Logo Redesign Notes

The new logo has been saved to:
- `logo/logo-dark.svg`
- `public/logo-dark.svg`

Changes from the original:
- Font changed from system-ui to Oswald (matches the app's heading font)
- "GUITAR" now uses warm gold (#D4A843) instead of zinc gray
- Added amp-inspired hardware details: corner rivets, inner bevel line, decorative gold accent lines
- Spark at pick tip uses a gradient (gold -> bright -> white) with tiny spark particles for forge feel
- Badge border uses a 3-stop gold gradient for depth (E8C96A -> D4A843 -> 9A7730)
- Overall silhouette unchanged (pick negative space in rounded square badge + stacked wordmark)
- Works at small sizes: the pick cutout and spark are simple enough for 24px icon use

---

## Priority Action Items (Ranked)

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Fix nav overflow / add mobile bottom bar | Medium | High |
| P0 | Replace native `<select>` for exercise picker with searchable component | Medium | High |
| P1 | Reorganize Dashboard hierarchy (practice-first, settings-secondary) | Medium | High |
| P1 | Add Library virtualization or category grouping | Medium | High |
| P1 | Add exercise completion animation | Low | Medium |
| P1 | Compact Learning Center header | Low | Medium |
| P2 | Add page view transitions (fade) | Low | Medium |
| P2 | Progress bar fill animations | Low | Medium |
| P2 | Song card progress indicators | Low | Medium |
| P2 | Coach plan visual differentiation | Low | Medium |
| P3 | Amp power-on animation | Medium | Medium |
| P3 | VU meter widget | High | Low |
| P3 | Fretboard heatmap | High | Low |

---

*Report generated by the UI/UX Design Agent. Do NOT implement fixes yet -- review recommendations first.*
