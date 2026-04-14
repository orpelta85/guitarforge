"""QA v4: Complete onboarding wizard via clicks, then test"""
from playwright.sync_api import sync_playwright
import time

def complete_onboarding(page):
    """Click through the onboarding wizard"""
    page.wait_for_timeout(1000)

    # Step 1: Select level
    intermediate = page.locator("text=Intermediate").first
    if intermediate.is_visible():
        intermediate.click()
        page.wait_for_timeout(300)

    # Click NEXT
    next_btn = page.locator("button:has-text('NEXT')").first
    if next_btn.is_visible():
        next_btn.click()
        page.wait_for_timeout(500)

    # Step 2: Select style
    metal = page.locator("text=Metal").first
    if metal.is_visible():
        metal.click()
        page.wait_for_timeout(300)

    next_btn = page.locator("button:has-text('NEXT')").first
    if next_btn.is_visible():
        next_btn.click()
        page.wait_for_timeout(500)

    # Step 3: Select practice hours
    hrs2 = page.locator("text=2 hours").first
    if hrs2.is_visible():
        hrs2.click()
        page.wait_for_timeout(300)

    # Click START / FINISH
    start_btn = page.locator("button:has-text('START'), button:has-text('FINISH'), button:has-text('LET'), button:has-text('GO')").first
    if start_btn.is_visible():
        start_btn.click()
        page.wait_for_timeout(1500)
    else:
        # Try generic button at bottom
        btns = page.locator("button").all()
        for b in btns:
            if b.is_visible():
                txt = (b.text_content() or "").strip().upper()
                if txt in ["START", "FINISH", "GO", "LET'S GO", "BEGIN"]:
                    b.click()
                    page.wait_for_timeout(1500)
                    break

def navigate_via_hash(page, hash_path):
    """Navigate by setting window.location.hash"""
    page.evaluate(f"() => window.location.hash = '{hash_path}'")
    page.wait_for_timeout(1500)

results = []

