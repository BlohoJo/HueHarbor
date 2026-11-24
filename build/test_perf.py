"""Photo-effect performance benchmark (Preview → "Your photo") with a large 4000×3000 image.

Measures, inside the page with performance.now():
  * load            – file chosen → decoded, prepared and first render on screen (includes PNG decode)
  * poster_first    – first Posterize render for the loaded photo (click on the effect button)
  * palette_switch  – Next palette (full modal re-render incl. the photo pass)
  * intensity       – slider input → pixels updated (latency) and the pure render work
  * gradient / duo  – switching to the other effects
  * export          – Download PNG → blob handed to the browser (full-resolution PNG encode included)
Works on both the old and the new pipeline because it only wraps the global entry points
(pvRenderPhoto, pvDownload, downloadBlob).  BROWSER=firefox python3 build/test_perf.py
"""
import os, sys, struct, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import BROWSER, IS_FIREFOX, launch_kwargs, context_kwargs, browser_type, shot, FIXTURES
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'palette_picker.html')
BIG = os.path.join(FIXTURES, 'big_photo.png')
W, H = 4000, 3000
errors, fails = [], []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

if not os.path.exists(BIG):
    import numpy as np
    from PIL import Image
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    rng = np.random.default_rng(7)
    r = 128 + 100 * np.sin(x / 300) * np.cos(y / 220)
    g = 128 + 110 * np.cos((x + y) / 410)
    b = 128 + 120 * np.sin(y / 180 + x / 900)
    img = np.stack([r, g, b], -1) + rng.normal(0, 14, (H, W, 3))
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(BIG, compress_level=1)
    print('generated', BIG)

INSTRUMENT = """()=>{
  window.__perf={renders:0,renderMs:0,last:0,dl:null,t0:0};
  const orig=pvRenderPhoto; pvRenderPhoto=function(cv,colors){const t=performance.now();const r=orig(cv,colors);const d=performance.now()-t;__perf.renders++;__perf.renderMs+=d;__perf.last=d;__perf.tEnd=performance.now();return r;};
  const od=downloadBlob; downloadBlob=function(b,n){__perf.dl={ms:performance.now()-__perf.t0,size:b.size,name:n};return od(b,n);};
}"""
RESET = "()=>{__perf.renders=0;__perf.renderMs=0;}"
TIMED_CLICK = "sel=>{const el=document.querySelector(sel);const t=performance.now();el.click();return performance.now()-t;}"
WAIT_RENDER = """n=>new Promise(res=>{const t=performance.now();(function poll(){if(__perf.renders>=n)res(performance.now()-t);else requestAnimationFrame(poll);})();})"""

