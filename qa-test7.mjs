import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  let consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  // ========== DEBUG: Practice page HTML ==========
  console.log('\n=== DEBUG: Practice Page HTML ===');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.locator('button:has-text("Practice")').click();
  await page.waitForTimeout(2000);

  // Get the scrollable container and its rendered HTML
  const htmlDebug = await page.evaluate(() => {
    // Find "Chromatic" text and get its DOM context
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let chromNode = null;
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.includes('Chromatic 1-2-3-4')) {
        chromNode = walker.currentNode;
        break;
      }
    }
    if (!chromNode) return { found: false };

    // Walk up the tree and collect class/style info
    let el = chromNode.parentElement;
    const chain = [];
    while (el && el !== document.body) {
      const rect = el.getBoundingClientRect();
      chain.push({
        tag: el.tagName,
        class: (el.className || '').toString().substring(0, 120),
        rect: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) },
        overflow: window.getComputedStyle(el).overflow,
        cursor: window.getComputedStyle(el).cursor,
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility
      });
      el = el.parentElement;
    }
    return { found: true, chain: chain.slice(0, 10) };
  });
  console.log('Exercise DOM chain:', JSON.stringify(htmlDebug, null, 2));

  // Check if the exercise text is in a scrollable container that needs scrolling
  const scrollResult = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.includes('Chromatic 1-2-3-4')) {
        let el = walker.currentNode.parentElement;
        while (el && el !== document.body) {
          const style = window.getComputedStyle(el);
          if (style.overflow === 'auto' || style.overflow === 'scroll' ||
              style.overflowY === 'auto' || style.overflowY === 'scroll') {
            // Scroll this element into view
            el.scrollTop = 0;
            return {
              scrollContainer: true,
              scrollTop: el.scrollTop,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              class: el.className?.toString().substring(0, 100)
            };
          }
          el = el.parentElement;
        }
        // No scroll container found, try scrollIntoView
        walker.currentNode.parentElement.scrollIntoView({ block: 'center' });
        return { scrollContainer: false, scrolledIntoView: true };
      }
    }
    return { found: false };
  });
  console.log('Scroll info:', JSON.stringify(scrollResult));

  // Now try clicking the exercise text directly via dispatchEvent
  const clickResult = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.includes('Chromatic 1-2-3-4')) {
        let el = walker.currentNode.parentElement;
        // Walk up to find the element with cursor: pointer
        while (el && el !== document.body) {
          const style = window.getComputedStyle(el);
          if (style.cursor === 'pointer') {
            // Dispatch click event
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return { clicked: true, tag: el.tagName, class: el.className?.toString().substring(0, 80) };
          }
          el = el.parentElement;
        }
        return { clicked: false, reason: 'no cursor-pointer parent found' };
      }
    }
    return { found: false };
  });
  console.log('Click via dispatch:', JSON.stringify(clickResult));

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'qa-exercise-debug.png' });

  // Check if modal appeared
  const modalCheck = await page.evaluate(() => {
    // Check for fixed/absolute overlay (modal)
    const fixedEls = document.querySelectorAll('[class*="fixed"], [style*="fixed"]');
    let modalFound = false;
    for (const el of fixedEls) {
      if (el.clientWidth > 200 && el.clientHeight > 200) {
        modalFound = true;
      }
    }
    const hasBPM = document.body.textContent.includes('BPM');
    const svgs = document.querySelectorAll('svg circle');

    return { modalFound, hasBPM, svgCircles: svgs.length, fixedElements: fixedEls.length };
  });
  console.log('Modal check:', JSON.stringify(modalCheck));

  // ========== DEBUG: Studio drum track ==========
  console.log('\n=== DEBUG: Studio Drum Track ===');
  await page.locator('button:has-text("Studio")').click();
  await page.waitForTimeout(2000);

  // Add drum track
  await page.locator('button:has-text("Add Track")').click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Drum Machine")').click();
  await page.waitForTimeout(2000);

  // Debug: what tracks exist
  const tracksInfo = await page.evaluate(() => {
    const body = document.body.innerHTML;
    const hasDrums = body.includes('Drums');

    // Look for track-like rows
    const trackRows = [];
    const allEls = document.querySelectorAll('div');
    for (const el of allEls) {
      const text = el.textContent?.trim();
      if (text && (text.startsWith('Drums') || text.startsWith('Master')) && text.length < 20) {
        const rect = el.getBoundingClientRect();
        trackRows.push({ text, tag: el.tagName, rect: { top: Math.round(rect.top), width: Math.round(rect.width) }, class: el.className?.toString().substring(0, 60) });
      }
    }
    return { hasDrums, trackRows: trackRows.slice(0, 10) };
  });
  console.log('Tracks info:', JSON.stringify(tracksInfo, null, 2));

  // Try to select the track by clicking its name span
  const selectResult = await page.evaluate(() => {
    // The track selection uses setSelectedTrackId - find the click handler
    // Tracks are rendered in a list. Each track row has onClick to select it.
    // Look for the track container div that has onClick
    const allDivs = document.querySelectorAll('div');
    for (const d of allDivs) {
      const text = d.textContent?.trim();
      // Find the "Drums N" text node
      if (text && text.match(/^Drums \d+$/) && d.tagName === 'DIV') {
        // This is likely a span/div with the track name
        // The clickable track row should be a parent
        let parent = d.parentElement;
        for (let i = 0; i < 8; i++) {
          if (!parent) break;
          // Check if this element has React's __reactInternalInstance or __reactFiber
          const keys = Object.keys(parent);
          const reactKey = keys.find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
          if (reactKey) {
            // Try to find onClick in the fiber
            const fiber = parent[reactKey];
            if (fiber?.memoizedProps?.onClick) {
              parent.click();
              return { selected: true, level: i };
            }
          }
          parent = parent.parentElement;
        }
      }
    }
    return { selected: false };
  });
  console.log('Select track result:', JSON.stringify(selectResult));
  await page.waitForTimeout(500);

  // Check the bottom panel tabs
  const bottomTabs = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    const tabs = [];
    for (const btn of btns) {
      const text = btn.textContent?.trim();
      if (['Mixer', 'Effects', 'Editor', 'I/O', 'Library'].includes(text)) {
        const rect = btn.getBoundingClientRect();
        tabs.push({ text, visible: rect.width > 0, top: Math.round(rect.top), class: btn.className?.substring(0, 60) });
      }
    }
    return tabs;
  });
  console.log('Bottom tabs:', JSON.stringify(bottomTabs));

  // Click the Editor tab that's in the bottom panel (the one with lower top position = bottom of page)
  const editorClicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    let editorBtn = null;
    let maxTop = 0;
    for (const btn of btns) {
      if (btn.textContent?.trim() === 'Editor') {
        const rect = btn.getBoundingClientRect();
        if (rect.top > maxTop) {
          maxTop = rect.top;
          editorBtn = btn;
        }
      }
    }
    if (editorBtn) {
      editorBtn.click();
      return { clicked: true, top: maxTop };
    }
    return { clicked: false };
  });
  console.log('Editor click:', JSON.stringify(editorClicked));
  await page.waitForTimeout(1000);

  // Now check what the bottom panel shows
  const panelContent = await page.evaluate(() => {
    const text = document.body.textContent;
    const hasKick = text.includes('Kick');
    const hasSnare = text.includes('Snare');
    const hasPlay = text.includes('▶') || text.includes('⏹');
    const hasClear = text.includes('Clear');

    // Get the bottom 300px of the page content
    const allDivs = document.querySelectorAll('div');
    let bottomContent = '';
    for (const d of allDivs) {
      const rect = d.getBoundingClientRect();
      if (rect.top > 600 && d.textContent.length > 10 && d.textContent.length < 500) {
        bottomContent += d.textContent + ' | ';
      }
    }

    return { hasKick, hasSnare, hasPlay, hasClear, bottomContent: bottomContent.substring(0, 500) };
  });
  console.log('Panel content:', JSON.stringify(panelContent, null, 2));

  await page.screenshot({ path: 'qa-studio-debug.png' });

  console.log('Console errors:', consoleErrors.filter(e => !e.includes('favicon')).length);
  if (consoleErrors.length > 0) console.log('Errors:', consoleErrors.slice(0, 5).join('\n'));

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