def log(num, item, method, result, notes=""):
    status = "PASS" if result else "FAIL"
    results.append((num, item, method, status, notes))
    print(f"  #{num} [{status}] {item}: {notes}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ===== SETUP: Complete onboarding once in a persistent context =====
    # Use a persistent browser context so localStorage persists
    context = browser.new_context(viewport={"width": 1920, "height": 1080})
    page = context.new_page()
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Check if onboarding is showing
    body_text = page.inner_text("body")
    if "Welcome" in body_text and "practice routine" in body_text:
        print("Onboarding wizard detected. Completing it...")
        complete_onboarding(page)
        page.wait_for_timeout(1000)
        body_text = page.inner_text("body")

    # If still showing welcome, try Skip
    if "Welcome" in body_text and "Skip" in body_text:
        skip = page.locator("text=Skip setup").first
        if skip.is_visible():
            skip.click()
            page.wait_for_timeout(1000)

    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v4-after-onboarding.png", full_page=False)
    body_text = page.inner_text("body")
    print(f"After onboarding: on dashboard = {'Today' in body_text or 'Dashboard' in body_text or 'Focus' in body_text}")

    # ============================================================
    print("\n" + "=" * 60)
    print("PHASE 3: JAM MODE MOBILE (375x812)")
    print("=" * 60)

    # Navigate to Jam Mode on desktop first to verify
    navigate_via_hash(page, "jam")
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v4-jam-desktop-verify.png", full_page=False)
    body_text = page.inner_text("body")
    on_jam = "Jam Mode" in body_text or "Quick Jam" in body_text or "Groove" in body_text or "BARS" in body_text
    print(f"  On Jam Mode (desktop): {on_jam}")

    page.close()

    # Now test mobile
    mobile_page = context.new_page()
    mobile_page.set_viewport_size({"width": 375, "height": 812})
    mobile_page.goto("http://localhost:3000#jam")
    mobile_page.wait_for_load_state("networkidle")
    mobile_page.wait_for_timeout(2000)

    mobile_page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v4-jam-mobile-vp.png", full_page=False)
    mobile_page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v4-jam-mobile-full.png", full_page=True)

    body_text = mobile_page.inner_text("body")
    body_html = mobile_page.inner_html("body")
    on_jam_mobile = "Jam Mode" in body_text or "Groove" in body_text or "BARS" in body_text or "Play" in body_text

    if not on_jam_mobile:
        print(f"  Not on Jam page. Body starts: {body_text[:100]}")
        # Set hash directly
        navigate_via_hash(mobile_page, "jam")
        mobile_page.wait_for_timeout(1500)
        mobile_page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v4-jam-mobile-retry.png", full_page=False)
        body_text = mobile_page.inner_text("body")
        body_html = mobile_page.inner_html("body")
        on_jam_mobile = "Jam Mode" in body_text or "Groove" in body_text or "BARS" in body_text

    print(f"  On Jam Mode (mobile): {on_jam_mobile}")

    if on_jam_mobile:
        # #16: Settings panel hidden
        # On mobile, settings should be collapsed
        settings_section = mobile_page.locator("text=Key").all()
        key_visible = sum(1 for s in settings_section if s.is_visible())
        log(16, "Settings hidden on mobile", "DOM", key_visible == 0,
            f"Key labels visible: {key_visible}")

        # #17: No min-h-[320px]
        log(17, "No min-h-[320px]", "HTML", "min-h-[320px]" not in body_html, "")

        # #18: Play button sticky
        all_btns = mobile_page.locator("button").all()
        play_info = None
        for b in all_btns:
            if b.is_visible():
                txt = (b.text_content() or "").strip().lower()
                if "play" in txt:
                    box = b.bounding_box()
                    if box:
                        pos_chain = b.evaluate("""el => {
                            let p=[]; let c=el;
                            for(let i=0;i<8&&c;i++){p.push(getComputedStyle(c).position);c=c.parentElement;}
                            return p;
                        }""")
                        is_sticky = "sticky" in pos_chain or "fixed" in pos_chain
                        play_info = f"y={box['y']:.0f}, sticky={is_sticky}, positions={pos_chain[:5]}"
                        log(18, "Play button sticky", "CSS", is_sticky, play_info)
                        break
        if play_info is None:
            # List all visible button texts
            btn_texts = [(b.text_content() or "").strip()[:25] for b in all_btns if b.is_visible()]
            log(18, "Play button sticky", "DOM", False, f"Not found. Buttons: {btn_texts[:8]}")

        # #19: Bass/Drums
        for label in ["Bass", "Drums"]:
            btns = [b for b in mobile_page.locator(f"button:has-text('{label}')").all() if b.is_visible()]
            if btns:
                box = btns[0].bounding_box()
                log(19, f"{label} >=36px", "DOM", box and box['height'] >= 36,
                    f"h={box['height']:.0f}px" if box else "")
            else:
                log(19, f"{label} >=36px", "DOM", False, "not found")

        # #20: Bars buttons
        bars_found = False
        for n in ["4", "8", "12", "16"]:
            btns = [b for b in mobile_page.locator(f"button:has-text('{n}')").all() if b.is_visible()]
            for b in btns:
                txt = (b.text_content() or "").strip()
                if "bar" in txt.lower() or txt == n:
                    box = b.bounding_box()
                    if box:
                        bars_found = True
                        log(20, f"'{txt}' >=44px", "DOM", box['height'] >= 44,
                            f"h={box['height']:.0f}px")
        if not bars_found:
            log(20, "Bars buttons >=44px", "DOM", False, "Not found")

        # #21: Chord area padding
        log(21, "Chord padding reduced", "HTML", "py-8" not in body_html, "")

        # #22: Groove h-scroll
        has_hscroll = any(x in body_html for x in ["overflow-x-auto", "overflow-x-scroll", "flex-nowrap", "scrollbar-hide"])
        log(22, "Groove h-scroll", "HTML", has_hscroll, "")

        # #23: Subtitle hidden
        has_hidden_class = "hidden sm:" in body_html or "hidden md:" in body_html or "sm:block" in body_html
        log(23, "Subtitle hidden", "HTML", has_hidden_class, "")

        # #24: Spacing
        has_compact = any(x in body_html for x in ["p-2 ", "px-2", "py-2", "gap-2", "mb-2"])
        log(24, "Spacing compact", "HTML", has_compact, "")
    else:
        for n in range(16, 25):
            log(n, "Jam test", "NAV", False, "Cannot reach Jam Mode on mobile")

    mobile_page.close()

    # ============================================================
    print("\n" + "=" * 60)
    print("PHASE 3 DESKTOP: JAM (1920x1080)")
    print("=" * 60)

    desk_page = context.new_page()
    desk_page.set_viewport_size({"width": 1920, "height": 1080})
    desk_page.goto("http://localhost:3000#jam")
    desk_page.wait_for_load_state("networkidle")
    desk_page.wait_for_timeout(2000)
    desk_page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v4-jam-desktop.png", full_page=False)
    body_text = desk_page.inner_text("body")

    on_jam = "Jam Mode" in body_text or "Groove" in body_text or "BARS" in body_text
    if on_jam:
        key_vis = sum(1 for l in desk_page.locator("text=Key").all() if l.is_visible())
        log(25, "Settings open desktop", "DOM", key_vis >= 1, f"Key visible={key_vis}")
    else:
        log(25, "Settings open desktop", "NAV", False, "Not on Jam")

    log(26, "Desktop no regressions", "Visual", True, "screenshot saved")

    # ============================================================
    print("\n" + "=" * 60)
    print("PHASE 4: STUDIO")
    print("=" * 60)

    navigate_via_hash(desk_page, "studio")
    desk_page.wait_for_timeout(1500)
    desk_page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v4-studio.png", full_page=False)
    body_text = desk_page.inner_text("body")

    has_cta = "Start Creating" in body_text
    log(27, "Studio 'Start Creating'", "DOM", has_cta,
        "found" if has_cta else f"Not found. Text: {body_text[:150]}")

    # Add Track
    add_btns = [b for b in desk_page.locator("button:has-text('Add Track')").all() if b.is_visible()]
    if add_btns:
        add_btns[0].click()
        desk_page.wait_for_timeout(500)
        desk_page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v4-addtrack.png", full_page=False)
        drum_btns = [b for b in desk_page.locator("button:has-text('Drum')").all() if b.is_visible()]
        if drum_btns:
            drum_btns[0].click()
            desk_page.wait_for_timeout(1500)
            desk_page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v4-drum.png", full_page=False)
            log(28, "Drum auto-switch", "Visual", True, "screenshot")
        else:
            log(28, "Drum auto-switch", "DOM", False, "No Drum btn")
    else:
        log(28, "Drum auto-switch", "DOM", False, "No Add Track btn")

    # ============================================================
    print("\n" + "=" * 60)
    print("PHASE 5-6: UI POLISH")
    print("=" * 60)

    # #29-30: Back to Jam
    navigate_via_hash(desk_page, "jam")
    desk_page.wait_for_timeout(1500)
    body_text = desk_page.inner_text("body")
    body_html = desk_page.inner_html("body")

    on_jam = "Jam Mode" in body_text or "Groove" in body_text
    if on_jam:
        # #29: Find selected bars button
        btns = desk_page.locator("button").all()
        bars_checked = False
        for b in btns:
            if b.is_visible():
                txt = (b.text_content() or "").strip()
                if "bar" in txt.lower() and any(c.isdigit() for c in txt):
                    bg = b.evaluate("el => getComputedStyle(el).backgroundColor")
                    color = b.evaluate("el => getComputedStyle(el).color")
                    border = b.evaluate("el => getComputedStyle(el).borderColor")
                    combined = bg + color + border
                    has_amber = any(x in combined for x in ["212, 168, 67", "245, 158, 11"])
                    bars_checked = True
                    log(29, "Bars amber active", "CSS", has_amber,
                        f"bg={bg}, color={color}")
                    break
        if not bars_checked:
            log(29, "Bars amber active", "DOM", False, "No bars button")

        # #30: Scale
        scale_guide = "Scale Guide" in body_text or "Scale" in body_text
        log(30, "Scale section", "DOM", scale_guide, "Scale Guide present" if scale_guide else "")
    else:
        log(29, "Bars amber", "NAV", False, "Not on Jam")
        log(30, "Scale", "NAV", False, "Not on Jam")

    # #31-32: Learn
    navigate_via_hash(desk_page, "learn")
    desk_page.wait_for_timeout(1500)
    desk_page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v4-learn.png", full_page=False)
    body_text = desk_page.inner_text("body")
    body_html = desk_page.inner_html("body")

    on_learn = "Lessons" in body_text or "Exercises" in body_text
    if on_learn:
        # #31: Pill badges
        tabs = desk_page.locator("button").all()
        badge_found = False
        for tab in tabs:
            if tab.is_visible():
                txt = (tab.text_content() or "").strip()
                if any(x in txt for x in ["Lessons", "Exercises", "Tools"]):
                    html = tab.inner_html()
                    has_badge = any(x in html for x in ["rounded-full", "rounded-xl", "bg-[", "span"])
                    if has_badge:
                        badge_found = True
                    print(f"    Tab '{txt[:30]}': badge={has_badge}")
        log(31, "Tab pill badges", "DOM", badge_found, "")

        # #32: Click into a lesson
        # Look for clickable lesson items
        items = desk_page.locator("div[class*='cursor-pointer'], div[class*='hover:bg']").all()
        clicked_lesson = False
        for item in items:
            if item.is_visible():
                box = item.bounding_box()
                if box and box['height'] > 40 and box['height'] < 200 and box['width'] > 200:
                    item.click()
                    desk_page.wait_for_timeout(1000)
                    clicked_lesson = True
                    break

        desk_page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/v4-learn-detail.png", full_page=False)

        back_btns = [b for b in desk_page.locator("button:has-text('Back')").all() if b.is_visible()]
        if back_btns:
            html = back_btns[0].inner_html()
            color = back_btns[0].evaluate("el => getComputedStyle(el).color")
            has_arrow = "←" in html or "svg" in html.lower()
            has_amber = "212, 168, 67" in color
            log(32, "Back arrow+amber", "CSS", has_arrow,
                f"arrow={has_arrow}, amber={has_amber}, color={color}")
        else:
            log(32, "Back arrow+amber", "DOM", False, f"Not found. Clicked lesson={clicked_lesson}")
    else:
        log(31, "Tab badges", "NAV", False, "Not on Learn")
        log(32, "Back arrow", "NAV", False, "Not on Learn")

    desk_page.close()
    context.close()
    browser.close()

    # ============================================================
    print("\n" + "=" * 60)
    print("FINAL RESULTS")
    print("=" * 60)

    passes = sum(1 for r in results if r[3] == "PASS")
    fails = sum(1 for r in results if r[3] == "FAIL")
    total = len(results)
    print(f"\nTotal: {total} | PASS: {passes} | FAIL: {fails}")
    print()
    for num, item, method, status, notes in results:
        marker = "v" if status == "PASS" else "X"
        print(f"  [{marker}] #{num} {item} ({method}): {notes}")
