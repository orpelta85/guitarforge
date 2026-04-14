import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1200 } }); // taller viewport
  const page = await context.newPage();

  let consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  // ========== TEST 7: Add exercises first via AutoFill, then click ==========
  console.log('\n=== TEST 7: MetronomeBox - With AutoFill ===');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Practice")').click();
    await page.waitForTimeout(2000);

    // Click AutoFill to populate exercises
    await page.locator('button:has-text("Auto Fill")').click();
    await page.waitForTimeout(2000);

    // Now check for exercises in the list
    const exCount = await page.evaluate(() => {
      // Exercises should now be rendered as panel divs with cursor-pointer children
      // In Tailwind CSS 4, the class might be applied differently
      // Let's find all elements that have computed cursor: pointer AND contain exercise text
      const allEls = document.querySelectorAll('div, span');
      let exercises = [];
      for (const el of allEls) {
        const style = window.getComputedStyle(el);
        const text = el.textContent || '';
        if (style.cursor === 'pointer' && (text.includes('min') && text.includes('BPM')) && el.clientHeight > 20 && el.clientHeight < 100) {
          exercises.push({ text: text.substring(0, 80), tag: el.tagName, height: el.clientHeight });
        }
      }
      return exercises.slice(0, 5);
    });
    console.log('Exercise elements:', JSON.stringify(exCount, null, 2));

    // Try to click exercise by finding the div with exercise content and dispatching React synthetic click
    const clickedEx = await page.evaluate(() => {
      // Find spans containing exercise names
      const spans = document.querySelectorAll('span');
      for (const sp of spans) {
        const text = sp.textContent?.trim();
        if (text && (text.includes('Chromatic') || text.includes('Spider') || text.includes('Legato') || text.includes('Alternate'))) {
          // Check this is the one in the exercise list (not in select/option)
          if (sp.closest('option') || sp.closest('select') || sp.closest('optgroup')) continue;

          // Walk up to find the clickable parent
          let el = sp;
          while (el && el !== document.body) {
            // In React, onClick handlers are in the fiber
            const keys = Object.keys(el);
            const fiberKey = keys.find(k => k.startsWith('__reactFiber'));
            if (fiberKey) {
              const fiber = el[fiberKey];
              if (fiber?.memoizedProps?.onClick) {
                fiber.memoizedProps.onClick();
                return { clicked: true, text: sp.textContent };
              }
            }
            el = el.parentElement;
          }
        }
      }
      return { clicked: false };
    });
    console.log('Exercise click result:', JSON.stringify(clickedEx));

    await page.waitForTimeout(2000);

    // Check for modal
    const modalInfo = await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg');
      let rotaryKnob = false;
      let circleCount = 0;
      for (const svg of svgs) {
        const circles = svg.querySelectorAll('circle');
        circleCount += circles.length;
        if (svg.innerHTML.includes('knobGrad')) {
          rotaryKnob = true;
        }
      }

      const hasBPM = document.body.textContent.includes('BPM');
      const hasMetronome = document.body.textContent.includes('מטרונום');

      // Check for modal overlay
      const allEls = document.querySelectorAll('div');
      let hasOverlay = false;
      for (const el of allEls) {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' && el.clientWidth > 300 && el.clientHeight > 300) {
          hasOverlay = true;
          break;
        }
      }

      return { rotaryKnob, circleCount, hasBPM, hasMetronome, hasOverlay };
    });
    console.log('Modal info:', JSON.stringify(modalInfo));
    await page.screenshot({ path: 'qa-metronome-v2.png' });
    console.log('TEST 7 RESULT:', modalInfo.rotaryKnob ? 'PASS' : (modalInfo.hasOverlay ? 'PARTIAL - modal visible but no rotary' : 'FAIL'));

  } catch (e) {
    console.log('Error:', e.message.substring(0, 200));
  }

  // ========== TEST 4: Drum - proper track selection ==========
  console.log('\n=== TEST 4: Drum Machine - Deep Fix ===');
  consoleErrors = [];
  try {
    await page.locator('button:has-text("Studio")').click();
    await page.waitForTimeout(2000);

    // Add drum track
    await page.locator('button:has-text("Add Track")').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Drum Machine")').click();
    await page.waitForTimeout(2000);

    // Select the drum track by clicking on its row via React fiber
    const trackResult = await page.evaluate(() => {
      // The track rows are rendered in a list. Each has an onClick that sets selectedTrackId.
      // Find the drum track row and click it.
      const allDivs = document.querySelectorAll('div');
      for (const d of allDivs) {
        const text = d.textContent?.trim();
        if (!text || !text.match(/^Drums \d+/)) continue;

        // Check this is a track row (has specific dimensions)
        const rect = d.getBoundingClientRect();
        if (rect.height < 30 || rect.height > 200) continue;

        // Try to find the onClick handler in React fiber
        let el = d;
        while (el && el !== document.body) {
          const keys = Object.keys(el);
          const fiberKey = keys.find(k => k.startsWith('__reactFiber'));
          if (fiberKey) {
            const fiber = el[fiberKey];
            if (fiber?.memoizedProps?.onClick) {
              fiber.memoizedProps.onClick({ stopPropagation: () => {} });
              return { selected: true, tag: el.tagName, rect: { top: Math.round(rect.top), height: Math.round(rect.height) } };
            }
          }
          el = el.parentElement;
        }
      }
      return { selected: false };
    });
    console.log('Track selection via fiber:', JSON.stringify(trackResult));
    await page.waitForTimeout(500);

    // Also set fxTrackId by clicking the FX button on the drum track
    const fxResult = await page.evaluate(() => {
      // Find all buttons, look for "FX" near the drum track area
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.textContent?.trim() === 'FX') {
          const rect = btn.getBoundingClientRect();
          // The drum track is around top 205
          if (rect.top > 150 && rect.top < 350) {
            btn.click();
            return { clicked: true, top: Math.round(rect.top) };
          }
        }
      }
      // If no FX button near the track, try via fiber
      const allDivs = document.querySelectorAll('div');
      for (const d of allDivs) {
        if (d.textContent?.trim().match(/^Drums \d+$/)) {
          // Look for FX sibling button
          const parent = d.closest('div[class*="items"]') || d.parentElement?.parentElement;
          if (parent) {
            const fxBtn = parent.querySelector('button');
            if (fxBtn) {
              const keys = Object.keys(fxBtn);
              const fiberKey = keys.find(k => k.startsWith('__reactFiber'));
              if (fiberKey) {
                const fiber = fxBtn[fiberKey];
                if (fiber?.memoizedProps?.onClick) {
                  fiber.memoizedProps.onClick({ stopPropagation: () => {} });
                  return { clicked: true, viaFiber: true };
                }
              }
            }
          }
        }
      }
      return { clicked: false };
    });
    console.log('FX result:', JSON.stringify(fxResult));
    await page.waitForTimeout(500);

    // Click the bottom Editor tab
    const editorClicked = await page.evaluate(() => {
      // Get bottom-most Editor button
      const btns = document.querySelectorAll('button');
      let target = null, maxTop = 0;
      for (const btn of btns) {
        if (btn.textContent?.trim() === 'Editor') {
          const rect = btn.getBoundingClientRect();
          if (rect.top > maxTop) { maxTop = rect.top; target = btn; }
        }
      }
      if (target) { target.click(); return { clicked: true, top: maxTop }; }
      return { clicked: false };
    });
    console.log('Editor click:', JSON.stringify(editorClicked));
    await page.waitForTimeout(1000);

    // Check what's in the editor now
    const editorInfo = await page.evaluate(() => {
      const body = document.body.textContent;
      const instruments = ['Kick', 'Snare', 'HH', 'Tom H', 'Tom L', 'Clap', 'Rim', 'Crash'];
      const found = instruments.filter(i => body.includes(i));

      // Get the HTML of the editor panel area
      const allDivs = document.querySelectorAll('div');
      let editorPanel = '';
      for (const d of allDivs) {
        const rect = d.getBoundingClientRect();
        if (rect.top > 700 && d.children.length > 5 && d.textContent.length > 20) {
          editorPanel = d.innerHTML.substring(0, 500);
          break;
        }
      }

      return { instruments: found, editorHTML: editorPanel.substring(0, 300) };
    });
    console.log('Editor info:', JSON.stringify(editorInfo));

    await page.screenshot({ path: 'qa-drum-v3.png', fullPage: true });

    console.log('TEST 4 RESULT:', editorInfo.instruments.length >= 5 ? 'PASS' : 'FAIL - instruments: ' + editorInfo.instruments.join(','));
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
  } catch (e) {
    console.log('Error:', e.message.substring(0, 200));
  }

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
