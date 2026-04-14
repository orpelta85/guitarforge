import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1200 } });
  const page = await context.newPage();

  let consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  // ========== TEST 4: Drum Machine ==========
  console.log('\n=== TEST 4: Drum Machine ===');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Go directly to Studio
    await page.locator('button:has-text("Studio")').click();
    await page.waitForTimeout(3000);

    // Add drum track
    await page.locator('button:has-text("Add Track")').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Drum Machine")').click();
    await page.waitForTimeout(2000);

    const drumCreated = (await page.locator('body').textContent()).includes('Drums');
    console.log('Drum track created:', drumCreated);

    // Select drum track via React fiber
    const selected = await page.evaluate(() => {
      const allDivs = document.querySelectorAll('div');
      for (const d of allDivs) {
        const text = d.textContent?.trim();
        if (!text || !text.match(/^Drums \d+/)) continue;
        const rect = d.getBoundingClientRect();
        if (rect.height < 30 || rect.height > 200) continue;

        let el = d;
        while (el && el !== document.body) {
          const keys = Object.keys(el);
          const fiberKey = keys.find(k => k.startsWith('__reactFiber'));
          if (fiberKey) {
            const fiber = el[fiberKey];
            if (fiber?.memoizedProps?.onClick) {
              fiber.memoizedProps.onClick({ stopPropagation: () => {} });
              return true;
            }
          }
          el = el.parentElement;
        }
      }
      return false;
    });
    console.log('Track selected via fiber:', selected);
    await page.waitForTimeout(500);

    // Set fxTrack by clicking FX button near the drum track
    const fxClicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      // Find the FX button that's in the mixer strip for the drum track
      for (const btn of btns) {
        const text = btn.textContent?.trim();
        if (text === 'FX') {
          const rect = btn.getBoundingClientRect();
          // The drum track mixer strip should be around certain area
          btn.click();
          return { clicked: true, rect: { top: Math.round(rect.top), left: Math.round(rect.left) } };
        }
      }
      return { clicked: false };
    });
    console.log('FX clicked:', JSON.stringify(fxClicked));
    await page.waitForTimeout(500);

    // Click Editor tab (the one in the bottom panel, highest Y)
    const editorClick = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      let target = null, maxTop = 0;
      for (const btn of btns) {
        if (btn.textContent?.trim() === 'Editor') {
          const rect = btn.getBoundingClientRect();
          if (rect.top > maxTop) { maxTop = rect.top; target = btn; }
        }
      }
      if (target) { target.click(); return true; }
      return false;
    });
    console.log('Editor clicked:', editorClick);
    await page.waitForTimeout(1000);

    // Check for drum instruments and grid
    const drumGrid = await page.evaluate(() => {
      const text = document.body.textContent;
      const instruments = ['Kick', 'Snare', 'HH', 'Tom H', 'Tom L', 'Clap', 'Rim', 'Crash'];
      const found = instruments.filter(i => text.includes(i));

      // Check for styled cells (background #141414 or #181818)
      const allDivs = document.querySelectorAll('div');
      let cellCount = 0;
      for (const d of allDivs) {
        const bg = d.style?.background || d.style?.backgroundColor || '';
        if ((bg.includes('141414') || bg.includes('181818') || bg.includes('f59e0b'))) {
          const rect = d.getBoundingClientRect();
          if (rect.width >= 10 && rect.width <= 30 && rect.height >= 10 && rect.height <= 30) {
            cellCount++;
          }
        }
      }

      return { instruments: found, cellCount, hasPlay: text.includes('▶') || text.includes('⏹'), hasClear: text.includes('Clear') };
    });
    console.log('Drum grid:', JSON.stringify(drumGrid));

    if (drumGrid.cellCount > 0) {
      // Toggle some cells
      const toggleResult = await page.evaluate(() => {
        const allDivs = document.querySelectorAll('div');
        let toggled = 0;
        for (const d of allDivs) {
          const bg = d.style?.background || d.style?.backgroundColor || '';
          if ((bg.includes('141414') || bg.includes('181818'))) {
            const rect = d.getBoundingClientRect();
            if (rect.width >= 10 && rect.width <= 30) {
              d.click();
              toggled++;
              if (toggled >= 3) break;
            }
          }
        }
        return toggled;
      });
      console.log('Cells toggled:', toggleResult);
    }

    await page.screenshot({ path: 'qa-drum-final2.png' });

    const pass = drumCreated && drumGrid.instruments.length >= 5 && drumGrid.cellCount > 0;
    console.log('TEST 4 RESULT:', pass ? 'PASS' : `FAIL - created:${drumCreated}, instruments:${drumGrid.instruments.length}, cells:${drumGrid.cellCount}`);
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
    if (consoleErrors.length > 0) console.log('Errors:', consoleErrors.slice(0,3).join('\n'));

  } catch (e) {
    console.log('Error:', e.message.substring(0, 300));
  }

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
