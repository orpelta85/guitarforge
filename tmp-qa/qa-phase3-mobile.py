"""Phase 3: Jam Mode Mobile UX testing at 375x812"""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # MOBILE TEST (375x812)
    page = browser.new_page(viewport={"width": 375, "height": 812})
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle")
    time.sleep(1)

    # Navigate to Jam Mode - click on Studio nav first
    # Look for navigation items
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-01-home-mobile.png", full_page=False)

    # Find and click Studio/Jam in nav
    nav_html = page.content()

    # Try clicking Studio in bottom nav
    studio_btns = page.locator("text=Studio").all()
    if studio_btns:
        studio_btns[0].click()
        page.wait_for_timeout(1000)

    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-02-studio-mobile.png", full_page=False)

    # Look for Jam Mode tab/button
    jam_btns = page.locator("text=Jam").all()
    if jam_btns:
        for btn in jam_btns:
            if btn.is_visible():
                btn.click()
                break
        page.wait_for_timeout(1000)

    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-03-jam-mobile.png", full_page=True)
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-03b-jam-mobile-viewport.png", full_page=False)

    # Check #16: Settings panel hidden on mobile - look for collapsed/hidden settings
    settings_panels = page.locator("[class*='settings'], [data-testid*='settings']").all()
    print(f"Settings panels found: {len(settings_panels)}")

    # Check for any collapsible settings header
    settings_toggle = page.locator("text=Settings").all()
    print(f"Settings toggle buttons: {len(settings_toggle)}")
    for st in settings_toggle:
        if st.is_visible():
            print(f"  Settings visible: text='{st.text_content()}'")

    # Check #18: Play button sticky at bottom
    play_btns = page.locator("button:has-text('Play'), button:has-text('▶')").all()
    print(f"Play buttons found: {len(play_btns)}")
    for pb in play_btns:
        if pb.is_visible():
            box = pb.bounding_box()
            if box:
                print(f"  Play button at y={box['y']}, height={box['height']}, bottom={box['y']+box['height']}")
                # Check if it's in bottom ~80px of viewport
                if box['y'] > 700:
                    print("  >> PASS: Play button is near bottom of viewport (sticky)")
                else:
                    print(f"  >> INFO: Play button at y={box['y']} (viewport=812)")

    # Check #19: Bass/Drums ON/OFF button touch targets
    bass_drums_btns = page.locator("button:has-text('Bass'), button:has-text('Drums'), button:has-text('ON'), button:has-text('OFF')").all()
    print(f"\nBass/Drums/ON/OFF buttons: {len(bass_drums_btns)}")
    for btn in bass_drums_btns:
        if btn.is_visible():
            box = btn.bounding_box()
            if box:
                txt = btn.text_content().strip()[:30]
                meets_36 = box['height'] >= 36
                print(f"  '{txt}' h={box['height']:.0f}px {'PASS(>=36)' if meets_36 else 'FAIL(<36)'}")

    # Check #20: Bars/Chord buttons min-h-[44px]
    bars_chord_btns = page.locator("button:has-text('bars'), button:has-text('Bars'), button:has-text('chord'), button:has-text('Chord')").all()
    print(f"\nBars/Chord buttons: {len(bars_chord_btns)}")
    for btn in bars_chord_btns:
        if btn.is_visible():
            box = btn.bounding_box()
            if box:
                txt = btn.text_content().strip()[:30]
                meets_44 = box['height'] >= 44
                print(f"  '{txt}' h={box['height']:.0f}px {'PASS(>=44)' if meets_44 else 'FAIL(<44)'}")

    # Check #22: Groove Style buttons - check for horizontal scroll
    # Look for flex-nowrap or overflow-x-auto on groove style container
    groove_container = page.locator("[class*='overflow-x'], [class*='flex-nowrap']").all()
    print(f"\nHorizontal scroll containers: {len(groove_container)}")

    # Check #23: Header subtitle hidden on mobile
    subtitles = page.locator("[class*='hidden sm:'], [class*='md:block'], h2, .subtitle").all()
    print(f"\nPotential subtitle elements: {len(subtitles)}")

    # Check #24: Spacing reductions
    page.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-04-jam-scrolled-mobile.png", full_page=True)

    # Get full page HTML for class analysis
    jam_html = page.inner_html("body")
    has_p2 = "p-2" in jam_html or "px-2" in jam_html
    has_mb2 = "mb-2" in jam_html
    has_gap2 = "gap-2" in jam_html
    print(f"\nSpacing classes: p-2={has_p2}, mb-2={has_mb2}, gap-2={has_gap2}")

    # Check min-h-[320px] NOT present
    has_min_h_320 = "min-h-[320px]" in jam_html
    print(f"min-h-[320px] present (should be NO): {has_min_h_320}")

    print("\n=== DESKTOP TEST ===")
    # DESKTOP TEST (1920x1080)
    page2 = browser.new_page(viewport={"width": 1920, "height": 1080})
    page2.goto("http://localhost:3000")
    page2.wait_for_load_state("networkidle")
    time.sleep(1)

    # Navigate to Studio > Jam
    studio_btns2 = page2.locator("text=Studio").all()
    if studio_btns2:
        studio_btns2[0].click()
        page2.wait_for_timeout(1000)

    jam_btns2 = page2.locator("text=Jam").all()
    if jam_btns2:
        for btn in jam_btns2:
            if btn.is_visible():
                btn.click()
                break
        page2.wait_for_timeout(1000)

    page2.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-05-jam-desktop.png", full_page=False)

    # Check #25: Settings panel starts OPEN on desktop
    # On desktop, settings should be visible
    desktop_html = page2.inner_html("body")
    print(f"Desktop page loaded, checking settings visibility...")

    # Look for Key/Scale/Style labels that would be in settings
    key_labels = page2.locator("text=Key").all()
    scale_labels = page2.locator("text=Scale").all()
    style_labels = page2.locator("text=Style").all()
    visible_settings = 0
    for lbl in key_labels + scale_labels + style_labels:
        if lbl.is_visible():
            visible_settings += 1
    print(f"  Visible Key/Scale/Style labels on desktop: {visible_settings}")
    if visible_settings >= 2:
        print("  >> PASS: Settings panel appears open on desktop")
    else:
        print("  >> FAIL: Settings panel may be hidden on desktop")

    page2.screenshot(path="c:/Users/User/guitarforge/tmp-qa/ph3-06-jam-desktop-full.png", full_page=True)

    browser.close()
    print("\nPhase 3 complete!")
