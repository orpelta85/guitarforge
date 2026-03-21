# Studio Simplification Plan

## Current State: 4,004 lines — Full DAW
## Target State: ~1,500-1,800 lines — Practice Recording Tool

---

## 1. WHAT TO REMOVE (with line ranges)

### A. Effects System (remove ~700 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 8-15 | `TrackEffects` interface (reverb, delay, distortion, EQ, chorus, compressor) | Not needed for practice tool |
| 187-194 | `DEFAULT_EFFECTS` constant | No effects system |
| 196-258 | `AMP_PRESETS` array (5 presets with all effect params) | No amp presets |
| 260-278 | `AmpSimPreset` interface + `AMP_SIM_PRESETS` array | No amp simulator |
| 640-642 | Amp simulator state (`ampPreset`, `ampKnobs`) | No amp sim |
| 797-812 | `applyEffects()` callback | No effects |
| 814-843 | `createToneNodes()` — effect chain (EQ, distortion, chorus, delay, reverb, channel) | Simplify to just player + volume |
| 1335-1351 | `updateTrackEffects()`, `applyPreset()` callbacks | No effects |
| 1502-1741 | `exportMix()`, `exportMp3()`, `audioBufferToWav()`, `audioBufferToMp3()` — full offline render with effects chain | Remove export |
| 1748-1826 | `saveToLibrary()` — offline render with effects chain | Simplify (direct save without effects processing) |
| 3184-3279 | Bottom panel "FX" tab — full effects UI with 6 EffectSections, Amp Simulator GUI with 6 knobs | Remove entirely |
| 3922-4004 | `EffectSection` + `FxKnob` sub-components (82 lines) | No effects UI |

### B. Pan / Solo Controls (remove ~150 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 30 | `pan` field in StudioTrack | No pan |
| 31 | `solo` field in StudioTrack | No solo |
| 786-794 | `applySoloMute()` callback | No solo logic |
| 1280-1284 | `updateTrackPan()` callback | No pan |
| 1294-1300 | `toggleSolo()` callback | No solo |
| 2619-2624 | Solo "S" button per track in sidebar | No solo button |
| 2625-2630 | "Fx" button per track in sidebar | No effects button |
| 2650-2659 | Pan indicator in sidebar track row | No pan display |
| 3088-3181 | Entire "Mixer" bottom tab (vertical faders + pan + solo + VU meters per channel + master channel) | Remove mixer tab |
| 3366-3397 | Editor tab pan/volume section for non-drum tracks | Simplify |

### C. VU Meters (remove ~60 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 629 | `vuLevels` state | No VU meters |
| 716 | `vuAnimRef` ref | No VU animation |
| 2031-2055 | VU meter animation effect (requestAnimationFrame loop) | Remove |
| 2639-2648 | Mini VU meter per track in sidebar | Remove |
| 2776-2791 | Stereo master VU meters in sidebar | Remove |
| 3106-3127 | VU meter bars in mixer tab (already removed with mixer) | Remove |

### D. Waveform Regions / Editing (remove ~200 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 42-50 | `TrackRegion` interface | No region editing |
| 528-565 | `computePeaks()`, `drawWaveform()` functions | No waveform canvas |
| 661-670 | Region drag state | No dragging |
| 683-684 | `regionCanvasRefs`, `audioBuffersRef` | No canvas refs |
| 1894-1916 | `createRegionFromBlob()` — decode audio, compute peaks, create region | Remove |
| 1918-1949 | `splitRegion()`, `deleteRegion()` | Remove |
| 1951-1996 | Region drag handlers (mousemove/mouseup for move/trim) | Remove |
| 1998-2020 | Draw waveforms on canvases effect | Remove |
| 2022-2028 | Context menu close handler | Remove |
| 2926-2993 | Canvas-based waveform region rendering in timeline | Remove |
| 3026-3050 | Region context menu (Delete Region, Split at Center) | Remove |

### E. Snap to Grid (remove ~30 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 632 | `snapToGrid` state | No snap |
| 185 | Snap keyboard shortcut hint | Remove |
| 2547-2550 | Snap toggle button in sidebar header | Remove |
| 2190 | Snap keyboard shortcut handler | Remove |
| 3914 | Snap indicator in status bar | Remove |

### F. YouTube Import (remove ~40 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 602 | `ytQuery` state | No YouTube |
| 603 | `ytVideoId` state | No YouTube |
| 1073-1077 | `addYoutubeTrack()` callback | Remove |
| 1371-1376 | `extractVid()`, `loadYt()` functions | Remove |
| 2521-2528 | YouTube option in Add Track menu | Remove |
| 3512-3531 | YouTube section in Library sidebar tab | Remove |

