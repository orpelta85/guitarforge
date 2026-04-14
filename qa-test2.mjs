import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  let consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // ========== TEST 4 DEEP: Studio - Drum Machine ==========
  console.log('\n=== TEST 4 DEEP: Studio - Drum Machine ===');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Navigate to Studio
    await page.locator('button:has-text("Studio")').first().click();
    await page.waitForTimeout(2000);

    // Click Add Track
    await page.locator('button:has-text("Add Track")').first().click();
    await page.waitForTimeout(1000);

    // Screenshot to see the menu
    await page.screenshot({ path: 'qa-addtrack-menu.png' });

    // Get all buttons visible now
    const allBtns = await page.locator('button').allTextContents();
    console.log('All buttons after Add Track click:', allBtns.filter(t => t.trim()).join(' | '));

    // Click Drum Machine
    const drumBtn = page.locator('button:has-text("Drum Machine"), button:has-text("Drum")').first();
    if (await drumBtn.count() > 0) {
      await drumBtn.click();
      await page.waitForTimeout(2000);
      console.log('Clicked Drum Machine');

      // Now click on the drum track to select it
      const drumTrack = page.locator('[class*="drum"], [class*="track"]').first();
      console.log('Drum track elements:', await page.locator('[class*="drum"]').count());

      // Take screenshot of studio after adding drum
      await page.screenshot({ path: 'qa-drum-added.png' });

      // Check Editor tab
      const editorTab = page.locator('button:has-text("Editor")').first();
      if (await editorTab.count() > 0) {
        await editorTab.click();
        await page.waitForTimeout(1000);
        console.log('Clicked Editor tab');
      }

      await page.screenshot({ path: 'qa-drum-editor.png' });

      // Get full HTML snippet to understand the DOM
      const bodyHTML = await page.evaluate(() => {
        const el = document.querySelector('[class*="drum"]') || document.querySelector('[class*="sequenc"]') || document.querySelector('[class*="grid"]');
        return el ? el.outerHTML.substring(0, 2000) : 'NO drum/sequencer/grid element found';
      });
      console.log('Drum DOM:', bodyHTML.substring(0, 1000));

      // Try broader selector for drum cells
      const allDivs = await page.evaluate(() => {
        // Look for the 16-step grid pattern
        const allElements = document.querySelectorAll('div[class], button[class]');
        const relevant = [];
        for (const el of allElements) {
          const cls = el.className;
          if (typeof cls === 'string' && (cls.includes('drum') || cls.includes('step') || cls.includes('cell') || cls.includes('beat') || cls.includes('pad') || cls.includes('sequenc'))) {
            relevant.push({ tag: el.tagName, class: cls.substring(0, 100), children: el.children.length });
          }
        }
        return relevant.slice(0, 20);
      });
      console.log('Relevant elements:', JSON.stringify(allDivs, null, 2));
    }

    console.log('Console errors:', consoleErrors.length);
    if (consoleErrors.length > 0) console.log('  Errors:', consoleErrors.slice(0, 5).join('\n  '));

  } catch (e) {
    console.log('Error:', e.message);
  }

  // ========== TEST 6 DEEP: Studio - Sound Library ==========
  console.log('\n=== TEST 6 DEEP: Studio - Sound Library ===');
  consoleErrors = [];
  try {
    // Already on studio page. Get full page text to search for tabs
    const bodyText = await page.locator('body').textContent();

    // Look for panel sections
    console.log('Looking for Library/Recordings in page...');
    const hasLibrary = bodyText.includes('Library');
    const hasRecordings = bodyText.includes('הקלטות') || bodyText.includes('Recordings');
    console.log('Library:', hasLibrary, 'Recordings:', hasRecordings);

    // The right panel might be the "Library" tab at the bottom of studio
    const libraryTab = page.locator('button:has-text("Library")');
    const libCount = await libraryTab.count();
    console.log('Library buttons found:', libCount);

    // Try clicking each one
    for (let i = 0; i < Math.min(libCount, 3); i++) {
      const text = await libraryTab.nth(i).textContent();
      console.log(`  Library button ${i}:`, text);
    }

    // Click the studio Library tab (should be different from nav Library)
    if (libCount > 0) {
      // Click the last one (studio panel tab, not nav)
      await libraryTab.last().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'qa-studio-library.png' });

      const panelText = await page.locator('body').textContent();
      const hasSounds = panelText.includes('Sounds');
      const hasRecTab = panelText.includes('הקלטות') || panelText.includes('Recordings') || panelText.includes('Records');
      console.log('After clicking Library - Sounds:', hasSounds, 'Recordings:', hasRecTab);

      if (hasSounds) {
        const soundsBtn = page.locator('button:has-text("Sounds")').first();
        await soundsBtn.click();
        await page.waitForTimeout(1000);

        const soundsText = await page.locator('body').textContent();
        console.log('My Files:', soundsText.includes('My Files'));
        console.log('Presets:', soundsText.includes('Presets'));
        console.log('Loops:', soundsText.includes('Loops'));
      }
    }

  } catch (e) {
    console.log('Error:', e.message);
  }

  // ========== TEST 7 DEEP: MetronomeBox - Rotary Knob ==========
  console.log('\n=== TEST 7 DEEP: MetronomeBox - Rotary Knob ===');
  consoleErrors = [];
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Navigate to Practice
    await page.locator('button:has-text("Practice")').first().click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'qa-practice-page.png' });

    const pageText = await page.locator('body').textContent();
    console.log('Practice page text (first 500):', pageText.substring(0, 500));

    // Get all clickable items
    const allBtns = await page.locator('button').allTextContents();
    console.log('All buttons:', allBtns.filter(t => t.trim()).slice(0, 30).join(' | '));

    // Try to find exercise items - they might be divs with onClick
    const clickableItems = await page.evaluate(() => {
      const items = document.querySelectorAll('[onclick], [class*="exercise"], [class*="item"], [class*="card"]');
      return Array.from(items).slice(0, 10).map(el => ({
        tag: el.tagName,
        class: (el.className || '').toString().substring(0, 80),
        text: el.textContent.substring(0, 80)
      }));
    });
    console.log('Clickable items:', JSON.stringify(clickableItems, null, 2));

    // Look for exercise names from exercises.ts
    const hasExercise = pageText.includes('Alternate Picking') || pageText.includes('Legato') ||
      pageText.includes('Sweep') || pageText.includes('Tapping') || pageText.includes('BPM');
    console.log('Has exercise text:', hasExercise);

    // Try clicking on any exercise-like text
    const exerciseBtns = page.locator('button, div[role="button"], [class*="cursor-pointer"]');
    const exCount = await exerciseBtns.count();
    console.log('Total clickable elements:', exCount);

    // Try to find and click an exercise row
    const exerciseRow = page.locator('text=Alternate Picking').first();
    if (await exerciseRow.count() > 0) {
      await exerciseRow.click();
      await page.waitForTimeout(1500);
      console.log('Clicked Alternate Picking');
      await page.screenshot({ path: 'qa-exercise-open.png' });

      // Now check for rotary knob
      const knobHTML = await page.evaluate(() => {
        const svgs = document.querySelectorAll('svg');
        let found = [];
        for (const svg of svgs) {
          if (svg.querySelector('circle') || svg.innerHTML.includes('rotate') || svg.innerHTML.includes('knob')) {
            found.push(svg.outerHTML.substring(0, 300));
          }
        }
        return found;
      });
      console.log('SVG circles/knobs found:', knobHTML.length);
      if (knobHTML.length > 0) console.log('First:', knobHTML[0]);

      const bpmText = await page.locator('body').textContent();
      console.log('Has BPM after click:', bpmText.includes('BPM'));

      // Check for any rotary-like elements
      const rotaryHTML = await page.evaluate(() => {
        const all = document.querySelectorAll('[class*="knob"], [class*="rotary"], [class*="dial"], [class*="bpm"]');
        return Array.from(all).map(el => ({ class: el.className.toString().substring(0, 80), tag: el.tagName }));
      });
      console.log('Rotary elements:', JSON.stringify(rotaryHTML));
    } else {
      // Try searching for any exercise by broader text
      console.log('No "Alternate Picking" found. Checking page structure...');

      // Maybe the practice view needs a day to be selected first
      const dayBtns = page.locator('button:has-text("Sun"), button:has-text("Mon"), button:has-text("ראשון"), button:has-text("שני")');
      console.log('Day buttons:', await dayBtns.count());
    }

    console.log('Console errors:', consoleErrors.length);
    if (consoleErrors.length > 0) console.log('  Errors:', consoleErrors.slice(0, 5).join('\n  '));

  } catch (e) {
    console.log('Error:', e.message);
  }

  // ========== TEST 5 DEEP: Studio Waveform ==========
  console.log('\n=== TEST 5 DEEP: Studio - Waveform check ===');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Studio")').first().click();
    await page.waitForTimeout(2000);

    // Add an audio track
    await page.locator('button:has-text("Add Track")').first().click();
    await page.waitForTimeout(500);

    const btns = await page.locator('button').allTextContents();
    console.log('Add Track options:', btns.filter(t => t.trim()).join(' | '));

    // Click Audio Track option
    const audioBtn = page.locator('button:has-text("Audio Track"), button:has-text("אודיו"), button:has-text("Audio")').first();
    if (await audioBtn.count() > 0) {
      await audioBtn.click();
      await page.waitForTimeout(1500);
    }

    // Check for canvas elements
    const canvasInfo = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return Array.from(canvases).map(c => ({ width: c.width, height: c.height, class: c.className }));
    });
    console.log('Canvas elements:', JSON.stringify(canvasInfo));

    // Check for timeline/playhead
    const timelineHTML = await page.evaluate(() => {
      const el = document.querySelector('[class*="timeline"], [class*="playhead"], [class*="ruler"]');
      return el ? el.outerHTML.substring(0, 500) : 'none';
    });
    console.log('Timeline element:', timelineHTML.substring(0, 200));

    await page.screenshot({ path: 'qa-studio-waveform.png' });

  } catch (e) {
    console.log('Error:', e.message);
  }

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
