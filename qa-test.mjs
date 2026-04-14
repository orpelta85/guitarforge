import { chromium } from 'playwright';

const results = {};
let consoleErrors = [];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  // ========== TEST 1: Navigation ==========
  console.log('\n=== TEST 1: Navigation ===');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Get all nav items
    const navSnapshot = await page.locator('nav, [role="navigation"]').first().textContent().catch(() => '');
    const allButtons = await page.locator('button, a').allTextContents();
    const navArea = allButtons.join(' | ');
    console.log('All buttons/links text:', navArea.substring(0, 500));

    // Look for the 5 main nav items + More
    const navItems = ['דשבורד', 'תרגול', 'ספרייה', 'סטודיו', 'עוד'];
    const altNavItems = ['Dashboard', 'Practice', 'Library', 'Studio', 'More'];

    // Get bottom nav / main nav buttons
    const bottomNav = await page.locator('nav').last();
    const navButtons = await bottomNav.locator('button, a').allTextContents();
    console.log('Nav buttons:', navButtons.join(' | '));

    // Check for 5 main items
    let foundMain = 0;
    for (const item of [...navItems, ...altNavItems]) {
      if (navArea.includes(item)) foundMain++;
    }

    // Try clicking "More" / "עוד"
    let moreBtn = page.locator('button:has-text("עוד"), button:has-text("More")').first();
    let moreExists = await moreBtn.count() > 0;

    if (!moreExists) {
      // Try looking for "..." or similar
      moreBtn = page.locator('button:has-text("...")').first();
      moreExists = await moreBtn.count() > 0;
    }

    console.log('More button exists:', moreExists);

    if (moreExists) {
      await moreBtn.click();
      await page.waitForTimeout(500);

      // Check dropdown items
      const dropdownText = await page.locator('[class*="dropdown"], [class*="menu"], [class*="popup"], [role="menu"]').first().textContent().catch(async () => {
        // fallback: just get all visible text
        return await page.locator('body').textContent();
      });

      const dropdownItems = ['למידה', 'מאמן', 'דוח', 'פרופיל', 'Learning', 'Coach', 'Report', 'Profile'];
      let foundDropdown = 0;
      for (const item of dropdownItems) {
        if (dropdownText.includes(item)) {
          foundDropdown++;
          console.log(`  Found dropdown item: ${item}`);
        }
      }

      // Click Learning
      let learningBtn = page.locator('button:has-text("למידה"), button:has-text("Learning")').first();
      if (await learningBtn.count() > 0) {
        await learningBtn.click();
        await page.waitForTimeout(1000);
        console.log('Clicked Learning - page loaded');
      }

      // Go back and click Profile
      if (moreExists) {
        await moreBtn.click().catch(() => {});
        await page.waitForTimeout(300);
        let profileBtn = page.locator('button:has-text("פרופיל"), button:has-text("Profile")').first();
        if (await profileBtn.count() > 0) {
          await profileBtn.click();
          await page.waitForTimeout(1000);
          console.log('Clicked Profile - page loaded');
        }
      }

      results['1. Navigation'] = foundDropdown >= 2 ? 'PASS' : 'PARTIAL - dropdown items missing';
    } else {
      // Maybe nav is structured differently - check all visible nav
      const pageText = await page.locator('body').textContent();
      const hasLearning = pageText.includes('למידה') || pageText.includes('Learning');
      results['1. Navigation'] = 'FAIL - No More button found';
    }

    const navErrors = consoleErrors.filter(e => !e.includes('favicon'));
    console.log('Console errors:', navErrors.length);

  } catch (e) {
    console.log('Error:', e.message);
    results['1. Navigation'] = `FAIL - ${e.message.substring(0, 100)}`;
  }

  // ========== TEST 2: Dashboard ==========
  console.log('\n=== TEST 2: Dashboard ===');
  consoleErrors = [];
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Click Dashboard
    const dashBtn = page.locator('button:has-text("דשבורד"), button:has-text("Dashboard")').first();
    if (await dashBtn.count() > 0) {
      await dashBtn.click();
      await page.waitForTimeout(1000);
    }

    const pageText = await page.locator('body').textContent();

    // Check for CHANNEL SETTINGS or Hebrew equivalent
    const hasChannelSettings = pageText.includes('CHANNEL SETTINGS') || pageText.includes('הגדרות ערוץ') || pageText.includes('הגדרות');
    console.log('Has Channel Settings header:', hasChannelSettings);

    // Check for CAT_GROUPS
    const catGroups = ['טכניקה', 'קצב ודינמיקה', 'תאוריה', 'מוזיקליות', 'יצירה'];
    let foundGroups = 0;

    // Click Edit button
    const editBtn = page.locator('button:has-text("עריכה"), button:has-text("Edit"), button:has-text("ערוך")').first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(1000);
      console.log('Clicked Edit button');

      const editorText = await page.locator('body').textContent();
      for (const group of catGroups) {
        if (editorText.includes(group)) {
          foundGroups++;
          console.log(`  Found group: ${group}`);
        }
      }
    } else {
      console.log('No edit button found, checking page directly');
      for (const group of catGroups) {
        if (pageText.includes(group)) {
          foundGroups++;
          console.log(`  Found group: ${group}`);
        }
      }
    }

    console.log(`Found ${foundGroups}/${catGroups.length} category groups`);
    const dashErrors = consoleErrors.length;
    console.log('Console errors:', dashErrors);

    results['2. Dashboard'] = (hasChannelSettings && foundGroups >= 3) ? 'PASS' :
      `PARTIAL - ChannelSettings:${hasChannelSettings}, Groups:${foundGroups}/5`;

  } catch (e) {
    console.log('Error:', e.message);
    results['2. Dashboard'] = `FAIL - ${e.message.substring(0, 100)}`;
  }

  // ========== TEST 3: Learning - Interactive Lessons ==========
  console.log('\n=== TEST 3: Learning - Interactive Lessons ===');
  consoleErrors = [];
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Navigate to Learning
    const moreBtn2 = page.locator('button:has-text("עוד"), button:has-text("More")').first();
    if (await moreBtn2.count() > 0) {
      await moreBtn2.click();
      await page.waitForTimeout(500);
    }
    const learnBtn = page.locator('button:has-text("למידה"), button:has-text("Learning")').first();
    if (await learnBtn.count() > 0) {
      await learnBtn.click();
      await page.waitForTimeout(1500);
    }

    // Click שיעורים tab
    const lessonsTab = page.locator('button:has-text("שיעורים"), button:has-text("Lessons")').first();
    if (await lessonsTab.count() > 0) {
      await lessonsTab.click();
      await page.waitForTimeout(1000);
    }

    // Look for "מהי תו?" lesson
    const pageText = await page.locator('body').textContent();
    const hasFirstLesson = pageText.includes('מהי תו');
    console.log('Has "מהי תו?" lesson:', hasFirstLesson);

    if (hasFirstLesson) {
      // Click it
      const lessonBtn = page.locator('button:has-text("מהי תו"), div:has-text("מהי תו")').first();
      await lessonBtn.click();
      await page.waitForTimeout(1500);

      const lessonText = await page.locator('body').textContent();

      // Check for interactive elements
      const hasVisualization = await page.locator('canvas, svg, [class*="visual"], [class*="render"]').count() > 0;
      const hasSteps = lessonText.includes('שלב') || lessonText.includes('Step') || await page.locator('[class*="step"]').count() > 0;
      const hasPrevNext = (lessonText.includes('הקודם') || lessonText.includes('Previous') || lessonText.includes('הבא') || lessonText.includes('Next'));
      const hasPlayBtn = await page.locator('button:has-text("נגן"), button:has-text("Play"), button:has-text("▶")').count() > 0;

      console.log('Has visualization:', hasVisualization);
      console.log('Has steps:', hasSteps);
      console.log('Has Prev/Next:', hasPrevNext);
      console.log('Has Play button:', hasPlayBtn);

      // Try clicking a step
      const stepButtons = page.locator('[class*="step"] button, button:has-text("שלב")');
      if (await stepButtons.count() > 1) {
        await stepButtons.nth(1).click();
        await page.waitForTimeout(500);
        console.log('Clicked a step');
      }

      const interactiveScore = [hasVisualization, hasSteps, hasPrevNext, hasPlayBtn].filter(Boolean).length;
      results['3. Learning - Interactive Lessons'] = interactiveScore >= 2 ? 'PASS' : `PARTIAL - interactive score ${interactiveScore}/4`;
    } else {
      // Maybe lessons are shown differently
      console.log('Page text (first 500):', pageText.substring(0, 500));
      results['3. Learning - Interactive Lessons'] = 'FAIL - Could not find first lesson';
    }

    console.log('Console errors:', consoleErrors.length);

  } catch (e) {
    console.log('Error:', e.message);
    results['3. Learning - Interactive Lessons'] = `FAIL - ${e.message.substring(0, 100)}`;
  }

  // ========== TEST 4: Studio - Drum Machine ==========
  console.log('\n=== TEST 4: Studio - Drum Machine ===');
  consoleErrors = [];
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Navigate to Studio
    const studioBtn = page.locator('button:has-text("סטודיו"), button:has-text("Studio")').first();
    if (await studioBtn.count() > 0) {
      await studioBtn.click();
      await page.waitForTimeout(2000);
    }

    const pageText = await page.locator('body').textContent();
    console.log('Studio page loaded, text preview:', pageText.substring(0, 300));

    // Click Add Track
    const addTrackBtn = page.locator('button:has-text("הוסף טראק"), button:has-text("Add Track"), button:has-text("+")').first();
    let addTrackExists = await addTrackBtn.count() > 0;
    console.log('Add Track button exists:', addTrackExists);

    if (addTrackExists) {
      await addTrackBtn.click();
      await page.waitForTimeout(1000);

      const menuText = await page.locator('body').textContent();
      const hasDrumMachine = menuText.includes('Drum Machine') || menuText.includes('תופים') || menuText.includes('drum');
      console.log('Has Drum Machine option:', hasDrumMachine);

      if (hasDrumMachine) {
        const drumBtn = page.locator('button:has-text("Drum Machine"), button:has-text("תופים"), button:has-text("drum")').first();
        if (await drumBtn.count() > 0) {
          await drumBtn.click();
          await page.waitForTimeout(1500);
          console.log('Clicked Drum Machine');

          const studioText = await page.locator('body').textContent();

          // Check for drum grid (16-step, 8 instruments)
          const hasGrid = await page.locator('[class*="grid"], [class*="drum"], table, [class*="sequencer"]').count() > 0;
          const hasEditor = studioText.includes('Editor') || studioText.includes('עורך');

          // Click Editor tab if exists
          const editorTab = page.locator('button:has-text("Editor"), button:has-text("עורך")').first();
          if (await editorTab.count() > 0) {
            await editorTab.click();
            await page.waitForTimeout(1000);
          }

          // Check for drum cells/buttons
          const drumCells = await page.locator('[class*="drum"] button, [class*="grid"] button, [class*="cell"], [class*="step"]').count();
          console.log('Drum cells found:', drumCells);

          // Try clicking a cell
          if (drumCells > 0) {
            const cell = page.locator('[class*="drum"] button, [class*="grid"] button, [class*="cell"], [class*="step"]').first();
            await cell.click();
            await page.waitForTimeout(300);
            console.log('Clicked a drum cell');
          }

          results['4. Studio - Drum Machine'] = (hasDrumMachine && drumCells > 0) ? 'PASS' :
            `PARTIAL - DrumOption:${hasDrumMachine}, Cells:${drumCells}`;
        } else {
          results['4. Studio - Drum Machine'] = 'FAIL - Drum Machine button not clickable';
        }
      } else {
        results['4. Studio - Drum Machine'] = 'FAIL - No Drum Machine option in Add Track';
      }
    } else {
      results['4. Studio - Drum Machine'] = 'FAIL - No Add Track button';
    }

    console.log('Console errors:', consoleErrors.length);
    if (consoleErrors.length > 0) console.log('Errors:', consoleErrors.slice(0, 3).join('\n'));

  } catch (e) {
    console.log('Error:', e.message);
    results['4. Studio - Drum Machine'] = `FAIL - ${e.message.substring(0, 100)}`;
  }

  // ========== TEST 5: Studio - Waveform ==========
  console.log('\n=== TEST 5: Studio - Waveform ===');
  consoleErrors = [];
  try {
    // We're already on the studio page, check for canvas waveform
    const canvasCount = await page.locator('canvas').count();
    console.log('Canvas elements found:', canvasCount);

    const hasPlayhead = await page.locator('[class*="playhead"], [class*="cursor"], [class*="timeline"]').count() > 0;
    console.log('Has playhead/timeline:', hasPlayhead);

    // Check for waveform-related elements
    const hasWaveform = await page.locator('[class*="waveform"], [class*="wave"], canvas').count() > 0;
    console.log('Has waveform elements:', hasWaveform);

    results['5. Studio - Waveform'] = (canvasCount > 0 || hasWaveform) ? 'PASS' : 'FAIL - No waveform canvas found';
    console.log('Console errors:', consoleErrors.length);

  } catch (e) {
    console.log('Error:', e.message);
    results['5. Studio - Waveform'] = `FAIL - ${e.message.substring(0, 100)}`;
  }

  // ========== TEST 6: Studio - Sound Library ==========
  console.log('\n=== TEST 6: Studio - Sound Library ===');
  consoleErrors = [];
  try {
    const studioText = await page.locator('body').textContent();

    // Look for recordings panel / right panel
    const hasRecordings = studioText.includes('הקלטות') || studioText.includes('Recordings');
    const hasSounds = studioText.includes('Sounds') || studioText.includes('צלילים');
    console.log('Has recordings tab:', hasRecordings);
    console.log('Has sounds tab:', hasSounds);

    if (hasSounds) {
      // Click Sounds tab
      const soundsTab = page.locator('button:has-text("Sounds"), button:has-text("צלילים")').first();
      if (await soundsTab.count() > 0) {
        await soundsTab.click();
        await page.waitForTimeout(1000);

        const soundsText = await page.locator('body').textContent();
        const hasMyFiles = soundsText.includes('My Files') || soundsText.includes('הקבצים שלי');
        const hasPresets = soundsText.includes('Presets') || soundsText.includes('פריסטים');
        const hasLoops = soundsText.includes('Loops') || soundsText.includes('לופים');

        console.log('Sub-tabs - My Files:', hasMyFiles, 'Presets:', hasPresets, 'Loops:', hasLoops);

        const subTabScore = [hasMyFiles, hasPresets, hasLoops].filter(Boolean).length;
        results['6. Studio - Sound Library'] = subTabScore >= 2 ? 'PASS' : `PARTIAL - SubTabs:${subTabScore}/3`;
      } else {
        results['6. Studio - Sound Library'] = 'FAIL - Sounds tab not clickable';
      }
    } else {
      // Maybe need to open right panel first
      const panelBtn = page.locator('button:has-text("הקלטות"), button:has-text("Recordings"), [class*="panel"] button').first();
      if (await panelBtn.count() > 0) {
        await panelBtn.click();
        await page.waitForTimeout(500);
      }
      results['6. Studio - Sound Library'] = hasRecordings ? 'PARTIAL - No Sounds tab' : 'FAIL - No recordings panel found';
    }

    console.log('Console errors:', consoleErrors.length);

  } catch (e) {
    console.log('Error:', e.message);
    results['6. Studio - Sound Library'] = `FAIL - ${e.message.substring(0, 100)}`;
  }

  // ========== TEST 7: MetronomeBox - Rotary Knob ==========
  console.log('\n=== TEST 7: MetronomeBox - Rotary Knob ===');
  consoleErrors = [];
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Navigate to Practice
    const practiceBtn = page.locator('button:has-text("תרגול"), button:has-text("Practice")').first();
    if (await practiceBtn.count() > 0) {
      await practiceBtn.click();
      await page.waitForTimeout(1500);
    }

    const pageText = await page.locator('body').textContent();

    // Find and click an exercise
    const exerciseCards = page.locator('[class*="exercise"], [class*="card"]');
    const exerciseCount = await exerciseCards.count();
    console.log('Exercise cards found:', exerciseCount);

    if (exerciseCount > 0) {
      await exerciseCards.first().click();
      await page.waitForTimeout(1500);

      const exerciseText = await page.locator('body').textContent();
      const hasBPM = exerciseText.includes('BPM') || exerciseText.includes('bpm');
      console.log('Has BPM:', hasBPM);

      // Check for rotary knob
      const hasRotary = await page.locator('[class*="rotary"], [class*="knob"], [class*="dial"], svg circle').count() > 0;
      const hasMetronome = exerciseText.includes('מטרונום') || exerciseText.includes('Metronome') || hasBPM;

      console.log('Has rotary/knob elements:', hasRotary);
      console.log('Has metronome:', hasMetronome);

      results['7. MetronomeBox - Rotary Knob'] = (hasMetronome && hasRotary) ? 'PASS' :
        `PARTIAL - Metronome:${hasMetronome}, Rotary:${hasRotary}`;
    } else {
      // Try clicking any button that looks like an exercise
      const anyBtn = page.locator('button').filter({ hasText: /alternate|picking|hammer|legato|sweep|tapping|chord/i }).first();
      if (await anyBtn.count() > 0) {
        await anyBtn.click();
        await page.waitForTimeout(1000);
        const hasRotary = await page.locator('[class*="rotary"], [class*="knob"], [class*="dial"], svg circle').count() > 0;
        results['7. MetronomeBox - Rotary Knob'] = hasRotary ? 'PASS' : 'PARTIAL - No rotary knob found';
      } else {
        results['7. MetronomeBox - Rotary Knob'] = 'FAIL - No exercises found to click';
      }
    }

    console.log('Console errors:', consoleErrors.length);
    if (consoleErrors.length > 0) console.log('Errors:', consoleErrors.slice(0, 3).join('\n'));

  } catch (e) {
    console.log('Error:', e.message);
    results['7. MetronomeBox - Rotary Knob'] = `FAIL - ${e.message.substring(0, 100)}`;
  }

  // ========== FINAL SUMMARY ==========
  console.log('\n\n========================================');
  console.log('QA TEST RESULTS SUMMARY');
  console.log('========================================');

  let passCount = 0;
  let totalCount = Object.keys(results).length;

  for (const [test, result] of Object.entries(results)) {
    const icon = result.startsWith('PASS') ? '✅' : result.startsWith('PARTIAL') ? '⚠️' : '❌';
    console.log(`${icon} ${test}: ${result}`);
    if (result.startsWith('PASS')) passCount++;
  }

  console.log(`\nTotal: ${passCount}/${totalCount} PASS`);
  console.log('========================================');

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