results = {}
with sync_playwright() as pw:
    print('browser', BROWSER)
    br = browser_type(pw).launch(**launch_kwargs())
    ctx = br.new_context(**context_kwargs(accept_downloads=True))
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    page.goto(URL); page.wait_for_selector('.pal')
    page.evaluate("()=>{localStorage.clear();S.theme='light';S.mode='generate';S.view='multi';S.type='Tetradic (Square)';S.color='#2f6ea5';save();applyTheme();applyMode();buildTypeList();setColor(S.color,true);render();}")
    page.wait_for_selector('.pal')
    page.evaluate(INSTRUMENT)
    first = page.evaluate("()=>collection().items.findIndex(p=>p.colors.length>=4)")
    page.evaluate("i=>{pv.effect='gradient';openPreview(i,PV_SCENES.findIndex(s=>s[0]==='photo'));}", first)
    page.wait_for_selector('.pv-stage canvas')
    # --- load the big photo (gradient effect active) ---
    page.evaluate("()=>{__perf.renders=0;document.querySelector('#pvFile').addEventListener('change',()=>{__perf.tLoad=performance.now();},{capture:true});}")
    page.set_input_files('#pvFile', BIG)
    page.wait_for_selector('.pv-tools button:has-text("Use sample")', timeout=60000)
    page.wait_for_function("()=>__perf.renders>=1", timeout=60000)
    results['load_to_first_render'] = page.evaluate("()=>__perf.tEnd-__perf.tLoad")
    results['first_render_work'] = page.evaluate("()=>__perf.last")
    # --- first posterize ---
    results['poster_first_click'] = page.evaluate(TIMED_CLICK, '.pv-tools .seg button[data-effect="poster"]')
    results['poster_first_work'] = page.evaluate("()=>__perf.last")
    page.screenshot(path=shot('perf_poster.png'))
    # --- palette switch (Next) while posterized ---
    results['palette_switch_click'] = page.evaluate(TIMED_CLICK, '#pvNext')
    results['palette_switch_work'] = page.evaluate("()=>__perf.last")
    results['palette_switch2_click'] = page.evaluate(TIMED_CLICK, '#pvNext')
    results['palette_switch2_work'] = page.evaluate("()=>__perf.last")
    # --- intensity slider: 5 updates, measure latency to pixels + work per update ---
    lat, work = [], []
    for v in (80, 60, 40, 20, 50):
        n = page.evaluate("()=>__perf.renders")
        t = page.evaluate("v=>{const el=document.querySelector('.pv-range input');const t=performance.now();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));return performance.now()-t;}", v)
        lat.append(t + page.evaluate(WAIT_RENDER, n + 1)); work.append(page.evaluate("()=>__perf.last"))
    results['intensity_latency_max'] = max(lat); results['intensity_work_avg'] = sum(work) / len(work)
    # rapid burst: 30 input events, count how many renders actually ran
    n = page.evaluate("()=>__perf.renders")
    burst = page.evaluate("""()=>{const el=document.querySelector('.pv-range input');const t=performance.now();for(let i=0;i<30;i++){el.value=30+i*2;el.dispatchEvent(new Event('input',{bubbles:true}));}return performance.now()-t;}""")
    page.evaluate(WAIT_RENDER, n + 1); page.wait_for_timeout(100)
    results['burst30_dispatch'] = burst; results['burst30_renders'] = page.evaluate("()=>__perf.renders") - n
    pct = page.evaluate("()=>document.querySelector('.pv-range input').value")
    check(pct == '88', f'slider value after burst is 88 ({pct})')
    # --- other effects ---
    results['gradient_click'] = page.evaluate(TIMED_CLICK, '.pv-tools .seg button[data-effect="gradient"]')
    results['duo_click'] = page.evaluate(TIMED_CLICK, '.pv-tools .seg button[data-effect="duo"]')
    results['poster_again_click'] = page.evaluate(TIMED_CLICK, '.pv-tools .seg button[data-effect="poster"]')
    # --- export ---
    page.evaluate("()=>{__perf.t0=performance.now();__perf.dl=null;}")
    with page.expect_download(timeout=120000) as dl:
        page.click('#pvDownload')
    d = dl.value; path = os.path.join(ROOT, 'shots', 'firefox' if IS_FIREFOX else '', 'exports', d.suggested_filename)
    os.makedirs(os.path.dirname(path), exist_ok=True); d.save_as(path); data = open(path, 'rb').read()
    w, hh = struct.unpack('>II', data[16:24])
    results['export_ms'] = page.evaluate("()=>__perf.dl&&__perf.dl.ms")
    results['export_px'] = f'{w}x{hh}'; results['export_bytes'] = len(data)
    check(data[:8] == b'\x89PNG\r\n\x1a\n', f'export is a PNG {w}x{hh} {len(data)} bytes')
    results['export_via'] = page.evaluate("()=>pv.exportVia||'n/a'")
    results['busy_cleared_after_export'] = page.evaluate("()=>pv.busy!==true")
    br.close()

print('\nRESULTS (' + BROWSER + ')')
for k, v in results.items():
    print(f'  {k:28s} {v:9.1f} ms' if isinstance(v, float) else f'  {k:28s} {v}')
json.dump(results, open(os.path.join(FIXTURES, f'perf-{BROWSER}.json'), 'w'), indent=1)
print('ERRORS', errors)
print('FAILS', fails)
sys.exit(1 if errors or fails else 0)
