"""Comprehensive QA: Phases 3-6 testing with Playwright"""
from playwright.sync_api import sync_playwright
import time

def setup_page(browser, width, height):
    """Create a page with onboarding bypassed"""
    page = browser.new_page(viewport={"width": width, "height": height})
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle")
    # Bypass onboarding
    page.evaluate("""() => {
        localStorage.setItem('gf-onboarded', 'true');
        localStorage.setItem('gf30', JSON.stringify({
            level: 'Intermediate', style: 'Metal', practiceHours: 2,
            schedule: {}, practiceDayMinutes: 60
        }));
    }""")
    page.reload()
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    return page

def navigate_to(page, target, timeout=2000):
    """Navigate to a page by clicking nav buttons"""
    # Try bottom nav first
    btns = page.locator(f"button:has-text('{target}'), a:has-text('{target}'), [role='tab']:has-text('{target}')").all()
    for btn in btns:
        if btn.is_visible():
            btn.click()
            page.wait_for_timeout(timeout)
            return True
    # Try any clickable with text
    links = page.locator(f"text={target}").all()
    for link in links:
        if link.is_visible():
            link.click()
            page.wait_for_timeout(timeout)
            return True
    return False

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    print("=" * 60)
    print("PHASE 3: JAM MODE MOBILE UX (375x812)")
    print("=" * 60)

    page = setup_page(browser, 375, 812)
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-home-mobile.png", full_page=False)

    # Navigate to Studio
    navigate_to(page, "Studio")
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-studio-mobile.png", full_page=False)

    # Navigate to Jam Mode
    navigate_to(page, "Jam")
    page.wait_for_timeout(1000)
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-jam-mobile-viewport.png", full_page=False)
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-jam-mobile-full.png", full_page=True)

    # Get page HTML for analysis
    body_html = page.inner_html("body")

    # #16: Settings panel hidden on mobile
    # Look for settings collapse/expand
    settings_visible = page.locator("text=Settings").all()
    settings_vis_count = sum(1 for s in settings_visible if s.is_visible())
    print(f"\n#16 Settings panel hidden on mobile:")
    print(f"  Settings labels visible: {settings_vis_count}")

    # Check if Key/Scale selectors are visible (they shouldn't be if collapsed)
    key_sel = page.locator("select, [class*='select']").all()
    visible_selects = [s for s in key_sel if s.is_visible()]
    print(f"  Visible selects/dropdowns: {len(visible_selects)}")

    # #17: No min-h-[320px]
    has_min_h_320 = "min-h-[320px]" in body_html
    print(f"\n#17 No min-h-[320px]: {'FAIL - found' if has_min_h_320 else 'PASS - not found'}")

    # #18: Play button sticky at bottom
    play_btns = page.locator("button").all()
    play_found = False
    for pb in play_btns:
        if pb.is_visible():
            txt = (pb.text_content() or "").strip()
            if "Play" in txt or "▶" in txt or "play" in txt.lower():
                box = pb.bounding_box()
                if box:
                    play_found = True
                    is_sticky = "sticky" in (pb.evaluate("el => getComputedStyle(el).position") or "")
                    parent_sticky = "sticky" in (pb.evaluate("el => getComputedStyle(el.parentElement).position") or "")
                    gp_sticky = "sticky" in (pb.evaluate("el => getComputedStyle(el.parentElement?.parentElement || el).position") or "")
                    print(f"\n#18 Play button sticky: y={box['y']:.0f} h={box['height']:.0f}")
                    print(f"  position: self={pb.evaluate('el => getComputedStyle(el).position')}, parent={pb.evaluate('el => getComputedStyle(el.parentElement).position')}")
                    print(f"  Sticky check: {'PASS' if is_sticky or parent_sticky or gp_sticky else 'CHECK MANUALLY'}")
                    break
    if not play_found:
        print("\n#18 Play button: NOT FOUND")

    # #19: Touch targets Bass/Drums
    print("\n#19 Bass/Drums touch targets (min-h-36px):")
    for label in ["Bass", "Drums"]:
        btns = page.locator(f"button:has-text('{label}')").all()
        for btn in btns:
            if btn.is_visible():
                box = btn.bounding_box()
                if box:
                    print(f"  {label}: h={box['height']:.0f}px {'PASS' if box['height'] >= 36 else 'FAIL'}")

    # #20: Bars/Chord buttons min-h-44
    print("\n#20 Bars/Chord buttons (min-h-44px):")
    for label in ["4 bars", "8 bars", "12 bars", "16 bars"]:
        btns = page.locator(f"button:has-text('{label}')").all()
        for btn in btns:
            if btn.is_visible():
                box = btn.bounding_box()
                if box:
                    print(f"  '{label}': h={box['height']:.0f}px {'PASS' if box['height'] >= 44 else 'FAIL'}")

    # #21: Chord area padding
    print(f"\n#21 Chord area padding reduced: {'py-4 found' if 'py-4' in body_html else 'py-4 not found'}, {'py-8 NOT found (good)' if 'py-8' not in body_html else 'py-8 FOUND (bad)'}")

    # #22: Groove Style horizontal scroll
    has_overflow_x = "overflow-x-auto" in body_html or "overflow-x-scroll" in body_html
    has_flex_nowrap = "flex-nowrap" in body_html
    print(f"\n#22 Groove Style horizontal scroll: overflow-x={'FOUND' if has_overflow_x else 'NOT FOUND'}, flex-nowrap={'FOUND' if has_flex_nowrap else 'NOT FOUND'}")

    # #23: Header subtitle hidden on mobile
    subtitles = page.locator("[class*='hidden sm:'], [class*='sm:block']").all()
    hidden_on_mobile = sum(1 for s in subtitles if not s.is_visible())
    print(f"\n#23 Header subtitle hidden on mobile: {hidden_on_mobile} elements hidden on mobile")

    # #24: Spacing reductions
    has_p2 = "p-2" in body_html
    has_gap2 = "gap-2" in body_html
    has_mt2 = "mt-2" in body_html
    print(f"\n#24 Spacing reductions: p-2={has_p2}, gap-2={has_gap2}, mt-2={has_mt2}")

    page.close()

    # DESKTOP
    print("\n" + "=" * 60)
    print("PHASE 3 DESKTOP: JAM MODE (1920x1080)")
    print("=" * 60)

    page = setup_page(browser, 1920, 1080)
    navigate_to(page, "Studio")
    navigate_to(page, "Jam")
    page.wait_for_timeout(1000)
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-jam-desktop.png", full_page=False)

    # #25: Settings panel OPEN on desktop
    key_labels = page.locator("text=Key").all()
    scale_labels = page.locator("text=Scale").all()
    visible_count = sum(1 for l in key_labels + scale_labels if l.is_visible())
    print(f"\n#25 Settings open on desktop: Key/Scale labels visible={visible_count} {'PASS' if visible_count >= 2 else 'CHECK'}")

    # #26: Desktop layouts - no regressions
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-jam-desktop-full.png", full_page=True)
    print(f"#26 Desktop layout: screenshot saved for visual check")

    page.close()

    # ============================================================
    print("\n" + "=" * 60)
    print("PHASE 4: STUDIO PAGE")
    print("=" * 60)

    page = setup_page(browser, 1920, 1080)
    navigate_to(page, "Studio")
    page.wait_for_timeout(1000)
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph4-studio-desktop.png", full_page=False)

    # #27: Empty state CTA
    body_text = page.inner_text("body")
    has_start_creating = "Start Creating" in body_text or "start creating" in body_text.lower()
    print(f"\n#27 Empty state 'Start Creating': {'PASS' if has_start_creating else 'FAIL'}")

    # Look for prominent CTA button
    cta_btns = page.locator("button:has-text('Start'), button:has-text('Create'), button:has-text('Add Track')").all()
    visible_ctas = [b for b in cta_btns if b.is_visible()]
    print(f"  CTA buttons visible: {len(visible_ctas)}")
    for btn in visible_ctas:
        print(f"    '{btn.text_content().strip()[:40]}'")

    # #28: Add Track -> Drum Machine -> auto-switch
    add_track_btn = page.locator("button:has-text('Add Track')").all()
    if add_track_btn:
        for btn in add_track_btn:
            if btn.is_visible():
                btn.click()
                page.wait_for_timeout(500)
                break
        page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph4-add-track-menu.png", full_page=False)

        # Click Drum Machine
        drum_btn = page.locator("button:has-text('Drum Machine'), button:has-text('Drum')").all()
        if drum_btn:
            for btn in drum_btn:
                if btn.is_visible():
                    btn.click()
                    page.wait_for_timeout(1000)
                    break
            page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph4-drum-added.png", full_page=False)

            # Check if Drum tab is active in bottom panel
            drum_tabs = page.locator("[class*='active']:has-text('Drum'), [aria-selected='true']:has-text('Drum')").all()
            visible_drum_tabs = [t for t in drum_tabs if t.is_visible()]
            print(f"\n#28 Drum tab auto-switch: active drum tabs={len(visible_drum_tabs)}")
            page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph4-drum-tab-active.png", full_page=False)
        else:
            print("\n#28 Drum Machine button not found in menu")
    else:
        print("\n#28 Add Track button not found")

    page.close()

    # ============================================================
    print("\n" + "=" * 60)
    print("PHASE 5-6: UI POLISH")
    print("=" * 60)

    page = setup_page(browser, 1920, 1080)

    # #29: Jam Mode Bars/Chord amber active state
    navigate_to(page, "Studio")
    navigate_to(page, "Jam")
    page.wait_for_timeout(1000)

    # Find bars buttons and check if selected one has amber styling
    bars_btns = page.locator("button:has-text('4 bars'), button:has-text('8 bars'), button:has-text('12 bars')").all()
    print(f"\n#29 Bars/Chord amber active state:")
    for btn in bars_btns:
        if btn.is_visible():
            classes = btn.get_attribute("class") or ""
            style = btn.get_attribute("style") or ""
            bg = btn.evaluate("el => getComputedStyle(el).backgroundColor")
            txt = btn.text_content().strip()[:20]
            has_amber = "D4A843" in classes or "amber" in classes or "D4A843" in style or "f59e0b" in style
            print(f"  '{txt}': bg={bg}, amber={'YES' if has_amber else 'NO'}")

    # #30: Scale tab disabled tooltip
    print(f"\n#30 Scale tab disabled tooltip:")
    scale_tabs = page.locator("button:has-text('Scale'), [role='tab']:has-text('Scale')").all()
    for tab in scale_tabs:
        if tab.is_visible():
            disabled = tab.is_disabled() or "disabled" in (tab.get_attribute("class") or "")
            title = tab.get_attribute("title") or ""
            aria_label = tab.get_attribute("aria-label") or ""
            tooltip = tab.evaluate("el => el.title || el.getAttribute('data-tooltip') || ''")
            print(f"  Scale tab: disabled={disabled}, title='{tooltip}'")

    page.close()

    # #31-32: Learning page
    page = setup_page(browser, 1920, 1080)
    navigate_to(page, "Learn")
    page.wait_for_timeout(1000)
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph56-learning-desktop.png", full_page=False)

    # #31: Tab counts with pill/badge styling
    print(f"\n#31 Learning tab counts pill/badge:")
    tabs = page.locator("[role='tab'], button").all()
    for tab in tabs:
        if tab.is_visible():
            txt = (tab.text_content() or "").strip()
            if any(x in txt for x in ["Lesson", "Exercise", "Tool", "lesson", "exercise", "tool"]):
                html = tab.inner_html()
                has_badge = "badge" in html or "pill" in html or "rounded-full" in html or "bg-" in html
                print(f"  '{txt[:30]}': badge_styling={'YES' if has_badge else 'NO'}")

    # #32: "Back to list" arrow and amber styling
    # First navigate into a lesson
    lesson_links = page.locator("button:has-text('Lesson'), [class*='card']:has-text('Lesson')").all()
    if lesson_links:
        for link in lesson_links:
            if link.is_visible():
                link.click()
                page.wait_for_timeout(1000)
                break

    back_btns = page.locator("button:has-text('Back'), button:has-text('back'), button:has-text('←')").all()
    print(f"\n#32 'Back to list' arrow + amber:")
    for btn in back_btns:
        if btn.is_visible():
            txt = btn.text_content().strip()[:40]
            html = btn.inner_html()
            classes = btn.get_attribute("class") or ""
            has_arrow = "←" in html or "arrow" in html.lower() or "svg" in html or "ArrowLeft" in html
            has_amber = "D4A843" in classes or "amber" in classes or "D4A843" in html
            color = btn.evaluate("el => getComputedStyle(el).color")
            print(f"  '{txt}': arrow={has_arrow}, amber={has_amber}, color={color}")

    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph56-learning-detail.png", full_page=False)

    page.close()
    browser.close()
    print("\n" + "=" * 60)
    print("ALL PHASES COMPLETE")
    print("=" * 60)
