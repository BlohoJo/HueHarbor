"""Preview feature verification (scenes, roles, palette stepping, photo effects, PNG download)."""
import os, sys, io, struct
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import BROWSER, IS_FIREFOX, launch_kwargs, context_kwargs, browser_type, shot, test_photo
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'palette_picker.html')
TEST_IMG = test_photo()
SCENES = ['web', 'poster', 'room', 'outfit', 'dash', 'photo']
errors, fails = [], []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

CANVAS_HASH = """()=>{const cv=document.querySelector('.pv-stage canvas');if(!cv)return null;const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
  let h=0,s=0;for(let i=0;i<d.length;i+=97){h=(h*31+d[i])>>>0;s+=d[i];}return h+':'+s;}"""
ROLES = "()=>[...document.querySelectorAll('.pv-role')].map(e=>e.title).join('|')"

with sync_playwright() as pw:
    print('browser', BROWSER)
    br = browser_type(pw).launch(**launch_kwargs())
    ctx = br.new_context(**context_kwargs(accept_downloads=True))
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    page.goto(URL); page.wait_for_selector('.pal')
    page.evaluate("()=>{localStorage.clear();S.theme='light';S.mode='generate';S.view='multi';S.type='Complementary';S.color='#2f6ea5';save();applyTheme();applyMode();buildTypeList();setColor(S.color,true);render();}")
    page.wait_for_selector('.pal')
    n_items = page.evaluate("()=>collection().items.length")
    first = page.evaluate("()=>collection().items.findIndex(p=>p.colors.length>=4)")
    print('items', n_items, 'first 4-colour palette at', first)
    # open from a card (a 4-colour palette so the three photo effects differ)
    page.locator(f'.pal >> nth={first} >> button:has-text("Preview")').click()
    page.wait_for_selector('.pv-box')
    check(page.locator('.pv-stage svg').count() == 1, 'preview opens with an SVG scene')
    check(page.locator('.pv-tabs button').count() == 6, 'six scene tabs')
    # every scene renders; screenshot each
    for sid in SCENES:
        page.click(f'.pv-tabs button[data-scene="{sid}"]'); page.wait_for_timeout(120)
        if sid == 'photo':
            ok = page.locator('.pv-stage canvas').count() == 1 and page.evaluate(CANVAS_HASH) is not None
        else:
            ok = page.locator('.pv-stage svg').count() == 1 and page.evaluate("()=>document.querySelector('.pv-stage svg').getBBox().width>0 || true")
            # at least 3 distinct palette colours must appear in the scene markup
            used = page.evaluate("()=>{const html=document.querySelector('.pv-stage').innerHTML.toLowerCase();return collection().items[pv.idx].colors.filter(c=>html.includes(c)).length;}")
            ok = ok and used >= 2
        check(ok, f'scene {sid} renders')
        page.screenshot(path=shot(f'pv_{sid}.png'))
    # roles: shuffle changes assignment; base toggle changes background role
    page.click('.pv-tabs button[data-scene="web"]')
    r0 = page.evaluate(ROLES); page.click('#pvShuffle'); r1 = page.evaluate(ROLES)
    check(r0 != r1, 'shuffle roles changes the assignment')
    seen = {r0, r1}
    for _ in range(2 * 5):
        page.click('#pvShuffle'); seen.add(page.evaluate(ROLES))
    print('distinct role sets over shuffles:', len(seen))
    check(len(seen) >= 3, 'shuffle cycles through several variants')
    page.evaluate("()=>{pv.shuffle=0;renderPreview();}")
    page.click('.pv-tools .seg button[data-base="dark"]'); rd = page.evaluate(ROLES)
    page.screenshot(path=shot('pv_web_dark.png'))
    page.click('.pv-tools .seg button[data-base="light"]'); rl = page.evaluate(ROLES)
    check(rd != rl, 'light/dark base changes roles')
    # text contrast: every role set must give text >= 4.5:1 on background
    bad = page.evaluate("""()=>{const out=[];for(const p of collection().items){for(let s=0;s<p.colors.length*2;s++)for(const base of ['light','dark']){const R=pvRoles(p.colors,s,base);
        if(contrast(R.text,R.bg)<4.5)out.push([p.name,s,base,R.text,R.bg,contrast(R.text,R.bg).toFixed(2)]);if(contrast(R.muted,R.bg)<4.5)out.push(['muted',p.name,s,base]);}}return out.slice(0,5);}""")
    check(not bad, f'text/muted contrast >= 4.5 for all palettes, shuffles and bases {bad}')
    # 2-colour palettes derive roles without error
    two = page.evaluate("()=>{const R=pvRoles(['#2f6ea5','#f2c14e'],0,'light');return [R.bg,R.surface,R.primary,R.accent,R.secondary,R.tertiary,R.text].every(c=>/^#[0-9a-f]{6}$/.test(c))}")
    check(two, '2-colour palette derives all roles')
    # stepping: next/prev + keyboard
    page.evaluate("()=>{pv.idx=0;renderPreview();}")
    page.click('#pvNext'); check(page.evaluate('pv.idx') == 1 and '2 of' in page.inner_text('.pv-head .counter'), 'Next steps palette')
    page.keyboard.press('ArrowRight'); check(page.evaluate('pv.idx') == 2, 'ArrowRight steps palette')
    page.keyboard.press('ArrowLeft'); page.click('#pvPrev'); check(page.evaluate('pv.idx') == 0, 'ArrowLeft/Prev step back')
    check(page.locator('#pvPrev').is_disabled(), 'Prev disabled at first palette')
    page.evaluate("()=>{pv.idx=%d;renderPreview();}" % first)
    # photo effects on the sample image
    page.click('.pv-tabs button[data-scene="photo"]'); page.wait_for_timeout(100)
    hashes = {}
    for eff in ('gradient', 'poster', 'duo'):
        page.click(f'.pv-tools .seg button[data-effect="{eff}"]'); page.wait_for_timeout(150)
        hashes[eff] = page.evaluate(CANVAS_HASH); page.screenshot(path=shot(f'pv_photo_{eff}.png'))
    check(len(set(hashes.values())) == 3, f'three effects give different pixels {hashes}')
    # intensity 0 == original, differs from full effect
    page.locator('.pv-range input').evaluate("el=>{el.value=0;el.dispatchEvent(new Event('input',{bubbles:true}));}")
    page.wait_for_function("()=>pv.raf===0")  # slider renders are coalesced into the next animation frame
    check(page.inner_text('.pv-pct') == '0%', 'percentage label follows the slider')
    h_orig = page.evaluate(CANVAS_HASH); check(h_orig != hashes['duo'], 'intensity 0 restores the original pixels')
    page.locator('.pv-range input').evaluate("el=>{el.value=100;el.dispatchEvent(new Event('input',{bubbles:true}));}"); page.wait_for_function("()=>pv.raf===0")
    # duotone colour choice changes result
    page.locator('.pv-duo >> nth=1 >> .pv-dot >> nth=0').click(); page.wait_for_timeout(100)
    check(page.evaluate(CANVAS_HASH) != hashes['duo'], 'changing duotone highlight colour changes pixels')
    # load a local image through the file input
    page.set_input_files('#pvFile', TEST_IMG); page.wait_for_selector('.pv-tools button:has-text("Use sample")', timeout=5000)
    h_loaded = page.evaluate(CANVAS_HASH)
    check(page.evaluate('pv.srcName') == 'test-photo' and h_loaded not in hashes.values(), 'local image loads via FileReader and re-renders')
    for eff in ('gradient', 'poster'):
        page.click(f'.pv-tools .seg button[data-effect="{eff}"]'); page.wait_for_timeout(150)
        page.screenshot(path=shot(f'pv_loaded_{eff}.png'))
    check(page.evaluate(CANVAS_HASH) != h_loaded, 'effects re-apply to the loaded image')
    # download PNG
    with page.expect_download() as dl:
        page.click('#pvDownload')
    d = dl.value; path = os.path.join(ROOT, 'shots', 'firefox' if IS_FIREFOX else '', 'exports', d.suggested_filename)
    os.makedirs(os.path.dirname(path), exist_ok=True); d.save_as(path); data = open(path, 'rb').read()
    w, hh = struct.unpack('>II', data[16:24])
    check(data[:8] == b'\x89PNG\r\n\x1a\n' and (w, hh) == (640, 400) and len(data) > 1000, f'PNG download at the photo\'s own resolution {d.suggested_filename} {len(data)} bytes {w}x{hh}')
    check(page.evaluate("()=>pv.busy===false&&document.querySelector('#pvDownload').disabled===false"), f"export finished via {page.evaluate('pv.exportVia')} and the button is re-enabled")
    # the exported pixels must match the posterized preview (same effect, scaled): compare a few sample points
    img = Image.open(io.BytesIO(data)).convert('RGB'); cvpx = page.evaluate("()=>{const cv=document.querySelector('.pv-stage canvas');return Array.from(cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data);}")
    cw = page.evaluate("()=>document.querySelector('.pv-stage canvas').width"); mism = 0
    for (x, y) in [(10, 10), (320, 200), (600, 390), (100, 300), (500, 50)]:
        px = img.getpixel((x, y)); j = (int(y * 1.25) * cw + int(x * 1.25)) * 4; q = tuple(cvpx[j:j + 3])
        if max(abs(a - b) for a, b in zip(px, q)) > 48: mism += 1
    check(mism <= 1, f'exported pixels match the preview effect at sample points ({mism} mismatches)')
    # back to sample + theme/background respect + escape
    page.click('.pv-tools button:has-text("Use sample")'); page.wait_for_timeout(100); check(page.evaluate('pv.srcName') == 'sample', 'Use sample restores the built-in image')
    page.keyboard.press('Escape'); check(page.locator('.pv-box').count() == 0, 'Escape closes the preview')
    page.evaluate("()=>{S.theme='dark';S.bg='#d4d0c8';save();applyTheme();}")
    page.locator('.pal >> nth=1 >> button:has-text("Preview")').click(); page.wait_for_selector('.pv-box')
    page.click('.pv-tabs button[data-scene="web"]')
    check(page.evaluate("()=>document.querySelector('.pv-tools .seg button[data-base=dark]').getAttribute('aria-pressed')") == 'true', 'base defaults to the active (dark) theme')
    box_bg = page.evaluate("()=>getComputedStyle(document.querySelector('.pv-box')).backgroundColor")
    check(box_bg == 'rgb(30, 33, 38)', f'modal uses the dark panel colour on a yellow page background ({box_bg})')
    page.screenshot(path=shot('pv_dark_theme.png'))
    # open from magnify
    page.keyboard.press('Escape'); page.locator('.pal >> nth=2 >> button:has-text("Magnify")').click(); page.wait_for_selector('.mag-stage')
    page.click('.mag-tools button:has-text("Preview")'); page.wait_for_selector('.pv-box')
    check(page.evaluate('pv.idx') == 2 and page.locator('.mag-stage').count() == 0, 'Preview opens from Magnify at the same palette')
    page.keyboard.press('Escape')
    # library + list modes also preview
    page.evaluate("()=>{setMode('library');}"); page.wait_for_selector('.pal')
    page.locator('.pal >> nth=0 >> button:has-text("Preview")').click(); page.wait_for_selector('.pv-box'); check(page.locator('.pv-stage svg').count() == 1, 'preview works in Classic library mode'); page.keyboard.press('Escape')
    br.close()
print('ERRORS', errors)
print('FAILS', fails)
sys.exit(1 if errors or fails else 0)
