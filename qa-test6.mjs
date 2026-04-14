import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  let consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  // ========== TEST 7: Exercise click debug ==========
  console.log('\n=== TEST 7: MetronomeBox Debug ===');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Practice")').click();
    await page.waitForTimeout(2000);

    // Check what's on the page
    const debug = await page.evaluate(() => {
      // Look for the exercise list items
      const panels = document.querySelectorAll('.panel, [class*="panel"]');
      let exerciseDivs = [];

      // The structure is: div.panel > button(led) + div.flex-1.cursor-pointer
      const allDivs = document.querySelectorAll('div');
      for (const d of allDivs) {
        const cl = d.className || '';
        if (typeof cl === 'string' && cl.includes('flex-1') && cl.includes('cursor-pointer')) {
          exerciseDivs.push({
            text: d.textContent.substring(0, 80),
            classList: cl.substring(0, 100),
            hasOnClick: typeof d.onclick === 'function'
          });
        }
      }

      // Also check with querySelectorAll for compound classes
      const compound = document.querySelectorAll('.flex-1.cursor-pointer');

      return {
        exerciseDivs: exerciseDivs.slice(0, 5),
        compoundCount: compound.length,
        pageHasCursorPointer: document.querySelectorAll('.cursor-pointer').length,
        pageHasFlex1: document.querySelectorAll('.flex-1').length
      };
    });
    console.log('Debug info:', JSON.stringify(debug, null, 2));

    // The problem: Tailwind CSS 4 might use different class output (e.g., data attributes or CSS layers)
    // Let's try finding elements by their text content instead
    const exerciseTexts = ['Chromatic 1-2-3-4', 'Spider Exercise', 'Legato Warm-Up', 'Alternate Picking'];
    let clickedEx = false;

    for (const exText of exerciseTexts) {
      const el = page.locator(`text=${exText}`).first();
      if (await el.count() > 0) {
        const isVisible = await el.isVisible().catch(() => false);
        console.log(`Found "${exText}", visible: ${isVisible}`);
        if (isVisible) {
          await el.click({ timeout: 5000 });
          clickedEx = true;
          console.log(`Clicked: ${exText}`);
          break;
        }
      }
    }

    if (!clickedEx) {
      // Try clicking via Playwright's has-text on a div
      const exerciseDiv = page.locator('div:has-text("Chromatic 1-2-3-4")').last();
      if (await exerciseDiv.count() > 0) {
        console.log('Trying last div with Chromatic text...');
        await exerciseDiv.click({ timeout: 5000 });
        clickedEx = true;
      }
    }

    if (!clickedEx) {
      // Force click via evaluate
      console.log('Trying force click via evaluate...');
      const result = await page.evaluate(() => {
        // Find text node containing exercise name
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (walker.currentNode.textContent.includes('Chromatic 1-2-3-4')) {
            // Walk up to find the cursor-pointer parent
            let el = walker.currentNode.parentElement;
            while (el && el !== document.body) {
              const style = window.getComputedStyle(el);
              if (style.cursor === 'pointer') {
                el.click();
                return { clicked: true, tag: el.tagName, text: el.textContent.substring(0, 60) };
              }
              el = el.parentElement;
            }
          }
        }
        return { clicked: false };
      });
      console.log('Force click result:', JSON.stringify(result));
      clickedEx = result.clicked;
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'qa-exercise-modal2.png' });

    if (clickedEx) {
      const knobInfo = await page.evaluate(() => {
        const svgs = document.querySelectorAll('svg');
        let rotaryFound = false;
        let circleCount = 0;
        for (const svg of svgs) {
          const circles = svg.querySelectorAll('circle');
          circleCount += circles.length;
          if (svg.innerHTML.includes('knobGrad') || svg.innerHTML.includes('radialGradient')) {
            rotaryFound = true;
          }
        }
        const hasBPM = document.body.textContent.includes('BPM');
        const hasModal = document.body.innerHTML.includes('fixed') && document.body.innerHTML.includes('inset');
        return { rotaryFound, circleCount, hasBPM, hasModal };
      });
      console.log('Knob info:', JSON.stringify(knobInfo));
      console.log('RESULT:', knobInfo.rotaryFound ? 'PASS' : (knobInfo.hasBPM ? 'PARTIAL - modal open but no rotary' : 'FAIL'));
    }

    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
    if (consoleErrors.length > 0) console.log('Errors:', consoleErrors.slice(0, 3).join('\n'));
  } catch (e) {
    console.log('Error:', e.message.substring(0, 200));
  }

  // ========== TEST 4: Drum Grid - fixed Editor locator ==========
  console.log('\n=== TEST 4: Drum Grid Fix ===');
  consoleErrors = [];
  try {
    await page.locator('button:has-text("Studio")').click();
    await page.waitForTimeout(2000);

    // Add drum track
    await page.locator('button:has-text("Add Track")').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Drum Machine")').click();
    await page.waitForTimeout(2000);

    // Select the drum track - click on its name in the track list
    // The track names are in the left panel
    const selected = await page.evaluate(() => {
      const els = document.querySelectorAll('span, div');
      for (const el of els) {
        const text = el.textContent?.trim();
        if (text && (text === 'Drums 1' || text === 'Drums 2' || text === 'Drums 3') && el.tagName !== 'OPTION') {
          // Click the parent track row
          let p = el;
          for (let i = 0; i < 5; i++) {
            p = p.parentElement;
            if (!p) break;
            if (p.onclick || p.getAttribute('onclick')) {
              p.click();
              return { clicked: true, text };
            }
          }
          // Just click the element itself
          el.click();
          return { clicked: true, text, directClick: true };
        }
      }
      return { clicked: false };
    });
    console.log('Track select:', JSON.stringify(selected));
    await page.waitForTimeout(500);

    // Click the FX button on the drum track to make it fxTrack
    const fxResult = await page.evaluate(() => {
      // Find buttons with text "FX" near the drum track
      const btns = document.querySelectorAll('button');
      const fxBtns = [];
      for (const btn of btns) {
        if (btn.textContent.trim() === 'FX') {
          fxBtns.push(btn);
        }
      }
      // Click the last FX button (should be the drum track's)
      if (fxBtns.length > 0) {
        fxBtns[fxBtns.length - 1].click();
        return { clicked: true, count: fxBtns.length };
      }
      return { clicked: false };
    });
    console.log('FX button:', JSON.stringify(fxResult));
    await page.waitForTimeout(500);

    // Now click Editor tab - use nth to get the bottom panel one
    const editorBtns = page.locator('button:has-text("Editor")');
    const edCount = await editorBtns.count();
    console.log('Editor buttons:', edCount);
    // Click the last Editor button (bottom panel)
    if (edCount > 0) {
      await editorBtns.last().click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'qa-drum-grid-v2.png' });

    // Check drum grid
    const drumGrid = await page.evaluate(() => {
      const text = document.body.textContent;
      const instruments = ['Kick', 'Snare', 'HH', 'Tom H', 'Tom L', 'Clap', 'Rim', 'Crash'];
      const found = instruments.filter(i => text.includes(i));

      // Count cell-like elements
      const allDivs = document.querySelectorAll('div[style]');
      let cells = 0;
      for (const d of allDivs) {
        const s = d.getAttribute('style') || '';
        if ((s.includes('141414') || s.includes('181818') || s.includes('f59e0b')) &&
            d.clientWidth >= 10 && d.clientWidth <= 30 && d.clientHeight >= 10 && d.clientHeight <= 30) {
          cells++;
        }
      }

      // Also check for Play/Stop drum buttons
      const hasPlayDrum = text.includes('▶') || text.includes('⏹');

      return { instruments: found, cells, hasPlayDrum };
    });
    console.log('Drum grid:', JSON.stringify(drumGrid));

    // Try to click a cell
    if (drumGrid.cells > 0) {
      const toggleResult = await page.evaluate(() => {
        const allDivs = document.querySelectorAll('div[style]');
        let clicked = 0;
        for (const d of allDivs) {
          const s = d.getAttribute('style') || '';
          if ((s.includes('141414') || s.includes('181818')) &&
              d.clientWidth >= 10 && d.clientWidth <= 30) {
            d.click();
            clicked++;
            if (clicked >= 3) break;
          }
        }
        return { clicked };
      });
      console.log('Cells toggled:', toggleResult.clicked);
    }

    console.log('RESULT:', (drumGrid.instruments.length >= 5 && drumGrid.cells > 0) ? 'PASS' :
      (drumGrid.instruments.length >= 5 ? 'PARTIAL - instruments shown but no cells detected' : 'FAIL'));
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
  } catch (e) {
    console.log('Error:', e.message.substring(0, 200));
  }

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
