"""Preview smoke run in a *stock* Firefox Developer Edition (or any stock Firefox) via geckodriver + Selenium.
Playwright can only drive its own patched Firefox build (157 at the time of writing), so this script exists to
check the Preview features in the real Developer Edition channel. Mirrors build/test_preview.py where Selenium allows.

Setup (Linux):
  curl -L -o ffdev.tar.xz "https://download.mozilla.org/?product=firefox-devedition-latest-ssl&os=linux64&lang=en-US"
  tar xf ffdev.tar.xz; download geckodriver from https://github.com/mozilla/geckodriver/releases; pip install selenium
Run:
  FFDEV_BIN=/path/firefox/firefox GECKODRIVER=/path/geckodriver python3 build/test_ffdev.py
Screenshots go to shots/ffdev/. Exit code 1 on any failed check or page error."""
import os, sys, time, json
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'palette_picker.html')
OUT = os.path.join(ROOT, 'shots', 'ffdev'); os.makedirs(OUT, exist_ok=True)
FFDEV_BIN = os.environ.get('FFDEV_BIN', 'firefox'); GECKODRIVER = os.environ.get('GECKODRIVER', 'geckodriver')
PALS = {2: ['#2f6ea5', '#f2c14e'], 3: ['#1b263b', '#e0e1dd', '#e63946'], 4: ['#F5E1D5', '#DCF0E4', '#F1E2F3', '#7B2CBF'], 5: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51']}
SVG_SCENES = ['web', 'poster', 'room', 'outfit', 'dash']
fails = []
def check(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

opts = Options()
opts.binary_location = FFDEV_BIN
opts.add_argument('-headless')
for k, v in {'dom.events.testing.asyncClipboard': True, 'dom.events.asyncClipboard.readText': True,
             'dom.events.asyncClipboard.clipboardItem': True, 'devtools.console.stdout.content': True}.items():
    opts.set_preference(k, v)
drv = webdriver.Firefox(service=Service(GECKODRIVER, log_output=os.path.join(OUT, 'geckodriver.log')), options=opts)
drv.set_window_size(1280, 860)
ua = drv.execute_script('return navigator.userAgent')
print('UA', ua)
drv.get(URL)
_raw = drv.execute_script
_raw("const sc=document.createElement('script');sc.textContent='window.__eval=function(c,a){return (0,eval)(c)}';document.head.appendChild(sc);")
def js(code, *args):
    # run in the page's own global (sees top-level const/let); `arguments[0]` -> `a`
    code = code.replace('arguments[0]', '__a')
    wrapped = ('(function(__a){' + code + '})(window.__arg)') if 'return ' in code or ';' in code else code
    return _raw("window.__arg=arguments[0];return JSON.parse(JSON.stringify(window.__eval(arguments[1])??null));", args[0] if args else None, wrapped)
def js_async(code, *args):
    return drv.execute_async_script(code, *args)
# capture errors from inside the page
js("""window.__errs=[];window.addEventListener('error',e=>__errs.push('ERR '+e.message));window.addEventListener('unhandledrejection',e=>__errs.push('REJ '+e.reason));
const ce=console.error.bind(console),cw=console.warn.bind(console);console.error=(...a)=>{__errs.push('console.error '+a.join(' '));ce(...a)};console.warn=(...a)=>{__errs.push('console.warn '+a.join(' '));cw(...a)};""")
js("localStorage.clear();S.theme='light';S.mode='generate';S.view='multi';S.type='Complementary';S.color='#2f6ea5';save();applyTheme();applyMode();buildTypeList();setColor(S.color,true);render();")
time.sleep(0.3)
first = js("return collection().items.findIndex(p=>p.colors.length>=4)")
btns = drv.find_elements(By.CSS_SELECTOR, '.pal')[first].find_elements(By.XPATH, ".//button[contains(.,'Preview')]")
btns[0].click(); time.sleep(0.3)
check(len(drv.find_elements(By.CSS_SELECTOR, '.pv-box')) == 1, 'preview dialog opens')
check(len(drv.find_elements(By.CSS_SELECTOR, '.pv-tabs button')) == 7, 'seven scene tabs incl. Text')
def tab(s): drv.find_element(By.CSS_SELECTOR, f'.pv-tabs button[data-scene="{s}"]').click(); time.sleep(0.15)
def shuffle(): drv.find_element(By.CSS_SELECTOR, '#pvShuffle').click(); time.sleep(0.05)
def base(b): drv.find_element(By.CSS_SELECTOR, f'.pv-tools .seg button[data-base="{b}"]').click(); time.sleep(0.05)
STAGE = "return document.querySelector('.pv-stage').innerHTML"
TOHEX = "const toHex=s=>'#'+s.match(/\\d+/g).slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join('');"

# 1. dark-mode counter contrast
js("S.theme='dark';save();applyTheme();")
cc = js(TOHEX + "const e=document.querySelector('.pv-head .counter');const cs=getComputedStyle(e);const panel=getComputedStyle(document.querySelector('.pv-box')).backgroundColor;return [cs.color,panel,contrast(toHex(cs.color),toHex(panel))];")
check(cc[2] >= 4.5, f'dark-mode counter contrast {cc[2]:.2f}:1 ({cc[0]} on {cc[1]})')
drv.save_screenshot(os.path.join(OUT, 'ffdev_dark_counter.png'))
js("S.theme='light';save();applyTheme();")

# 2. Light/Dark after 1..10 shuffles, every mode
tab('web')
for mode in ('normal', 'precise', 'exact'):
    js("const m=arguments[0];pv.precise=m!=='normal';for(const k in pv.exact)pv.exact[k]=m==='exact';pv.shuffle=0;renderPreview();", mode)
    bad = []
    for n in range(1, 11):
        shuffle(); base('dark'); d = js(STAGE)
        pressed = js("return document.querySelector('.pv-tools .seg button[data-base=dark]').getAttribute('aria-pressed')")
        base('light'); l = js(STAGE)
        if d == l or pressed != 'true': bad.append(n)
    check(not bad, f'{mode}: Light/Dark change the scene after 1..10 shuffles' + (f' (failed at {bad})' if bad else ''))

# 3. Precise: every exact hex present, 2..5 colours, both exact modes, every SVG scene + text
orig = js("return collection().items[pv.idx].colors.slice()")
MISSING = """const p=collection().items[pv.idx];const html=document.querySelector('.pv-stage').innerHTML.toLowerCase();
 const chips=[...document.querySelectorAll('.pv-role')].map(e=>e.dataset.hex.toLowerCase());
 const rgb=c=>{const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);return `rgb(${r}, ${g}, ${b})`;};
 return {stage:p.colors.filter(c=>{c=c.toLowerCase();return !html.includes(c)&&!html.includes(rgb(c));}), chips:p.colors.filter(c=>!chips.includes(c.toLowerCase()))};"""
for mode in ('precise', 'exact'):
    for n, cols in PALS.items():
        js("collection().items[pv.idx].colors=arguments[0];", cols)
        js("const m=arguments[0];pv.precise=true;for(const k in pv.exact)pv.exact[k]=m==='exact';pv.shuffle=0;renderPreview();", mode)
        for sid in SVG_SCENES + ['text']:
            tab(sid)
            for b in ('light', 'dark'):
                base(b)
                for k in range(3):
                    m = js(MISSING)
                    check(not m['stage'] and not m['chips'], f'{mode} {sid} {n} {b} shuffle{k}: all exact hexes in scene + chips' + ('' if not (m['stage'] or m['chips']) else f' missing {m}'))
                    if sid == 'text' and k == 0 and b == 'light':
                        lv = js("return [...document.querySelectorAll('.pv-text h1,.pv-text h2,.pv-text h3,.pv-text p')].length")
                        want = {2:1,3:2,4:3,5:5}[n]
                        check(lv == want if mode == 'exact' else True, f'{mode} text {n}: {lv} text levels' + (f' (want {want})' if mode == 'exact' else ''))
                    shuffle()
        if mode == 'exact' and n == 4:
            tab('web'); base('light'); drv.save_screenshot(os.path.join(OUT, f'ffdev_exact_{n}.png'))
js("collection().items[pv.idx].colors=arguments[0];pv.precise=false;for(const k in pv.exact)pv.exact[k]=false;pv.shuffle=0;renderPreview();", orig)
base('light')
# Precise toggle disabled on photo
tab('photo'); check(js("const e=document.querySelector('#pvPrecise');return !e||e.disabled||getComputedStyle(e.closest('label')).display==='none'"), 'Precise control unavailable on Your photo')

# 4. Text scene: fonts actually load in this Gecko build
tab('text')
nf = js("return PV_FONTS.length")
opts_n = len(drv.find_elements(By.CSS_SELECTOR, '#pvFont option'))
check(opts_n == nf + 1, f'font picker has {opts_n} options for {nf} fonts')
from selenium.webdriver.support.ui import Select
ids = js("return PV_FONTS.map(f=>f.id)")
notloaded = []
for fid in ids:
    Select(drv.find_element(By.CSS_SELECTOR, '#pvFont')).select_by_value(fid); time.sleep(0.05)
    r = js_async("""const fid=arguments[0];const cb=arguments[arguments.length-1];const f=window.__eval('PV_FONTS').find(x=>x.id===fid);
      document.fonts.ready.then(()=>{const fam=getComputedStyle(document.querySelector('.pv-tx-display')).fontFamily;
        cb([document.fonts.check('16px "'+f.family+'"'), fam.includes(f.family), [...document.fonts].some(ff=>ff.family.replace(/"/g,'')===f.family&&ff.status==='loaded')]);});""", fid)
    if not (r[0] and r[1] and r[2]): notloaded.append((fid, r))
check(not notloaded, f'all {nf} embedded fonts load and apply in Dev Edition' + (f' — problems: {notloaded}' if notloaded else ''))
Select(drv.find_element(By.CSS_SELECTOR, '#pvFont')).select_by_value('lora'); time.sleep(0.2)
drv.save_screenshot(os.path.join(OUT, 'ffdev_text_lora.png'))
drv.find_element(By.CSS_SELECTOR, '#pvEditText').click(); time.sleep(0.1)
f = drv.find_element(By.CSS_SELECTOR, '[data-field="heading"]'); f.clear(); f.send_keys('Edited heading')
check(drv.find_element(By.CSS_SELECTOR, '.pv-tx-heading').text == 'Edited heading', 'typing updates the heading live')
drv.find_element(By.CSS_SELECTOR, '#pvResetText').click()
check(drv.find_element(By.CSS_SELECTOR, '.pv-tx-heading').text == 'Every palette tells a story', 'Reset text restores sample copy')
drv.find_element(By.CSS_SELECTOR, '#pvEditText').click()

# 5. swatches
sw = js("return [...document.querySelectorAll('.pv-sub .pv-sw')].map(b=>({hex:b.dataset.hex,alt:b.querySelector('img').alt}))")
cols = js("return collection().items[pv.idx].colors.map(c=>c.toUpperCase())")
check([s['hex'].upper() for s in sw] == cols and all(s['alt'].upper() == s['hex'].upper() for s in sw), f'{len(sw)} swatches with hex alt text')
check('#' not in drv.find_element(By.CSS_SELECTOR, '.pv-sub').text, 'no hex list in subtitle text')
drv.find_elements(By.CSS_SELECTOR, '.pv-sub .pv-sw')[0].click(); time.sleep(0.3)
copied = js("return document.querySelector('.pv-sub .pv-sw').classList.contains('copied')")
clip = js_async("const cb=arguments[arguments.length-1];navigator.clipboard.readText().then(cb,e=>cb('ERR '+e))")
check(copied, 'swatch click shows copied feedback')
check(str(clip).upper() == cols[0], f'clipboard holds {clip} (expected {cols[0]})')

# keyboard stepping + Esc
tab('web'); js("pv.idx=0;renderPreview();")
drv.find_element(By.CSS_SELECTOR, 'body').send_keys(Keys.ARROW_RIGHT); time.sleep(0.1)
check(js("return pv.idx") == 1, 'ArrowRight steps palette')
drv.find_element(By.CSS_SELECTOR, 'body').send_keys(Keys.ESCAPE); time.sleep(0.2)
check(len(drv.find_elements(By.CSS_SELECTOR, '.pv-box')) == 0, 'Esc closes the preview')

errs = js("return window.__errs")
print('PAGE ERRORS', errs)
print('FAILS', fails)
drv.quit()
sys.exit(1 if fails or errs else 0)