### G. Export WAV/MP3 (remove ~200 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 652-653 | `exporting`, `exportProgress` state | No export |
| 659 | `showExportMenu` state | No export menu |
| 1502-1741 | `exportMix()`, `exportMp3()`, WAV encoder, MP3 encoder | Remove entirely |
| 2422-2472 | Export dropdown button and menu in top bar | Remove (replace with simple Save) |

### H. Resizable Panels (remove ~40 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 625-626 | `sidebarWidth`, `bottomPanelHeight` state | Fixed layout |
| 714-715 | `sidebarDragRef`, `bottomDragRef` refs | No dragging |
| 2057-2075 | Resizable panel mouse handlers | Remove |
| 2801-2806 | Sidebar resize handle div | Remove |
| 3057-3062 | Bottom panel resize handle | Remove |

### I. Complex Recording Settings (remove ~80 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 17-22 | `TrackInputSettings` interface (channel mono-l/r/stereo, gain, monitoring) | Simplify |
| 635-636 | `monitoring` state | Remove |
| 648 | `inputLevel` state | Remove |
| 2086-2108 | Input level meter monitoring effect | Remove |
| 2661-2724 | Per-track input settings panel (device, channel, gain, monitor toggle, level meter) | Remove |
| 3399-3471 | "Input/Output" bottom tab (device selector, level meter, monitoring toggle, sample rate display) | Remove |

### J. Bottom Panel Tabs System (remove ~100 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 627 | `bottomTab` state | No bottom panel tabs |
| 3053-3474 | Entire bottom panel: resize handle, tab bar, mixer tab, fx tab, editor tab, I/O tab | Remove (drum editor moves inline) |
| 3883-3917 | Bottom status bar with panel toggles | Simplify |

### K. Timeline / Measure Ruler (remove ~60 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 280 | `TIME_SIGS` array | Not needed for practice |
| 595-596 | `timeSigIdx`, `showTimeSigPicker` state | Remove |
| 2134-2145 | `measures` computed data | Remove |
| 2810-2837 | Measure ruler with beat ticks and playhead | Remove |
| 2839-2848 | Zoom bar | Remove |
| 2263-2281 | Time signature picker in top bar | Remove |
| 2285-2309 | Project key picker in top bar | Remove |

### L. Miscellaneous DAW Features (remove ~50 lines)
| Lines | What | Why remove |
|-------|------|------------|
| 34 | `recordArm` field | Simplify recording |
| 35 | `collapsed` field | Remove track collapse |
| 174-175 | `MUSICAL_KEYS`, `MUSICAL_MODES` | Remove |
| 574-578 | `dbDisplay()` function | Remove |
| 630-631 | `projectName`, `editingProjectName` state | Simplify |
| 647 | `colorPickerTrackId` state | Remove color picker |
| 1302-1308 | `toggleRecordArm()`, `toggleCollapsed()` callbacks | Remove |
| 2110-2122 | `changeTrackColor()` callback | Remove |
| 2729-2742 | Color picker dropdown | Remove |
| 2601-2606 | Collapse toggle button | Remove |

---

## 2. WHAT TO KEEP

### A. Core Recording (keep + simplify)
- **Mic recording** (lines 1080-1171): Keep startRec/stopRec. Simplify to auto-create track on record stop.
- **Input device enumeration** (lines 2077-2084): Keep device selector, but move to a simple dropdown in the record area.
- **Recording timer** (lines 1166-1167): Keep the recording time display.
- **Live level meter during recording** (lines 1091-1114): Keep but simplify.

### B. Track List (keep + simplify)
- **Track state**: Keep `id`, `name`, `color`, `audioBlob`, `audioUrl`, `volume`, `muted`, `type`, `drumPattern`.
- **Add track** (lines 892-923): Keep.
- **Delete track** (lines 1310-1333): Keep, simplify (no effects disposal).
- **Track volume** (lines 1271-1278): Keep.
- **Track mute** (lines 1286-1292): Keep (without solo logic).
- **Track rename** (lines 1889-1892): Keep.

### C. Playback (keep + simplify)
- **Play all / stop all** (lines 1182-1255): Keep, simplify (no effects, no solo).
- **Rewind** (lines 1257-1268): Keep.
- **Metronome** (lines 739-775): Keep.
- **Loop** (lines 1207-1218): Keep.
- **Time display** (lines 567-572, 2392-2396): Keep.

### D. Drum Machine (keep)
- **Drum instruments + presets** (lines 282-360): Keep all 6 presets.
- **synthDrumHit()** (lines 364-497): Keep all 8 drum synths.
- **Drum playback** (lines 977-1031): Keep look-ahead scheduler.
- **Drum pattern toggle** (lines 964-971): Keep.
- **Drum grid UI** (lines 3282-3364): Keep but make inline/collapsible instead of bottom panel.
- **Drum localStorage persistence** (lines 1046-1071): Keep.

