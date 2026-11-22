"""Engine-behaviour probe: picker drag via pointer events, slider, keyboard nav, sticky header,
horizontal overflow, popover placement. Runs in either browser (BROWSER=firefox|chromium)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import BROWSER, IS_FIREFOX, ROOT, launch_kwargs, context_kwargs, browser_type, shot
from playwright.sync_api import sync_playwright

URL = 'file://' + os.path.join(ROOT, 'palette_picker.html')
errors, fails = [], []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

with sync_playwright() as pw:
    br = browser_type(pw).launch(**launch_kwargs())
    ctx = br.new_context(**context_kwargs())
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    page.goto(URL); page.wait_for_selector('.pal')
    page.evaluate("()=>{localStorage.clear();}"); page.reload(); page.wait_for_selector('.pal')
    print('browser', BROWSER, page.evaluate('navigator.userAgent'))
    # CSS feature support used by the stylesheet
    feats = page.evaluate("""()=>({aspect:CSS.supports('aspect-ratio','1'),inset:CSS.supports('inset','0'),sbw:CSS.supports('scrollbar-width','thin'),
        appearance:CSS.supports('appearance','none'),focusVisible:(()=>{try{document.querySelector(':focus-visible');return true}catch(e){return false}})(),
        eyedropper:!!window.EyeDropper,pointerCapture:'setPointerCapture' in Element.prototype,clipboard:!!(navigator.clipboard&&navigator.clipboard.writeText)})""")
    print('features', feats)
    check(all(feats[k] for k in ('aspect', 'inset', 'sbw', 'appearance', 'focusVisible', 'pointerCapture', 'clipboard')), 'all CSS/JS features used are supported')
    # no horizontal overflow at desktop and mobile widths
    for w in (1280, 1024, 420):
        page.set_viewport_size({'width': w, 'height': 860}); page.wait_for_timeout(150)
        sw, cw = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        check(sw <= cw, f'no horizontal overflow at {w}px (scrollWidth {sw} vs {cw})')
    page.set_viewport_size({'width': 1280, 'height': 860})
    # picker drag via pointer events (mouse down, move, up)
    before = page.evaluate('S.color')
    box = page.locator('#svBox').bounding_box()
    page.mouse.move(box['x'] + 10, box['y'] + 10); page.mouse.down()
    page.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.5, steps=5)
    mid = page.evaluate('S.color')
    page.mouse.move(box['x'] + box['width'] * 0.95, box['y'] + box['height'] * 0.1, steps=5); page.mouse.up()
    after = page.evaluate('S.color')
    print('drag colors', before, mid, after)
    check(before != mid != after, 'picker drag updates color continuously (pointer capture)')
    # drag that leaves the box keeps tracking (capture) and does not stick after release
    page.mouse.move(box['x'] + 5, box['y'] + 5); page.mouse.down(); page.mouse.move(box['x'] - 40, box['y'] + box['height'] + 40, steps=4); page.mouse.up()
    c1 = page.evaluate('S.color'); page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); c2 = page.evaluate('S.color')
    check(c1 == c2, 'no stuck drag after pointerup outside the box')
    # hue slider: keyboard + input event
    page.focus('#hueSlider'); h0 = page.evaluate("+document.querySelector('#hueSlider').value")
    page.keyboard.press('ArrowRight'); page.keyboard.press('ArrowRight')
    h1 = page.evaluate("+document.querySelector('#hueSlider').value"); print('hue', h0, '->', h1)
    check(h1 == h0 + 2, 'hue slider responds to arrow keys')
    thumb = page.evaluate("getComputedStyle(document.querySelector('#hueSlider'), IS=null)['appearance']")
    print('slider appearance', thumb)
    check(thumb == 'none', 'range slider custom styling applied (appearance:none)')
    sl = page.locator('#hueSlider').bounding_box(); check(14 <= sl['height'] <= 22, f'slider height sane ({sl["height"]})')
    # keyboard navigation: picker box arrows, palette paging, Escape closes popovers
    page.focus('#svBox'); s0 = page.evaluate('picker.s'); page.keyboard.press('ArrowRight'); check(page.evaluate('picker.s') > s0, 'picker box arrow keys work')
    page.click('body', position={'x': 700, 'y': 700}); cur0 = page.evaluate('S.cur'); page.keyboard.press('ArrowRight'); check(page.evaluate('S.cur') == cur0 + 1, 'ArrowRight pages palettes')
    page.click('#stage .sw >> nth=0'); check(page.locator('.pop').count() == 1, 'swatch popover opens')
    pb = page.locator('.pop').bounding_box(); check(pb['x'] >= 0 and pb['x'] + pb['width'] <= 1280 and pb['y'] + pb['height'] <= 860, 'popover inside viewport')
    page.keyboard.press('Escape'); check(page.locator('.pop').count() == 0, 'Escape closes popover')
    # Tab order reaches the header controls
    page.focus('#bgBtn'); page.keyboard.press('Enter'); page.wait_for_timeout(100); check(page.locator('.bg-pop').count() == 1, 'Background popover opens via keyboard')
    page.keyboard.press('Escape')
    # sticky header: scroll grid and verify header still at top
    page.click('#viewSeg [data-view=multi]'); page.wait_for_timeout(150)
    page.mouse.wheel(0, 1200); page.wait_for_timeout(200)
    hb = page.locator('header').bounding_box(); check(abs(hb['y']) < 1, f'header sticky after scroll (y={hb["y"]})')
    page.screenshot(path=shot('p1_grid_scrolled.png'))
    page.mouse.wheel(0, -2000); page.wait_for_timeout(150)
    page.screenshot(path=shot('p2_grid.png'))
    page.click('#viewSeg [data-view=single]'); page.wait_for_timeout(150); page.screenshot(path=shot('p3_single.png'))
    page.click('#bgBtn'); page.wait_for_selector('.bg-pop'); page.click('.bg-pop .bgchip[data-bg="#d4d0c8"]'); page.wait_for_timeout(100)
    page.screenshot(path=shot('p4_bg_d4d0c8_popover.png'))
    page.keyboard.press('Escape')
    page.locator('#svBox').scroll_into_view_if_needed(); page.screenshot(path=shot('p5_picker.png'), clip={'x': 0, 'y': 60, 'width': 360, 'height': 520})
    page.click('#stage .sw >> nth=0'); page.wait_for_timeout(100); page.screenshot(path=shot('p6_popover.png')); page.keyboard.press('Escape')
    # localStorage round trip
    page.evaluate("()=>{S.type='Analogous';save();}"); page.reload(); page.wait_for_selector('.pal')
    check(page.evaluate('S.type') == 'Analogous' and page.evaluate('S.bg') == '#d4d0c8', 'localStorage persistence (type + bg)')
    # native color input emits input event
    page.locator('#nativeColor').evaluate("el=>{el.value='#123456';el.dispatchEvent(new Event('input',{bubbles:true}));}")
    check(page.evaluate('S.color') == '#123456', 'native color input drives the color')
    br.close()
print('ERRORS', errors)
print('FAILS', fails)
sys.exit(1 if errors or fails else 0)
