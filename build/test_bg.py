"""Background-colour control verification (headless Chromium)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import BROWSER, IS_FIREFOX, launch_kwargs, context_kwargs, browser_type, shot
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'palette_picker.html')
QUICK = ['#ffffff', '#d4d0c8', '#bfbfbf', '#808080', '#000000']


def rgb(hexs):
    return 'rgb(%d, %d, %d)' % tuple(int(hexs[i:i + 2], 16) for i in (1, 3, 5))


def body_bg(page):
    return page.evaluate("()=>getComputedStyle(document.body).backgroundColor")


def contrast(page, sel):
    return page.evaluate("""(sel)=>{const el=document.querySelector(sel);const cs=getComputedStyle(el);
      const p=s=>s.match(/\\d+/g).slice(0,3).map(Number);const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
      const a=lum(p(cs.color)),b=lum(p(getComputedStyle(document.body).backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}""", sel)


errors = []
with sync_playwright() as pw:
    print('browser', BROWSER)
    br = browser_type(pw).launch(**launch_kwargs())
    ctx = br.new_context(**context_kwargs())
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL); page.wait_for_selector('.pal')
    page.evaluate("()=>{S.theme='light';S.bg=null;save();applyTheme();}")
    default_light = body_bg(page); print('default light bg', default_light)
    assert default_light == rgb('#f5f6f8')
    page.click('#bgBtn'); page.wait_for_selector('.bg-pop')
    assert page.locator('.bg-pop .bgchip').count() == 6, 'expected 5 quick picks + Reset'
    for q in QUICK:
        page.click(f'.bg-pop .bgchip[data-bg="{q}"]')
        got = body_bg(page); c_title = contrast(page, '#title'); c_sub = contrast(page, '#subtitle'); c_foot = contrast(page, 'footer')
        print(f'{q}: body bg {got}  contrast title {c_title:.1f} subtitle {c_sub:.1f} footer {c_foot:.1f}')
        assert got == rgb(q), (q, got)
        assert c_title >= 4.5 and c_sub >= 4.5 and c_foot >= 4.5, 'contrast too low'
        panel_c = page.evaluate("()=>{const el=document.querySelector('.pal .foot .name');const p=s=>s.match(/\\d+/g).slice(0,3).map(Number);const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};const a=lum(p(getComputedStyle(el).color)),b=lum(p(getComputedStyle(el.closest('.pal')).backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}")
        assert panel_c >= 7, f'card text contrast dropped to {panel_c}'
        if q in ('#d4d0c8', '#000000'):
            page.screenshot(path=shot(f'13_bg_{q[1:]}.png'))
    # custom hex via text input
    page.fill('.bg-pop input[type=text]', '#2a4d69')
    assert body_bg(page) == rgb('#2a4d69'), body_bg(page)
    print('custom hex #2a4d69 ok, contrast title %.1f' % contrast(page, '#title'))
    # native colour input
    page.locator('.bg-pop input[type=color]').evaluate("el=>{el.value='#ffe4c4';el.dispatchEvent(new Event('input',{bubbles:true}));}")
    assert body_bg(page) == rgb('#ffe4c4')
    print('native color input ok')
    # persistence
    page.reload(); page.wait_for_selector('.pal')
    assert body_bg(page) == rgb('#ffe4c4'), 'did not persist: ' + body_bg(page)
    assert page.evaluate("()=>getComputedStyle(document.querySelector('#bgSwatch')).backgroundColor") == rgb('#ffe4c4')
    print('persisted across reload ok')
    # dark theme + reset returns to dark default
    page.click('#themeBtn'); assert body_bg(page) == rgb('#ffe4c4')
    page.click('#bgBtn'); page.wait_for_selector('.bg-pop'); page.click('.bg-pop .bgchip.reset')
    assert body_bg(page) == rgb('#15171b'), body_bg(page)
    print('reset → dark default ok')
    page.click('#themeBtn'); assert body_bg(page) == rgb('#f5f6f8')
    print('reset → light default ok')
    page.keyboard.press('Escape'); assert page.locator('.bg-pop').count() == 0
    br.close()
print('ERRORS', errors)
sys.exit(1 if errors else 0)