### E. Suno AI Integration (keep)
- **Suno generate** (lines 1414-1470): Keep full generation flow.
- **Suno library** (lines 1388-1496): Keep library browser.
- **Suno UI** (lines 3535-3776): Keep, but move from right sidebar to inline panel/modal.

### F. File Import (keep)
- **Import file** (lines 1353-1358): Keep.
- **Drag and drop** (lines 1361-1368): Keep.
- **File input** (line 2541-2542): Keep.

### G. Saved Recordings / IndexedDB (keep)
- **All IndexedDB helpers** (lines 84-170): Keep.
- **Recordings panel** (lines 1828-1887): Keep.
- **Recordings UI** (lines 3778-3878): Keep, move inline.
- **Save recording** (simplify from full offline render to simple blob save).

### H. Keyboard Shortcuts (keep, simplify)
- Space = play/pause
- R = record
- M = metronome
- Enter = rewind

---

## 3. NEW SIMPLIFIED LAYOUT

```
+-----------------------------------------------------------+
|  STUDIO                                                   |
|  [Mic: Built-in v] [BPM: 120] [Metronome]   [Record]     |
+-----------------------------------------------------------+
|                                                           |
|  TRACKS                                    [+ Add Track]  |
|                                                           |
|  +-------------------------------------------------------+|
|  | Guitar Recording 1    ====waveform====  Vol[--] [M] [x]||
|  +-------------------------------------------------------+|
|  | Vocal Take 2          ====waveform====  Vol[--] [M] [x]||
|  +-------------------------------------------------------+|
|  | Drums (Metal Double)  [Show Grid]       Vol[--] [M] [x]||
|  |   [Grid: KCK |x| |x| |x| |x| ...]   [Preset v]      ||
|  +-------------------------------------------------------+|
|  | AI Track (Am Aeolian)  ====waveform==== Vol[--] [M] [x]||
|  +-------------------------------------------------------+|
|                                                           |
|  + Add Track:                                             |
|    [Record Mic] [Drum Machine] [AI Backing] [Import File] |
|                                                           |
+-----------------------------------------------------------+
|  [|<] [Play] [Stop] [Loop]    00:00.0 / 01:32.0          |
+-----------------------------------------------------------+
|                                                           |
|  MY RECORDINGS                             [Search...]    |
|  +----------------------------------------------------+  |
|  | Practice Session 1   1:32  Mar 20  [Play] [Del]    |  |
|  | Riff Idea            0:45  Mar 19  [Play] [Del]    |  |
|  +----------------------------------------------------+  |
+-----------------------------------------------------------+
```

### Layout Principles:
1. **Single column, vertical scroll** -- no sidebar/bottom panel split
2. **Tracks are cards** -- each track is a horizontal card with waveform, volume slider, mute, delete
3. **Drum grid is inline** -- expands below the drum track card when clicked
4. **Suno AI is a modal/expandable section** -- not a permanent sidebar
5. **Transport bar is fixed at bottom of tracks section** -- simple play/stop/loop
6. **Recordings section is below** -- always visible, scrollable list
7. **Recording starts from top bar** -- big red record button, device selector
8. **No bottom panel tabs** -- everything is in the main flow
9. **No left sidebar** -- tracks are full-width cards
10. **No right sidebar** -- Suno opens as modal/panel

### Track Card Design:
```
+------------------------------------------------------------------+
| [color] Guitar Recording 1                [Vol ====] [M] [trash] |
|         ========== waveform display ===========                  |
+------------------------------------------------------------------+
```

- Left: color dot + track name (click to rename)
- Center: waveform (wavesurfer, simplified)
- Right: volume slider (horizontal), mute toggle, delete button
- No: pan, solo, effects, record arm, collapse, VU meter, color picker

---

## 4. ESTIMATED EFFORT

| Task | Lines removed | Lines added | Effort |
|------|--------------|-------------|--------|
| Remove effects system + types | ~700 | 0 | Medium |
| Remove pan/solo/VU | ~200 | 0 | Small |
| Remove regions/waveform editing | ~200 | 0 | Small |
| Remove export/WAV/MP3 | ~200 | 0 | Small |
| Remove bottom panel tabs | ~400 | 0 | Medium |
| Remove timeline/ruler/zoom | ~80 | 0 | Small |
| Remove YouTube import | ~40 | 0 | Small |
| Remove resizable panels | ~40 | 0 | Small |
| Remove complex recording settings | ~80 | 0 | Small |
| Simplify Tone.js node creation | ~30 removed | ~10 added | Small |
| Redesign layout to card-based | ~800 removed | ~400 added | Large |
| Move drum grid inline | ~50 removed | ~80 added | Small |
| Move Suno to modal/section | ~100 removed | ~60 added | Small |
| Simplify save (direct blob, no render) | ~80 removed | ~20 added | Small |
| Simplify top bar | ~200 removed | ~50 added | Medium |
| Add recordings section inline | ~20 removed | ~40 added | Small |
| **TOTAL** | **~3,200** | **~660** | **~2 days** |

