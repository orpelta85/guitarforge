import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  let consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  // ========== TEST 1: Navigation - Verify More works after page switch ==========
  console.log('\n=== TEST 1: Full Navigation Flow ===');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify 5 nav items
    const navTexts = await page.locator('nav').last().locator('button').allTextContents();
    const has5 = ['Dashboard', 'Practice', 'Library', 'Studio', 'More...'].every(n => navTexts.some(t => t.includes(n)));
    console.log('5 nav items present:', has5);

    // Test More dropdown
    await page.locator('button:has-text("More...")').click();
    await page.waitForTimeout(500);
    const bodyText = await page.locator('body').textContent();
    const hasDropdownItems = ['Learning', 'Coach', 'Report', 'Profile'].every(i => bodyText.includes(i));
    console.log('Dropdown items present:', hasDropdownItems);

    // Click Learning
    await page.locator('button:has-text("Learning")').click();
    await page.waitForTimeout(1500);
    const learningLoaded = (await page.locator('body').textContent()).includes('שיעורים');
    console.log('Learning loaded:', learningLoaded);

    // Go back to Dashboard, then More -> Profile
    await page.locator('button:has-text("Dashboard")').click();
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("More...")').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Profile")').click();
    await page.waitForTimeout(1000);
    const profileLoaded = (await page.locator('body').textContent()).includes('Profile') || (await page.locator('body').textContent()).includes('פרופיל');
    console.log('Profile loaded:', profileLoaded);

    console.log('RESULT:', (has5 && hasDropdownItems && learningLoaded && profileLoaded) ? 'PASS' : 'FAIL');
  } catch (e) {
    console.log('Error:', e.message.substring(0, 200));
    console.log('RESULT: FAIL');
  }

  // ========== TEST 7: MetronomeBox - need to AutoFill first ==========
  console.log('\n=== TEST 7: MetronomeBox - Rotary Knob ===');
  consoleErrors = [];
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.locator('button:has-text("Practice")').click();
    await page.waitForTimeout(2000);

    // Check if exercises exist on current day
    const practiceText = await page.locator('body').textContent();
    const hasExercises = practiceText.includes('Chromatic') || practiceText.includes('Spider') || practiceText.includes('Alternate');
    console.log('Exercises present on day:', hasExercises);

    if (!hasExercises) {
      // Need to AutoFill
      const autoFillBtn = page.locator('button:has-text("Auto Fill")');
      if (await autoFillBtn.count() > 0) {
        await autoFillBtn.click();
        await page.waitForTimeout(2000);
        console.log('Clicked Auto Fill');
        const afterFill = await page.locator('body').textContent();
        console.log('Exercises after fill:', afterFill.includes('Chromatic') || afterFill.includes('min'));
      }
    }

    // Now try to click an exercise (the flex-1 cursor-pointer div)
    const clicked = await page.evaluate(() => {
      const divs = document.querySelectorAll('div.flex-1.cursor-pointer');
      if (divs.length > 0) {
        divs[0].click();
        return { success: true, text: divs[0].textContent.substring(0, 80), count: divs.length };
      }
      return { success: false, count: 0 };
    });
    console.log('Click exercise result:', JSON.stringify(clicked));

    if (clicked.success) {
      await page.waitForTimeout(2000);

      // Check for modal with metronome
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
        return { rotaryFound, circleCount, hasBPM };
      });
      console.log('Knob info:', JSON.stringify(knobInfo));

      await page.screenshot({ path: 'qa-metronome-final.png' });
      console.log('RESULT:', knobInfo.rotaryFound ? 'PASS' : 'FAIL');
    } else {
      // Even after auto fill, no exercises. Try selecting a different day
      console.log('Trying different days...');
      const days = ['שני', 'שלישי', 'רביעי', 'חמישי'];
      for (const day of days) {
        await page.locator(`button:has-text("${day}")`).first().click();
        await page.waitForTimeout(500);
        const result = await page.evaluate(() => {
          const divs = document.querySelectorAll('div.flex-1.cursor-pointer');
          return divs.length;
        });
        console.log(`Day ${day}: ${result} exercises`);
        if (result > 0) {
          await page.evaluate(() => {
            const divs = document.querySelectorAll('div.flex-1.cursor-pointer');
            divs[0].click();
          });
          await page.waitForTimeout(2000);

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
            return { rotaryFound, circleCount, hasBPM: document.body.textContent.includes('BPM') };
          });
          console.log('Knob info:', JSON.stringify(knobInfo));
          await page.screenshot({ path: 'qa-metronome-final.png' });
          console.log('RESULT:', knobInfo.rotaryFound ? 'PASS' : 'FAIL');
          break;
        }
      }
    }
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
    if (consoleErrors.length > 0) console.log('  Errors:', consoleErrors.slice(0, 3).join('\n  '));
  } catch (e) {
    console.log('Error:', e.message.substring(0, 200));
  }

  // ========== TEST 4: Drum grid - select track properly ==========
  console.log('\n=== TEST 4 DEEP: Drum Grid Selection ===');
  consoleErrors = [];
  try {
    await page.locator('button:has-text("Studio")').click();
    await page.waitForTimeout(2000);

    // Add drum track fresh
    await page.locator('button:has-text("Add Track")').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Drum Machine")').click();
    await page.waitForTimeout(2000);

    // The track should appear. We need to click on it to select it.
    // Look for the track row containing "Drums"
    const trackSelected = await page.evaluate(() => {
      // Find all elements containing "Drums" and try clicking the track row
      const allEls = document.querySelectorAll('div, span, button');
      for (const el of allEls) {
        if (el.textContent && el.textContent.trim() === 'Drums 2' || el.textContent.trim() === 'Drums 1') {
          // Find the closest parent that looks like a track row
          let parent = el.closest('[class*="track"]') || el.parentElement;
          if (parent) {
            parent.click();
            return { clicked: true, text: el.textContent.trim() };
          }
        }
      }
      return { clicked: false };
    });
    console.log('Track selection:', JSON.stringify(trackSelected));
    await page.waitForTimeout(500);

    // Click Editor tab
    await page.locator('button:has-text("Editor")').click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'qa-drum-editor-final.png' });

    // Now check what's rendered in the editor panel
    const editorContent = await page.evaluate(() => {
      // Get the bottom panel content
      const panels = document.querySelectorAll('div');
      let editorHTML = '';
      for (const p of panels) {
        const text = p.textContent || '';
        if (text.includes('Kick') || text.includes('Snare') || text.includes('HH')) {
          editorHTML = p.innerHTML.substring(0, 3000);
          break;
        }
      }

      // Check for drum-related elements
      const hasKick = document.body.innerHTML.includes('Kick');
      const hasSnare = document.body.innerHTML.includes('Snare');
      const hasHH = document.body.innerHTML.includes('HH');

      // Count cells
      const smallDivs = document.querySelectorAll('div[style]');
      let cellCount = 0;
      for (const d of smallDivs) {
        const s = d.getAttribute('style') || '';
        if ((s.includes('#141414') || s.includes('#181818')) && d.clientWidth >= 10 && d.clientWidth <= 30) {
          cellCount++;
        }
      }

      return { hasKick, hasSnare, hasHH, cellCount, editorPresent: editorHTML.length > 0 };
    });
    console.log('Editor content:', JSON.stringify(editorContent));

    // The selected track might need to be the fxTrack
    // Try clicking FX button on the drum track
    const fxClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.trim() === 'FX' || btn.textContent.trim() === 'fx') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    console.log('FX button clicked:', fxClicked);
    await page.waitForTimeout(500);

    // Try Editor again
    await page.locator('button:has-text("Editor")').click();
    await page.waitForTimeout(1000);

    const editorContent2 = await page.evaluate(() => {
      const hasKick = document.body.textContent.includes('Kick');
      const hasSnare = document.body.textContent.includes('Snare');
      return { hasKick, hasSnare };
    });
    console.log('After FX select - Editor:', JSON.stringify(editorContent2));

    await page.screenshot({ path: 'qa-drum-grid-final.png' });

    console.log('RESULT:', editorContent2.hasKick ? 'PASS' : 'NEEDS FX TRACK SELECTION');
    console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
  } catch (e) {
    console.log('Error:', e.message.substring(0, 200));
  }

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
