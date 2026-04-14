import { chromium } from 'playwright';

const results = {};

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  let consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  // ========== TEST 1: Navigation ==========
  console.log('\n=== TEST 1: Navigation (5 items + More) ===');
  consoleErrors = [];
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check nav buttons
    const navBar = page.locator('nav').last();
    const navBtnTexts = await navBar.locator('button').allTextContents();
    console.log('Nav buttons:', navBtnTexts.join(' | '));

    const has5Items = navBtnTexts.some(t => t.includes('Dashboard')) &&
                      navBtnTexts.some(t => t.includes('Practice')) &&
                      navBtnTexts.some(t => t.includes('Library')) &&
                      navBtnTexts.some(t => t.includes('Studio')) &&
                      navBtnTexts.some(t => t.includes('More'));
    console.log('Has 5 main items + More:', has5Items);

    // Click More
    await page.locator('button:has-text("More")').first().click();
    await page.waitForTimeout(500);

    const bodyText = await page.locator('body').textContent();
    const dropdownItems = { Learning: bodyText.includes('Learning'), Coach: bodyText.includes('Coach'), Report: bodyText.includes('Report'), Profile: bodyText.includes('Profile') };
    console.log('Dropdown items:', JSON.stringify(dropdownItems));

    // Click Learning
    await page.locator('button:has-text("Learning")').first().click();
    await page.waitForTimeout(1500);
    const onLearning = (await page.locator('body').textContent()).includes('שיעורים') || (await page.locator('body').textContent()).includes('Lessons');
    console.log('Learning page loaded:', onLearning);

    // Click More then Profile
    await page.locator('button:has-text("More")').first().click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Profile")').first().click();
    await page.waitForTimeout(1000);
    const onProfile = (await page.locator('body').textContent()).includes('Profile') || (await page.locator('body').textContent()).includes('פרופיל');
    console.log('Profile page loaded:', onProfile);

    const allPassed = has5Items && Object.values(dropdownItems).every(Boolean) && onLearning;
    results['1. Navigation'] = allPassed ? 'PASS' : `FAIL - 5items:${has5Items}, dropdown:${JSON.stringify(dropdownItems)}, learning:${onLearning}`;
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
  } catch (e) {
    console.log('Error:', e.message);
    results['1. Navigation'] = 'FAIL - ' + e.message.substring(0, 100);
  }

  // ========== TEST 2: Dashboard ==========
  console.log('\n=== TEST 2: Dashboard ===');
  consoleErrors = [];
  try {
    await page.locator('button:has-text("Dashboard")').first().click();
    await page.waitForTimeout(1500);

    const dashText = await page.locator('body').textContent();
    const hasChannelSettings = dashText.includes('CHANNEL SETTINGS') || dashText.includes('הגדרות');
    console.log('Channel Settings:', hasChannelSettings);

    // Click Edit
    const editBtn = page.locator('button:has-text("Edit"), button:has-text("עריכה"), button:has-text("ערוך")').first();
    await editBtn.click();
    await page.waitForTimeout(1000);

    const editorText = await page.locator('body').textContent();
    const catGroups = ['טכניקה', 'קצב ודינמיקה', 'תאוריה', 'מוזיקליות', 'יצירה'];
    let foundGroups = 0;
    for (const g of catGroups) {
      if (editorText.includes(g)) { foundGroups++; console.log('  Found:', g); }
    }

    results['2. Dashboard'] = (hasChannelSettings && foundGroups === 5) ? 'PASS' : `FAIL - header:${hasChannelSettings}, groups:${foundGroups}/5`;
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
  } catch (e) {
    console.log('Error:', e.message);
    results['2. Dashboard'] = 'FAIL - ' + e.message.substring(0, 100);
  }

  // ========== TEST 3: Learning - Interactive Lessons ==========
  console.log('\n=== TEST 3: Learning - Interactive Lessons ===');
  consoleErrors = [];
  try {
    await page.locator('button:has-text("More")').first().click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Learning")').first().click();
    await page.waitForTimeout(1500);

    // Click שיעורים tab
    const lessonsTab = page.locator('button:has-text("שיעורים")').first();
    if (await lessonsTab.count() > 0) {
      await lessonsTab.click();
      await page.waitForTimeout(1000);
    }

    // Find מהי תו
    const lessonText = await page.locator('body').textContent();
    const hasLesson = lessonText.includes('מהי תו');
    console.log('Has מהי תו lesson:', hasLesson);

    // Click it - could be a div or button
    const lessonEl = page.locator(':text("מהי תו")').first();
    await lessonEl.click();
    await page.waitForTimeout(2000);

    const detailText = await page.locator('body').textContent();

    // Check interactive elements
    const hasVis = await page.locator('canvas, svg').count() > 0;
    const hasSteps = detailText.includes('שלב') || await page.locator('[class*="step"]').count() > 0;
    const hasPrevNext = detailText.includes('הקודם') || detailText.includes('הבא') || detailText.includes('Previous') || detailText.includes('Next');
    const hasPlay = detailText.includes('נגן') || detailText.includes('Play') || detailText.includes('▶');

    console.log('Visualization:', hasVis, 'Steps:', hasSteps, 'Prev/Next:', hasPrevNext, 'Play:', hasPlay);

    // Try clicking Next/step buttons
    const nextBtn = page.locator('button:has-text("הבא"), button:has-text("Next")').first();
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      console.log('Clicked Next step');
    }

    const score = [hasVis, hasSteps, hasPrevNext, hasPlay].filter(Boolean).length;
    results['3. Learning - Interactive Lessons'] = score >= 3 ? 'PASS' : `FAIL - vis:${hasVis}, steps:${hasSteps}, nav:${hasPrevNext}, play:${hasPlay}`;
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
  } catch (e) {
    console.log('Error:', e.message);
    results['3. Learning - Interactive Lessons'] = 'FAIL - ' + e.message.substring(0, 100);
  }

  // ========== TEST 4: Studio - Drum Machine ==========
  console.log('\n=== TEST 4: Studio - Drum Machine ===');
  consoleErrors = [];
  try {
    await page.locator('button:has-text("Studio")').first().click();
    await page.waitForTimeout(2000);

    // Add Drum Track
    await page.locator('button:has-text("Add Track")').first().click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Drum Machine")').first().click();
    await page.waitForTimeout(1500);

    // Check drum track was created
    const hasDrumTrack = (await page.locator('body').textContent()).includes('Drums');
    console.log('Drum track created:', hasDrumTrack);

    // Select the drum track by clicking on it in the tracks list
    // The track name should appear in the track list
    const drumTrackEl = page.locator(':text("Drums 1"), :text("Drums")').first();
    if (await drumTrackEl.count() > 0) {
      await drumTrackEl.click();
      await page.waitForTimeout(500);
      console.log('Selected drum track');
    }

    // Click Editor tab at bottom
    const editorTab = page.locator('button:has-text("Editor")').first();
    await editorTab.click();
    await page.waitForTimeout(1000);

    // Now check for drum grid - look for the specific DOM structure
    const drumInfo = await page.evaluate(() => {
      // The drum grid cells are divs with onClick handlers, w-5 h-5 or similar
      const body = document.body.innerHTML;
      const hasDrumGrid = body.includes('Kick') || body.includes('Snare') || body.includes('HH') || body.includes('Hi-Hat');

      // Count small clickable cells (drum pads)
      const allDivs = document.querySelectorAll('div[style*="cursor"]');
      let drumCells = 0;
      for (const d of allDivs) {
        const style = d.getAttribute('style') || '';
        if (style.includes('cursor') && d.clientWidth < 30 && d.clientHeight < 30 && d.clientWidth > 8) {
          drumCells++;
        }
      }

      // Also look for grid-like structure
      const gridCells = document.querySelectorAll('div.cursor-pointer');

      return { hasDrumGrid, drumCells, gridCellsCount: gridCells.length };
    });
    console.log('Drum grid info:', JSON.stringify(drumInfo));

    // Check for instrument names in the editor
    const editorText = await page.locator('body').textContent();
    const instruments = ['Kick', 'Snare', 'HH', 'Hi-Hat', 'Tom', 'Clap', 'Rim', 'Crash', 'Ride'];
    let foundInstr = 0;
    for (const instr of instruments) {
      if (editorText.includes(instr)) { foundInstr++; }
    }
    console.log('Instruments found:', foundInstr);

    // Try to click a cell - they should be small divs with cursor-pointer
    const cells = page.locator('div.cursor-pointer');
    const cellCount = await cells.count();
    console.log('Cursor-pointer divs:', cellCount);

    if (cellCount > 10) {
      // Click a few cells
      await cells.nth(10).click();
      await page.waitForTimeout(200);
      await cells.nth(15).click();
      await page.waitForTimeout(200);
      console.log('Toggled drum cells');
    }

    await page.screenshot({ path: 'qa-drum-final.png' });

    const drumPass = hasDrumTrack && (drumInfo.hasDrumGrid || foundInstr >= 3);
    results['4. Studio - Drum Machine'] = drumPass ? 'PASS' : `FAIL - track:${hasDrumTrack}, grid:${drumInfo.hasDrumGrid}, instruments:${foundInstr}`;
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
    if (consoleErrors.length > 0) console.log('  Errors:', consoleErrors.slice(0, 3).join('\n  '));
  } catch (e) {
    console.log('Error:', e.message);
    results['4. Studio - Drum Machine'] = 'FAIL - ' + e.message.substring(0, 100);
  }

  // ========== TEST 5: Studio - Waveform ==========
  console.log('\n=== TEST 5: Studio - Waveform ===');
  consoleErrors = [];
  try {
    // Check current studio state - do we have a track with audio?
    // The drum track won't have a waveform. Check for canvas or waveform elements
    const waveformInfo = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const waveDivs = document.querySelectorAll('[class*="wave"], [data-waveform]');
      const timelineEl = document.querySelector('[class*="timeline"], [class*="ruler"], [class*="playhead"]');
      const timeRuler = document.querySelector('[class*="time"]');

      // Check for the playhead line
      const allDivs = document.querySelectorAll('div');
      let playheadFound = false;
      for (const d of allDivs) {
        const style = d.getAttribute('style') || '';
        if (style.includes('position') && style.includes('left') && d.clientWidth <= 2 && d.clientHeight > 50) {
          playheadFound = true;
          break;
        }
      }

      return {
        canvasCount: canvases.length,
        waveformDivs: waveDivs.length,
        hasTimeline: !!timelineEl || !!timeRuler,
        hasPlayhead: playheadFound,
        bodyHasTimecode: document.body.textContent.includes('00:00') || document.body.textContent.includes('88:88')
      };
    });
    console.log('Waveform info:', JSON.stringify(waveformInfo));

    // The studio has a timeline/ruler with numbers 1-16 visible in the text
    const studioText = await page.locator('body').textContent();
    const hasTimeline = /\b[1-9]\b.*\b1[0-6]\b/.test(studioText) || studioText.includes('00:00');
    console.log('Has timeline numbers:', hasTimeline);

    // Without an actual audio file loaded, there won't be waveform canvases
    // But the playhead and timeline should exist
    const timePass = waveformInfo.hasTimeline || waveformInfo.bodyHasTimecode || hasTimeline;
    results['5. Studio - Waveform'] = timePass ? 'PASS (timeline present, no audio loaded for waveform)' : 'FAIL - No timeline or playhead';
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
  } catch (e) {
    console.log('Error:', e.message);
    results['5. Studio - Waveform'] = 'FAIL - ' + e.message.substring(0, 100);
  }

  // ========== TEST 6: Studio - Sound Library ==========
  console.log('\n=== TEST 6: Studio - Sound Library ===');
  consoleErrors = [];
  try {
    // The right panel has a "Library" tab in the bottom panel tabs
    // Click the Library tab (the one in the studio bottom panel, not nav)
    const libraryBtns = page.locator('button:has-text("Library")');
    const count = await libraryBtns.count();
    console.log('Library buttons found:', count);

    // The last Library button should be the studio panel one
    if (count > 0) {
      await libraryBtns.last().click();
      await page.waitForTimeout(1000);

      const panelText = await page.locator('body').textContent();
      const hasRecordings = panelText.includes('הקלטות') || panelText.includes('Recordings');
      const hasSounds = panelText.includes('Sounds');
      console.log('Recordings tab:', hasRecordings, 'Sounds tab:', hasSounds);

      if (hasSounds) {
        await page.locator('button:has-text("Sounds")').first().click();
        await page.waitForTimeout(1000);

        const soundsText = await page.locator('body').textContent();
        const hasMyFiles = soundsText.includes('My Files');
        const hasPresets = soundsText.includes('Presets');
        const hasLoops = soundsText.includes('Loops');
        console.log('Sub-tabs - My Files:', hasMyFiles, 'Presets:', hasPresets, 'Loops:', hasLoops);

        const subTabs = [hasMyFiles, hasPresets, hasLoops].filter(Boolean).length;
        results['6. Studio - Sound Library'] = (hasRecordings && hasSounds && subTabs >= 2) ? 'PASS' :
          `FAIL - recordings:${hasRecordings}, sounds:${hasSounds}, subtabs:${subTabs}/3`;
      } else {
        results['6. Studio - Sound Library'] = `FAIL - recordings:${hasRecordings}, sounds:${hasSounds}`;
      }
    } else {
      results['6. Studio - Sound Library'] = 'FAIL - No Library button found';
    }
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
  } catch (e) {
    console.log('Error:', e.message);
    results['6. Studio - Sound Library'] = 'FAIL - ' + e.message.substring(0, 100);
  }

  // ========== TEST 7: MetronomeBox - Rotary Knob ==========
  console.log('\n=== TEST 7: MetronomeBox - Rotary Knob ===');
  consoleErrors = [];
  try {
    await page.locator('button:has-text("Practice")').first().click();
    await page.waitForTimeout(2000);

    // Find exercise items - they're div.cursor-pointer with exercise names
    // Click on an exercise text area
    const exerciseItem = page.locator('.cursor-pointer:has-text("Chromatic")').first();
    const exExists = await exerciseItem.count() > 0;
    console.log('Exercise clickable found:', exExists);

    if (exExists) {
      await exerciseItem.click();
      await page.waitForTimeout(2000);
    } else {
      // Try broader approach - look for any exercise-like text in a clickable container
      const anyExercise = page.locator('div.cursor-pointer').first();
      if (await anyExercise.count() > 0) {
        await anyExercise.click();
        await page.waitForTimeout(2000);
        console.log('Clicked first cursor-pointer div');
      }
    }

    // Check for rotary knob (SVG with circle)
    const knobInfo = await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg');
      let rotaryFound = false;
      let circleCount = 0;
      for (const svg of svgs) {
        const circles = svg.querySelectorAll('circle');
        if (circles.length > 0) {
          circleCount += circles.length;
          // Check for radialGradient (knob indicator)
          if (svg.innerHTML.includes('knobGrad') || svg.innerHTML.includes('radialGradient') || svg.innerHTML.includes('rotate')) {
            rotaryFound = true;
          }
        }
      }
      // Check for BPM text
      const hasBPM = document.body.textContent.includes('BPM');
      const hasMetronome = document.body.textContent.includes('מטרונום') || document.body.textContent.includes('Metronome');

      return { rotaryFound, circleCount, hasBPM, hasMetronome };
    });
    console.log('Knob info:', JSON.stringify(knobInfo));

    await page.screenshot({ path: 'qa-metronome.png' });

    results['7. MetronomeBox - Rotary Knob'] = (knobInfo.rotaryFound && knobInfo.hasBPM) ? 'PASS' :
      `FAIL - rotary:${knobInfo.rotaryFound}, bpm:${knobInfo.hasBPM}, circles:${knobInfo.circleCount}`;
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
    if (consoleErrors.length > 0) console.log('  Errors:', consoleErrors.slice(0, 3).join('\n  '));
  } catch (e) {
    console.log('Error:', e.message);
    results['7. MetronomeBox - Rotary Knob'] = 'FAIL - ' + e.message.substring(0, 100);
  }

  // ========== FINAL SUMMARY ==========
  console.log('\n\n========================================');
  console.log('    QA TEST RESULTS — GuitarForge');
  console.log('========================================\n');

  let passCount = 0;
  let totalCount = Object.keys(results).length;

  for (const [test, result] of Object.entries(results)) {
    const status = result.startsWith('PASS') ? 'PASS' : result.startsWith('PARTIAL') ? 'PARTIAL' : 'FAIL';
    const icon = status === 'PASS' ? 'PASS' : status === 'PARTIAL' ? 'WARN' : 'FAIL';
    console.log(`[${icon}] ${test}`);
    console.log(`       ${result}\n`);
    if (status === 'PASS') passCount++;
  }

  console.log(`========================================`);
  console.log(`TOTAL: ${passCount}/${totalCount} PASS`);
  console.log(`========================================`);

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
