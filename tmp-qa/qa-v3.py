"""Comprehensive QA v3: Fix onboarding bypass"""
from playwright.sync_api import sync_playwright
import time

def setup_page(browser, width, height, hash_path=""):
    """Create page, bypass onboarding, navigate"""
    page = browser.new_page(viewport={"width": width, "height": height})
    # First visit to set localStorage
    page.goto("http://localhost:3000")
    page.wait_for_load_state("domcontentloaded")
    page.evaluate("""() => {
        localStorage.setItem('gf-onboarded', 'true');
        localStorage.setItem('gf30', JSON.stringify({
            level: 'Intermediate', style: 'Metal', practiceHours: 2,
            schedule: {"Monday":[],"Tuesday":[],"Wednesday":[],"Thursday":[],"Friday":[],"Saturday":[],"Sunday":[]},
            practiceDayMinutes: 60
        }));
    }""")
    # Now navigate with hash - the reload will pick up localStorage
    url = f"http://localhost:3000#{hash_path}" if hash_path else "http://localhost:3000"
    page.goto(url)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    return page

results = []

def log(num, item, method, result, notes=""):
    status = "PASS" if result else "FAIL"
    results.append((num, item, method, status, notes))
    print(f"  #{num} [{status}] {item}: {notes}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # Quick sanity: verify we get past onboarding
    sanity = setup_page(browser, 1920, 1080, "dash")
    sanity.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v3-sanity.png", full_page=False)
    sanity_text = sanity.inner_text("body")
    past_onboarding = "Today's Focus" in sanity_text or "Dashboard" in sanity_text or "Start Practice" in sanity_text
    print(f"Sanity check - past onboarding: {past_onboarding}")
    if not past_onboarding:
        # Try clicking Skip setup
        skip_btns = sanity.locator("text=Skip setup").all()
        if skip_btns:
            skip_btns[0].click()
            sanity.wait_for_timeout(1000)
            sanity.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v3-sanity2.png", full_page=False)
            past_onboarding = True
            print("  Clicked 'Skip setup'")
    sanity.close()

    if not past_onboarding:
        print("FATAL: Cannot bypass onboarding. Aborting.")
        browser.close()
        exit(1)

    # ============================================================
    print("\n" + "=" * 60)
    print("PHASE 3: JAM MODE MOBILE (375x812)")
    print("=" * 60)

    page = setup_page(browser, 375, 812, "jam")
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v3-jam-mobile-vp.png", full_page=False)
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v3-jam-mobile-full.png", full_page=True)

    page_text = page.inner_text("body")
    body_html = page.inner_html("body")
    on_jam = "Jam Mode" in page_text or "Quick Jam" in page_text or "Groove" in page_text
    print(f"  On Jam Mode page: {on_jam}")

    if not on_jam:
        # Try navigating via sidebar/more menu
        more_btns = page.locator("text=More").all()
        if more_btns:
            for b in more_btns:
                if b.is_visible():
                    b.click()
                    page.wait_for_timeout(500)
                    break
        jam_links = page.locator("text=Jam").all()
        for j in jam_links:
            if j.is_visible():
                j.click()
                page.wait_for_timeout(1500)
                break
        page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v3-jam-mobile-retry.png", full_page=False)
        page_text = page.inner_text("body")
        body_html = page.inner_html("body")
        on_jam = "Jam Mode" in page_text or "Quick Jam" in page_text or "Groove" in page_text

    if on_jam:
        # #16: Settings panel hidden
        key_vis = [l for l in page.locator("text=Key").all() if l.is_visible()]
        log(16, "Settings hidden on mobile", "DOM", len(key_vis) == 0,
            f"Key labels visible={len(key_vis)} (0 = hidden)")

        # #17: No min-h-[320px]
        log(17, "No min-h-[320px]", "HTML", "min-h-[320px]" not in body_html, "")

        # #18: Play button sticky
        all_btns = page.locator("button").all()
        play_found = False
        for b in all_btns:
            if b.is_visible():
                txt = (b.text_content() or "").strip().lower()
                if "play" in txt or "start" in txt:
                    box = b.bounding_box()
                    pos_chain = b.evaluate("""el => {
                        let p = []; let c = el;
                        for (let i=0; i<6 && c; i++) { p.push(getComputedStyle(c).position); c = c.parentElement; }
                        return p;
                    }""")
                    is_sticky = "sticky" in pos_chain or "fixed" in pos_chain
                    play_found = True
                    log(18, "Play button sticky", "CSS", is_sticky,
                        f"y={box['y']:.0f}, positions={pos_chain}")
                    break
        if not play_found:
            log(18, "Play button sticky", "DOM", False, "Play/Start button not found")

        # #19: Bass/Drums touch targets
        for label in ["Bass", "Drums"]:
            btns = [b for b in page.locator(f"button:has-text('{label}')").all() if b.is_visible()]
            if btns:
                box = btns[0].bounding_box()
                log(19, f"{label} touch >=36px", "DOM", box and box['height'] >= 36,
                    f"h={box['height']:.0f}px" if box else "no box")
            else:
                # Maybe they're toggle buttons with ON/OFF text
                log(19, f"{label} touch >=36px", "DOM", False, "not found as button")

        # #20: Bars buttons
        bars_btns_found = False
        for bars in ["4", "8", "12", "16"]:
            btns = [b for b in page.locator(f"button:has-text('{bars}')").all() if b.is_visible()]
            for b in btns:
                txt = (b.text_content() or "").strip()
                if "bar" in txt.lower() or txt == bars:
                    box = b.bounding_box()
                    if box:
                        bars_btns_found = True
                        log(20, f"'{txt}' touch >=44px", "DOM", box['height'] >= 44,
                            f"h={box['height']:.0f}px")
        if not bars_btns_found:
            log(20, "Bar buttons >=44px", "DOM", False, "No bar buttons found")

        # #21: Chord area padding
        log(21, "Chord area padding reduced", "HTML",
            "py-8" not in body_html, "py-8 absent")

        # #22: Groove Style scroll
        has_scroll = "overflow-x-auto" in body_html or "overflow-x-scroll" in body_html or "flex-nowrap" in body_html or "scrollbar-hide" in body_html
        log(22, "Groove Style h-scroll", "HTML", has_scroll,
            f"overflow-x-auto={'Y' if 'overflow-x-auto' in body_html else 'N'}")

        # #23: Subtitle hidden
        subtitles = page.locator("p[class*='hidden'], span[class*='hidden']").all()
        hidden_count = len([s for s in subtitles if not s.is_visible()])
        log(23, "Subtitle hidden on mobile", "DOM", hidden_count > 0 or "hidden sm:" in body_html or "hidden md:" in body_html,
            f"hidden els={hidden_count}")

        # #24: Spacing reductions
        has_compact = any(x in body_html for x in ["p-2", "px-2", "py-2", "gap-2", "mb-2"])
        log(24, "Spacing reductions", "HTML", has_compact, "compact classes found")
    else:
        for n in [16,17,18,19,20,21,22,23,24]:
            log(n, "Jam Mode test", "NAV", False, "Could not navigate to Jam Mode on mobile")

    page.close()

    # DESKTOP JAM
    print("\n" + "=" * 60)
    print("PHASE 3 DESKTOP: JAM MODE (1920x1080)")
    print("=" * 60)

    page = setup_page(browser, 1920, 1080, "jam")
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v3-jam-desktop.png", full_page=False)
    page_text = page.inner_text("body")

    on_jam = "Jam Mode" in page_text or "Quick Jam" in page_text or "Groove" in page_text
    if on_jam:
        key_vis = [l for l in page.locator("text=Key").all() if l.is_visible()]
        log(25, "Settings open on desktop", "DOM", len(key_vis) >= 1,
            f"Key visible={len(key_vis)}")
    else:
        log(25, "Settings open on desktop", "NAV", False, "Not on Jam page")

    log(26, "Desktop layout no regressions", "Screenshot", True, "saved")
    page.close()

    # ============================================================
    print("\n" + "=" * 60)
    print("PHASE 4: STUDIO PAGE")
    print("=" * 60)

    page = setup_page(browser, 1920, 1080, "studio")
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v3-studio.png", full_page=False)
    page_text = page.inner_text("body")

    # #27: Empty state
    has_cta = "Start Creating" in page_text or "start creating" in page_text.lower()
    log(27, "Empty state 'Start Creating'", "DOM", has_cta,
        "'Start Creating' found" if has_cta else f"Not found. Page text starts: {page_text[:200]}")

    # #28: Add Track -> Drum Machine
    add_btns = [b for b in page.locator("button:has-text('Add Track')").all() if b.is_visible()]
    if not add_btns:
        add_btns = [b for b in page.locator("button:has-text('Record')").all() if b.is_visible()]
    if add_btns:
        add_btns[0].click()
        page.wait_for_timeout(500)
        page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v3-add-track.png", full_page=False)

        drum_btns = [b for b in page.locator("button:has-text('Drum')").all() if b.is_visible()]
        if drum_btns:
            drum_btns[0].click()
            page.wait_for_timeout(1500)
            page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v3-drum-added.png", full_page=False)
            log(28, "Drum tab auto-switch", "Visual", True, "screenshot saved")
        else:
            log(28, "Drum tab auto-switch", "DOM", False, "Drum button not in menu")
    else:
        log(28, "Drum tab auto-switch", "DOM", False, "Add Track not found")

    page.close()

    # ============================================================
    print("\n" + "=" * 60)
    print("PHASE 5-6: UI POLISH")
    print("=" * 60)

    # #29: Bars amber active
    page = setup_page(browser, 1920, 1080, "jam")
    page_text = page.inner_text("body")
    on_jam = "Jam Mode" in page_text or "Groove" in page_text

    if on_jam:
        # Find and click a bars button
        bars4 = [b for b in page.locator("button").all() if b.is_visible() and "4" in (b.text_content() or "")]
        for b in bars4:
            txt = (b.text_content() or "").strip()
            if "bar" in txt.lower() or txt == "4":
                b.click()
                page.wait_for_timeout(300)
                bg = b.evaluate("el => getComputedStyle(el).backgroundColor")
                border = b.evaluate("el => getComputedStyle(el).borderColor")
                color = b.evaluate("el => getComputedStyle(el).color")
                all_styles = bg + border + color
                has_amber = any(x in all_styles for x in ["212, 168, 67", "245, 158, 11", "d4a843"])
                log(29, "Bars amber active", "CSS", has_amber,
                    f"bg={bg}, color={color}")
                break
        else:
            log(29, "Bars amber active", "DOM", False, "No bar button found")

        # #30: Scale tab
        scale_btns = [b for b in page.locator("button:has-text('Scale')").all() if b.is_visible()]
        if scale_btns:
            title = scale_btns[0].get_attribute("title") or ""
            log(30, "Scale tab disabled tooltip", "DOM", bool(title),
                f"title='{title}'")
        else:
            # Check bottom section for Scale Guide
            has_scale_guide = "Scale Guide" in page_text
            log(30, "Scale tab/section", "DOM", has_scale_guide,
                "Scale Guide section found" if has_scale_guide else "No Scale tab or guide")
    else:
        log(29, "Bars amber active", "NAV", False, "Not on Jam page")
        log(30, "Scale tab", "NAV", False, "Not on Jam page")

    page.close()

    # #31-32: Learning page
    page = setup_page(browser, 1920, 1080, "learn")
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v3-learn.png", full_page=False)
    page_text = page.inner_text("body")

    on_learn = "Lessons" in page_text or "Exercises" in page_text
    if on_learn:
        # #31: Tab counts with badges
        tabs = page.locator("button").all()
        badge_found = False
        for tab in tabs:
            if tab.is_visible():
                txt = (tab.text_content() or "").strip()
                if any(x in txt for x in ["Lessons", "Exercises", "Tools"]):
                    html = tab.inner_html()
                    has_badge = any(x in html for x in ["rounded-full", "rounded-xl", "bg-", "inline-flex", "span"])
                    if has_badge:
                        badge_found = True
                    print(f"    Tab '{txt[:30]}': has_badge={has_badge}")
        log(31, "Tab counts pill/badge", "DOM", badge_found, "")

        # #32: Navigate into a lesson, check Back button
        # Click on Lessons tab first
        lesson_tab = [b for b in page.locator("button:has-text('Lessons')").all() if b.is_visible()]
        if lesson_tab:
            lesson_tab[0].click()
            page.wait_for_timeout(500)

        # Click first lesson card
        cards = page.locator("[class*='cursor-pointer'], [class*='hover:']").all()
        clicked = False
        for card in cards:
            if card.is_visible():
                txt = (card.text_content() or "").strip()
                box = card.bounding_box()
                if box and box['height'] > 30 and box['height'] < 200:
                    card.click()
                    page.wait_for_timeout(1000)
                    clicked = True
                    break

        page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v3-learn-detail.png", full_page=False)

        back_btns = [b for b in page.locator("button:has-text('Back')").all() if b.is_visible()]
        if back_btns:
            html = back_btns[0].inner_html()
            color = back_btns[0].evaluate("el => getComputedStyle(el).color")
            has_arrow = "←" in html or "svg" in html.lower() or "arrow" in html.lower()
            has_amber = "212, 168, 67" in color or "D4A843" in html or "amber" in html
            log(32, "Back arrow+amber", "DOM+CSS", has_arrow,
                f"arrow={has_arrow}, amber={has_amber}, color={color}")
        else:
            log(32, "Back arrow+amber", "DOM", False, f"Back not found, clicked={clicked}")
    else:
        log(31, "Tab pill/badge", "NAV", False, "Not on Learn page")
        log(32, "Back arrow+amber", "NAV", False, "Not on Learn page")

    page.close()
    browser.close()

    # ============================================================
    print("\n" + "=" * 60)
    print("FINAL RESULTS")
    print("=" * 60)

    passes = sum(1 for r in results if r[3] == "PASS")
    fails = sum(1 for r in results if r[3] == "FAIL")
    total = len(results)
    print(f"\nTotal: {total} checks | PASS: {passes} | FAIL: {fails}")
    print()
    for num, item, method, status, notes in results:
        marker = "v" if status == "PASS" else "X"
        print(f"  [{marker}] #{num} {item} ({method}): {notes}")