**Final estimated size: ~1,400-1,600 lines**
(down from 4,004 — a 60-65% reduction)

---

## 5. MIGRATION PLAN

### Phase 1: Data Compatibility (do first)
1. Keep `StudioTrack` type but remove `pan`, `solo`, `recordArm`, `collapsed`, `effects`, `inputSettings` fields
2. Keep `SavedRecording` type unchanged (backward compatible)
3. Keep IndexedDB schema unchanged
4. Keep localStorage keys unchanged (`gf-recordings`, `gf-studio-drums`)
5. Keep Suno library format unchanged

### Phase 2: Strip Out (safe removals, no UI changes yet)
1. Delete `TrackEffects` interface and all effect-related code
2. Delete `TrackRegion` interface and all region editing code
3. Delete `AMP_PRESETS`, `AMP_SIM_PRESETS`, `MUSICAL_KEYS`, `MUSICAL_MODES`
4. Delete `EffectSection` and `FxKnob` sub-components
5. Delete export functions (`exportMix`, `exportMp3`, `audioBufferToWav`, `audioBufferToMp3`)
6. Delete VU meter animation
7. Delete resizable panel handlers
8. Delete YouTube import code
9. Delete snap to grid
10. Simplify `createToneNodes()` — just Player + Gain (no effect chain)

### Phase 3: Rebuild UI
1. Replace 3-panel layout (sidebar + timeline + right panel) with single-column card layout
2. Build simplified top bar: device selector, BPM, metronome, record button
3. Build track cards: name + waveform + volume + mute + delete
4. Build inline drum grid (collapsible under drum track card)
5. Build simple transport bar: rewind, play, stop, loop, time display
6. Build inline Suno section (expandable/modal)
7. Build inline recordings list

### Phase 4: Test
1. Test recording from mic (start/stop, creates track)
2. Test file import (drag/drop + button)
3. Test drum machine (presets, grid editing, playback)
4. Test Suno generation (generate, preview, add to tracks)
5. Test play all tracks together
6. Test save to recordings library
7. Test recordings list (play, delete, add to project)
8. Test mobile responsive layout
9. Test keyboard shortcuts (space, R, M, enter)

### Risk Mitigation:
- **Keep the old file as backup**: rename to `StudioPage.old.tsx` before starting
- **Incremental approach**: strip code in phases, test after each phase
- **localStorage compatibility**: never change data format, only simplify what the UI exposes
- **Tone.js simplification**: Player + Gain is enough for volume control per track

---

## 6. SIMPLIFIED TYPE DEFINITIONS

```typescript
interface StudioTrack {
  id: number;
  name: string;
  color: string;
  audioBlob: Blob | null;
  audioUrl: string | null;
  volume: number;       // 0-100
  muted: boolean;
  type: "recording" | "import" | "suno" | "drum";
  drumPattern?: boolean[][];
}
```

That's it. 9 fields instead of 16.

## 7. SIMPLIFIED STATE

### Keep (15 state vars):
- `tracks` — track list
- `isRec`, `recTime`, `recLevel` — recording state
- `playing` — playback state
- `looping` — loop toggle
- `masterVol` — master volume
- `bpm` — tempo
- `metronomeOn` — metronome toggle
- `currentTime`, `duration` — playback position
- `inputDevices`, `selectedInputDevice` — mic selection
- `savedRecordings` — recordings list
- `showSunoPanel` — Suno modal visibility
- `drumPlaying`, `drumStep` — drum playback state

### Remove (45+ state vars):
- `zoom`, `timeSigIdx`, `showTimeSigPicker`
- `showPanel`, `fxTrackId`, `ytQuery`, `ytVideoId`
- `selectedTrackId`, `editingTrackName`, `sidebarWidth`, `bottomPanelHeight`
- `bottomTab`, `trackMenuId`, `vuLevels`
- `projectName`, `editingProjectName`, `snapToGrid`
- `monitoring`, `showMetronomeSettings`, `metronomeVol`
- `ampPreset`, `ampKnobs`, `showRightPanel`, `contextSidebarTab`
- `projectKey`, `showKeyPicker`, `colorPickerTrackId`, `inputLevel`
- `showAddTrackMenu`, `inputSettingsTrackId`
- `exporting`, `exportProgress`, `showExportMenu`, `savingToLibrary`
- `showRecordingsPanel`, `recSearchQuery`, `editingRecId`, `previewingRecId`
- `regions`, `contextMenu`, `dragState`
- `drumGridExpanded`, `soundsTab`, `soundsSubTab`
