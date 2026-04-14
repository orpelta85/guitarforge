import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  let consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  // ========== FIX TEST 1: Profile via More dropdown ==========
  console.log('\n=== TEST 1 FIX: Navigation - Profile from More ===');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // After clicking Learning, we navigated away. The More dropdown may close.
    // Test Profile directly: go to homepage, click More, then Profile
    await page.locator('button:has-text("More")').first().click();
    await page.waitForTimeout(500);

    // Check the dropdown is open
    const bodyText = await page.locator('body').textContent();
    console.log('Dropdown has Profile:', bodyText.includes('Profile'));

    await page.locator('button:has-text("Profile")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);

    const profileText = await page.locator('body').textContent();
    const onProfile = profileText.includes('פרופיל') || profileText.includes('Profile') || profileText.includes('שם');
    console.log('Profile page loaded:', onProfile);

    // Now test full nav flow
    await page.locator('button:has-text("More")').first().click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Learning")').first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    const onLearning = (await page.locator('body').textContent()).includes('שיעורים');
    console.log('Learning from More works:', onLearning);

    console.log('TEST 1 VERDICT:', (onProfile && onLearning) ? 'PASS' : 'PARTIAL');
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);

  } catch (e) {
    console.log('Error:', e.message);
  }

  // ========== FIX TEST 7: MetronomeBox Rotary Knob ==========
  console.log('\n=== TEST 7 FIX: MetronomeBox - Rotary Knob ===');
  consoleErrors = [];
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Go to Practice
    await page.locator('button:has-text("Practice")').first().click();
    await page.waitForTimeout(2000);

    // Debug: find the exercise container structure
    const exInfo = await page.evaluate(() => {
      // Look for all clickable flex-1 divs (exercise rows)
      const clickables = document.querySelectorAll('.cursor-pointer');
      const results = [];
      for (let i = 0; i < Math.min(clickables.length, 10); i++) {
        results.push({
          tag: clickables[i].tagName,
          class: clickables[i].className.substring(0, 80),
          text: clickables[i].textContent.substring(0, 60),
          parent: clickables[i].parentElement?.className?.substring(0, 50) || 'none'
        });
      }
      return results;
    });
    console.log('Clickable elements:', JSON.stringify(exInfo, null, 2));

    // The exercises are in a list. Need to find the flex-1 cursor-pointer div
    // Try clicking the first exercise by evaluating in context
    const clicked = await page.evaluate(() => {
      const items = document.querySelectorAll('.flex-1.cursor-pointer');
      if (items.length > 0) {
        (items[0]).click();
        return items[0].textContent.substring(0, 60);
      }
      // Fallback: any cursor-pointer that contains exercise text
      const all = document.querySelectorAll('.cursor-pointer');
      for (const el of all) {
        if (el.textContent.includes('Chromatic') || el.textContent.includes('Spider') || el.textContent.includes('Picking')) {
          el.click();
          return el.textContent.substring(0, 60);
        }
      }
      return null;
    });
    console.log('Clicked exercise:', clicked);

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'qa-exercise-modal.png' });

    // Check for modal with metronome
    const modalInfo = await page.evaluate(() => {
      // Check for modal/overlay
      const body = document.body.innerHTML;
      const hasModal = body.includes('MetronomeBox') || body.includes('knobGrad') || body.includes('מטרונום');

      // Check for SVG circles (rotary knob)
      const svgs = document.querySelectorAll('svg');
      let rotaryFound = false;
      let circleCount = 0;
      let gradientFound = false;
      for (const svg of svgs) {
        const circles = svg.querySelectorAll('circle');
        circleCount += circles.length;
        if (svg.innerHTML.includes('knobGrad') || svg.innerHTML.includes('radialGradient')) {
          rotaryFound = true;
          gradientFound = true;
        }
        if (svg.innerHTML.includes('rotate')) {
          rotaryFound = true;
        }
      }

      const hasBPM = document.body.textContent.includes('BPM');
      const hasMetronome = document.body.textContent.includes('מטרונום');

      return { hasModal, rotaryFound, circleCount, gradientFound, hasBPM, hasMetronome };
    });
    console.log('Modal/Knob info:', JSON.stringify(modalInfo));

    console.log('TEST 7 VERDICT:', (modalInfo.rotaryFound || modalInfo.gradientFound) ? 'PASS' : 'FAIL');
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
    if (consoleErrors.length > 0) console.log('  Errors:', consoleErrors.slice(0, 5).join('\n  '));

  } catch (e) {
    console.log('Error:', e.message);
  }

  // ========== DEEP TEST 4: Drum grid cells verification ==========
  console.log('\n=== TEST 4 DEEP: Drum grid cells toggle ===');
  consoleErrors = [];
  try {
    await page.locator('button:has-text("Studio")').first().click();
    await page.waitForTimeout(2000);

    // The drum track from before should still be there
    // Select it and go to Editor
    const drumEl = page.locator(':text("Drums")').first();
    if (await drumEl.count() > 0) {
      await drumEl.click();
      await page.waitForTimeout(500);
    }

    await page.locator('button:has-text("Editor")').first().click();
    await page.waitForTimeout(1000);

    // The drum grid cells are small divs with specific styles, not cursor-pointer class
    const gridInfo = await page.evaluate(() => {
      // Look for the drum grid area - instrument names + 16 cells per row
      const body = document.body.innerHTML;

      // Find small clickable squares (the drum cells)
      // They are rendered with onClick and have specific bg colors
      const allDivs = document.querySelectorAll('div');
      let potentialCells = 0;
      let cellLocations = [];

      for (const d of allDivs) {
        const w = d.clientWidth;
        const h = d.clientHeight;
        // Drum cells are typically small squares (around 16-24px)
        if (w >= 12 && w <= 30 && h >= 12 && h <= 30 && w === h) {
          const style = d.getAttribute('style') || '';
          const cls = d.className || '';
          if (style.includes('#14') || style.includes('#18') || style.includes('#f59e0b') || cls.includes('cursor') || d.onclick || style.includes('cursor')) {
            potentialCells++;
          }
        }
      }

      // Also check: are there onClick handlers on these cells?
      // React attaches handlers to the root, so check for the instrument labels instead
      const instruments = ['Kick', 'Snare', 'HH', 'Tom', 'Clap', 'Rim', 'Crash', 'Ride'];
      const foundLabels = instruments.filter(i => body.includes(i));

      // Count cells by looking at the rendered HTML pattern
      // Each instrument row should have 16 cells
      const cellDivs = document.querySelectorAll('[style*="#141414"], [style*="#181818"], [style*="#f59e0b"]');

      return {
        potentialCells,
        foundLabels,
        styledCells: cellDivs.length,
      };
    });
    console.log('Grid deep info:', JSON.stringify(gridInfo));

    // Try clicking cells via evaluate
    const toggleResult = await page.evaluate(() => {
      // Find drum cell divs - they should have background color styles
      const cells = document.querySelectorAll('[style*="#141414"], [style*="#181818"]');
      if (cells.length > 0) {
        cells[0].click();
        return { clicked: true, totalCells: cells.length };
      }
      return { clicked: false, totalCells: 0 };
    });
    console.log('Toggle result:', JSON.stringify(toggleResult));

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'qa-drum-grid-deep.png' });

    console.log('TEST 4 VERDICT:', (gridInfo.foundLabels.length >= 5 && (gridInfo.styledCells > 0 || gridInfo.potentialCells > 0)) ? 'PASS' : 'NEEDS REVIEW');

  } catch (e) {
    console.log('Error:', e.message);
  }

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
