import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1200 } });
  const page = await context.newPage();

  let consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  console.log('\n=== TEST 4: Drum Machine (coordinate clicks) ===');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Studio")').click();
    await page.waitForTimeout(3000);

    // Add drum track
    await page.locator('button:has-text("Add Track")').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Drum Machine")').click();
    await page.waitForTimeout(2000);

    // Find the drum track row position and click it using page.click at coordinates
    const trackPos = await page.evaluate(() => {
      const allDivs = document.querySelectorAll('div');
      for (const d of allDivs) {
        const style = window.getComputedStyle(d);
        if (style.cursor === 'pointer' && style.borderLeftStyle === 'solid') {
          const text = d.textContent;
          if (text && text.includes('Drums')) {
            const rect = d.getBoundingClientRect();
            return { x: Math.round(rect.left + 50), y: Math.round(rect.top + rect.height / 2), text: text.substring(0, 40) };
          }
        }
      }
      return null;
    });
    console.log('Track position:', JSON.stringify(trackPos));

    if (trackPos) {
      await page.mouse.click(trackPos.x, trackPos.y);
      await page.waitForTimeout(500);
      console.log('Clicked track at coordinates');

      // Now find and click the Fx button (text is "Fx" not "FX")
      const fxPos = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          if (btn.textContent?.trim() === 'Fx' && btn.title === 'Effects') {
            const rect = btn.getBoundingClientRect();
            return { x: Math.round(rect.left + rect.width/2), y: Math.round(rect.top + rect.height/2) };
          }
        }
        return null;
      });
      console.log('Fx button position:', JSON.stringify(fxPos));

      if (fxPos) {
        await page.mouse.click(fxPos.x, fxPos.y);
        await page.waitForTimeout(500);
        console.log('Clicked Fx button');
      }

      // Click Editor tab (bottom panel)
      const editorPos = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        let target = null, maxTop = 0;
        for (const btn of btns) {
          if (btn.textContent?.trim() === 'Editor') {
            const rect = btn.getBoundingClientRect();
            if (rect.top > maxTop) { maxTop = rect.top; target = rect; }
          }
        }
        return target ? { x: Math.round(target.left + target.width/2), y: Math.round(target.top + target.height/2) } : null;
      });
      console.log('Editor tab position:', JSON.stringify(editorPos));

      if (editorPos) {
        await page.mouse.click(editorPos.x, editorPos.y);
        await page.waitForTimeout(1000);
        console.log('Clicked Editor tab');
      }

      // Check for drum grid content
      const drumGrid = await page.evaluate(() => {
        const text = document.body.textContent;
        const instruments = ['Kick', 'Snare', 'HH', 'Tom H', 'Tom L', 'Clap', 'Rim', 'Crash'];
        const found = instruments.filter(i => text.includes(i));

        // Count styled cells
        const allDivs = document.querySelectorAll('div');
        let cellCount = 0;
        let cellCoords = [];
        for (const d of allDivs) {
          const bg = d.style?.background || d.style?.backgroundColor || '';
          if ((bg.includes('141414') || bg.includes('181818') || bg.includes('f59e0b'))) {
            const rect = d.getBoundingClientRect();
            if (rect.width >= 8 && rect.width <= 35 && rect.height >= 8 && rect.height <= 35) {
              cellCount++;
              if (cellCoords.length < 5) {
                cellCoords.push({ x: Math.round(rect.left + rect.width/2), y: Math.round(rect.top + rect.height/2), bg: bg.substring(0, 20) });
              }
            }
          }
        }

        return { instruments: found, cellCount, cellCoords, hasPlay: text.includes('▶'), hasClear: text.includes('Clear') };
      });
      console.log('Drum grid:', JSON.stringify(drumGrid, null, 2));

      // Toggle cells
      if (drumGrid.cellCoords.length > 0) {
        for (const coord of drumGrid.cellCoords.slice(0, 3)) {
          await page.mouse.click(coord.x, coord.y);
          await page.waitForTimeout(100);
        }
        console.log('Toggled', Math.min(3, drumGrid.cellCoords.length), 'cells');
      }

      await page.screenshot({ path: 'qa-drum-final3.png' });

      const pass = drumGrid.instruments.length >= 5 && drumGrid.cellCount > 0;
      console.log('TEST 4 RESULT:', pass ? 'PASS' : `instruments:${drumGrid.instruments.length}, cells:${drumGrid.cellCount}`);
    }

    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
    if (consoleErrors.length > 0) console.log('Errors:', consoleErrors.slice(0,3).join('\n'));

  } catch (e) {
    console.log('Error:', e.message.substring(0, 300));
  }

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
