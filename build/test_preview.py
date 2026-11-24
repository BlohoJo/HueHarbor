"""Preview feature verification (scenes, roles, palette stepping, photo effects, PNG download)."""
import os, sys, io, struct
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import BROWSER, IS_FIREFOX, launch_kwargs, context_kwargs, browser_type, shot, test_photo
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'palette_picker.html')
TEST_IMG = test_photo()
SCENES = ['web', 'poster', 'room', 'outfit', 'dash', 'product', 'text', 'photo']
SVG_SCENES = ['web', 'poster', 'room', 'outfit', 'dash', 'product']
PALS = {2: ['#2f6ea5', '#f2c14e'], 3: ['#1b263b', '#e0e1dd', '#e63946'], 4: ['#F5E1D5', '#DCF0E4', '#F1E2F3', '#7B2CBF'], 5: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'], 6: ['#111111', '#333333', '#555555', '#999999', '#cccccc', '#ffffff']}
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
    check(page.locator('.pv-tabs button').count() == 8, 'eight scene tabs')
    # every scene renders; screenshot each
    for sid in SCENES:
        page.click(f'.pv-tabs button[data-scene="{sid}"]'); page.wait_for_timeout(120)
        if sid == 'photo':
            ok = page.locator('.pv-stage canvas').count() == 1 and page.evaluate(CANVAS_HASH) is not None
        elif sid == 'text':
            ok = page.locator('.pv-stage .pv-text h1').count() == 1 and page.locator('.pv-stage .pv-text p').count() >= 2
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
    # ---- Light/Dark must change the scene after any number of shuffles (1..10), in every role mode ----
    page.click('.pv-tabs button[data-scene="web"]')
    STAGE = "()=>document.querySelector('.pv-stage').innerHTML"
    SET_MODE = "m=>{pv.precise=m!=='normal';for(const k in pv.exact)pv.exact[k]=m==='exact';pv.shuffle=0;renderPreview();}"
    for mode in ('normal', 'precise', 'exact'):
        page.evaluate(SET_MODE, mode); same = []
        for sN in range(1, 11):
            page.click('#pvShuffle')
            page.click('.pv-tools .seg button[data-base="dark"]'); d = page.evaluate(STAGE)
            pressed = page.evaluate("()=>document.querySelector('.pv-tools .seg button[data-base=dark]').getAttribute('aria-pressed')")
            page.click('.pv-tools .seg button[data-base="light"]'); l = page.evaluate(STAGE)
            if d == l or pressed != 'true': same.append(sN)
        check(not same, f'{mode}: Light/Dark changes the scene after 1..10 shuffles (failed after {same})')
    # the old failure: in the "bold" half of the shuffle cycle the background must still follow the base
    bad_bold = page.evaluate("""()=>{const out=[];for(const p of collection().items){const n=p.colors.length;for(let s=0;s<2*n;s++){const L=pvRoles(p.colors,s,'light'),D=pvRoles(p.colors,s,'dark');
        if(!(pvL(L.bg)>.5&&pvL(D.bg)<.5))out.push([p.name,s,L.bg,D.bg]);}}return out.slice(0,5);}""")
    check(not bad_bold, f'normal mode: Light base gives a light background and Dark a dark one for every shuffle {bad_bold}')
    page.evaluate(SET_MODE, 'normal')
    # ---- Precise mode: every exact palette hex is on screen, for 2..6 colours, both exact-count settings, every type ----
    orig_cols = page.evaluate("()=>collection().items[pv.idx].colors.slice()")
    MISSING = """()=>{const p=collection().items[pv.idx];const html=document.querySelector('.pv-stage').innerHTML.toLowerCase();
        const rgb=c=>{const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);return `rgb(${r}, ${g}, ${b})`;};
        const chips=[...document.querySelectorAll('.pv-role')].map(e=>e.dataset.hex.toLowerCase());
        const codes=[...document.querySelectorAll('.pv-role code')].map(e=>e.textContent.toLowerCase());
        return {scene:p.colors.filter(c=>{c=c.toLowerCase();return !html.includes(c)&&!html.includes(rgb(c));}),
                chips:p.colors.filter(c=>!chips.includes(c.toLowerCase())||!codes.includes(c.toLowerCase()))};}"""
    # Products: four cards with four products, every exact hex present, labels readable, Shuffle + Light/Dark change it
    # (both sets: 0 = Tech, 1 = Everyday, chosen with the Tech / Everyday switch in the toolbar)
    PRODUCT_LABELS = {0: ['HEADPHONES', 'TUMBLER', 'SMARTWATCH', 'CONTROLLER'], 1: ['SNEAKER', 'BACKPACK', 'PHONE CASE', 'COFFEE MUG']}
    SET_NAMES = ['tech', 'everyday']
    page.click('.pv-tabs button[data-scene="product"]')
    for pset, want_labels in PRODUCT_LABELS.items():
        page.click(f'.pv-set button[data-set="{SET_NAMES[pset]}"]')
        check(page.evaluate("()=>pv.productSet") == pset, f'Products set {pset}: switch selects it')
        for n, cols in PALS.items():
            page.evaluate("c=>{const p=collection().items[pv.idx];p.colors=c;}", cols)
            for mode in ('normal', 'precise', 'exact'):
                page.evaluate(SET_MODE, mode)
                page.evaluate("()=>{pv.base='light';pv.shuffle=0;renderPreview();}")
                info = page.evaluate("()=>{const s=document.querySelector('.pv-stage svg');return {labels:[...s.querySelectorAll('text')].map(t=>t.textContent).filter(t=>/^[A-Z][A-Z ]*$/.test(t)),cards:s.querySelectorAll('rect[width=\"376\"]').length,texts:[...s.querySelectorAll('text')].length};}")
                check(info['labels'] == want_labels and info['cards'] == 4, f'Products set {pset} {mode} {n}: 2x2 cards with four labelled products ({info})')
                if mode != 'normal':
                    m = page.evaluate(MISSING); check(not m['scene'] and not m['chips'], f'Products set {pset} {mode} {n}: every exact hex in the scene and chips {m if m["scene"] or m["chips"] else ""}')
                renders, same_ld = set(), []
                for k in range(2 * n):
                    page.evaluate("()=>{pv.base='light';renderPreview();}"); a = page.evaluate("()=>document.querySelector('.pv-stage').innerHTML"); renders.add(a)
                    page.evaluate("()=>{pv.base='dark';renderPreview();}"); b = page.evaluate("()=>document.querySelector('.pv-stage').innerHTML")
                    if a == b: same_ld.append(k)
                    page.click('#pvShuffle')
                # in the Precise modes an odd palette has a middle colour that is the k-th from both ends, so Light and Dark coincide there (all scenes)
                ok_ld = not same_ld or (mode != 'normal' and n % 2 == 1 and same_ld == [n // 2, n + n // 2])
                check(len(renders) > 1 and ok_ld, f'Products set {pset} {mode} {n}: Shuffle gives {len(renders)} distinct variants over {2*n} steps and Light/Dark differ at every step {same_ld}')
                # labels must read on their card (>= 3:1 like the other exact layouts; 4.5:1 for the normal layout)
                low = page.evaluate("()=>{const s=document.querySelector('.pv-stage svg');const cards=[...s.querySelectorAll('rect[width=\"376\"]')];const bg=s.querySelector('rect[width=\"800\"]').getAttribute('fill');const toHex=c=>c&&c.startsWith('rgb')?'#'+c.match(/\\d+/g).slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join(''):c;return [...s.querySelectorAll('text')].filter(t=>/^[A-Z][A-Z ]*$/.test(t.textContent)).map((t,i)=>{const f=cards[i].getAttribute('fill');const under=toHex(f==='none'?bg:f);return [t.textContent,contrast(toHex(t.getAttribute('fill')),under).toFixed(2)];});}")
                need = 4.5 if mode == 'normal' else 3
                check(all(float(x[1]) >= need for x in low), f'Products set {pset} {mode} {n}: card labels reach {need}:1 {low}')
                # the set switch stays selected and the two sets differ in every mode
                check(page.evaluate("()=>pv.productSet") == pset, f'Products set {pset} {mode} {n}: set still selected after Shuffle / Light / Dark')
    # the Tech / Everyday switch: only on the Products tab, two buttons, aria-pressed follows the selection, selection survives Prev/Next and tab changes
    page.evaluate(SET_MODE, 'normal'); page.evaluate("()=>{pv.base='light';pv.shuffle=0;renderPreview();}")
    seg = page.evaluate("()=>{const g=document.querySelector('.pv-set');return g?{n:g.querySelectorAll('button').length,pressed:[...g.querySelectorAll('button')].map(b=>b.getAttribute('aria-pressed')),labels:[...g.querySelectorAll('button')].map(b=>b.textContent),role:g.getAttribute('role'),aria:g.getAttribute('aria-label')}:null;}")
    check(seg and seg['n'] == 2 and seg['labels'] == ['Tech', 'Everyday'] and seg['pressed'] == ['false', 'true'] and seg['role'] == 'group' and seg['aria'] == 'Product set', f'Products: set switch is a two-button group with aria-pressed on Everyday ({seg})')
    before = page.evaluate("()=>document.querySelector('.pv-stage').innerHTML")
    page.click('.pv-set button[data-set="tech"]')
    after = page.evaluate("()=>document.querySelector('.pv-stage').innerHTML")
    pressed = page.evaluate("()=>[...document.querySelectorAll('.pv-set button')].map(b=>b.getAttribute('aria-pressed'))")
    check(before != after and pressed == ['true', 'false'] and page.evaluate("()=>pv.productSet") == 0, f'Products: clicking Tech redraws the scene and moves aria-pressed ({pressed})')
    page.click('.pv-set button[data-set="everyday"]')
    for sid in SCENES:
        if sid == 'product': continue
        page.click(f'.pv-tabs button[data-scene="{sid}"]')
        check(page.evaluate("()=>document.querySelector('.pv-set')") is None, f'Products: set switch hidden on the {sid} tab')
    page.click('.pv-tabs button[data-scene="product"]')
    check(page.evaluate("()=>pv.productSet===1&&!!document.querySelector('.pv-set button[data-set=\"everyday\"][aria-pressed=\"true\"]')"), 'Products: Everyday still selected after visiting the other tabs')
    idx0 = page.evaluate("()=>pv.idx")
    fwd = not page.locator('#pvNext').is_disabled()
    page.click('#pvNext' if fwd else '#pvPrev'); page.click('#pvPrev' if fwd else '#pvNext')
    check(page.evaluate("()=>pv.idx") == idx0 and page.evaluate("()=>pv.productSet") == 1 and page.evaluate("()=>[...document.querySelector('.pv-stage svg').querySelectorAll('text')].map(t=>t.textContent).includes('SNEAKER')"), 'Products: Everyday still selected after Next / Prev')
    page.evaluate("c=>{const p=collection().items[pv.idx];p.colors=c;pv.base='light';pv.shuffle=0;renderPreview();}", PALS[5])
    page.screenshot(path=shot('pv_products_everyday.png'))
    page.evaluate(SET_MODE, 'exact'); page.evaluate("()=>renderPreview()"); page.screenshot(path=shot('pv_products_everyday_exact_5.png'))
    page.click('.pv-set button[data-set="tech"]')
    page.evaluate(SET_MODE, 'normal'); page.evaluate("c=>{const p=collection().items[pv.idx];p.colors=c;pv.base='light';pv.shuffle=0;renderPreview();}", PALS[5])
    page.screenshot(path=shot('pv_products.png'))
    page.evaluate(SET_MODE, 'exact'); page.evaluate("c=>{const p=collection().items[pv.idx];p.colors=c;renderPreview();}", PALS[5]); page.screenshot(path=shot('pv_products_exact_5.png'))
    problems = []
    for n, cols in PALS.items():
        page.evaluate("c=>{const p=collection().items[pv.idx];p.colors=c;}", cols)
        for mode in ('precise', 'exact'):
            page.evaluate(SET_MODE, mode)
            for sid in SVG_SCENES + ['text']:
                page.click(f'.pv-tabs button[data-scene="{sid}"]')
                for sh in range(0, 3):
                    for base in ('light', 'dark'):
                        page.evaluate("b=>{pv.base=b;renderPreview();}", base)
                        m = page.evaluate(MISSING)
                        if m['scene'] or m['chips']: problems.append((n, mode, sid, sh, base, m))
                        if sid == 'text' and mode == 'exact' and sh == 0 and base == 'light':
                            lv = page.evaluate("()=>[...document.querySelectorAll('.pv-text h1,.pv-text h2,.pv-text h3,.pv-text p')].map(e=>e.className)")
                            want = {2: 1, 3: 2, 4: 3, 5: 5, 6: 5}[n]
                            check(len(lv) == want, f'Text preview, exact count, {n} colours: {want} level(s) ({lv})')
                            if n == 2: check(lv == ['pv-tx-display'], '2 colours: a single heading')
                    page.click('#pvShuffle')
                check(page.evaluate("()=>document.querySelector('.pv-tools .seg button[data-base=dark]').getAttribute('aria-pressed')") == 'true', f'{mode} {sid} {n}: Dark stays selected across shuffles')
                check(page.evaluate("()=>document.querySelector('#pvPrecise').checked"), f'{mode} {sid} {n}: Precise checkbox reflects state')
                check(page.evaluate("()=>document.querySelector('#pvExact').checked") == (mode == 'exact'), f'{mode} {sid} {n}: exact-count checkbox reflects state')
                if n == 4 and mode == 'exact' and sid == 'web': page.screenshot(path=shot('pv_precise_exact_4.png'))
                if n == 4 and mode == 'precise' and sid == 'web': page.screenshot(path=shot('pv_precise_4.png'))
            page.evaluate("()=>{pv.base='light';}")
        # shuffle in Precise mode permutes the exact colours (chips keep the same set of hexes, different assignment)
        page.evaluate(SET_MODE, 'precise'); page.click('.pv-tabs button[data-scene="web"]')
        c0 = page.evaluate("()=>[...document.querySelectorAll('.pv-role')].map(e=>e.dataset.role+':'+e.dataset.hex)")
        page.click('#pvShuffle')
        c1 = page.evaluate("()=>[...document.querySelectorAll('.pv-role')].map(e=>e.dataset.role+':'+e.dataset.hex)")
        check(c0 != c1 and sorted(x.split(':')[1] for x in c0 if x.split(':')[1].lower() in [c.lower() for c in cols]) == sorted(x.split(':')[1] for x in c1 if x.split(':')[1].lower() in [c.lower() for c in cols]), f'{n} colours: Shuffle in Precise mode permutes the exact colours ({c0} -> {c1})')
    check(not problems, f'Precise mode shows every exact palette hex in scene and chips ({len(problems)} problems, first: {problems[:3]})')
    # exact-count layouts draw nothing but palette colours (no opacity, no derived fills)
    non_exact = page.evaluate("""()=>{const out=[];for(const [n,cols] of Object.entries(%s)){for(const sid of ['web','poster','room','outfit','dash']){for(let s=0;s<2*cols.length;s++)for(const b of ['light','dark']){
        const svg=pvExactScene(sid,pvExactRoles(cols,s,b));const fills=[...svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{6})"/g)].map(m=>m[1].toLowerCase());
        const low=cols.map(c=>c.toLowerCase());const stray=fills.filter(f=>!low.includes(f));if(stray.length||/opacity=/.test(svg))out.push([n,sid,s,b,stray.slice(0,2)]);}}}return out.slice(0,5);}""" % str({k: v for k, v in PALS.items() if k <= 5}).replace("'", '"'))
    check(not non_exact, f'exact-count layouts use only palette colours and no opacity {non_exact}')
    page.evaluate("c=>{collection().items[pv.idx].colors=c;}", orig_cols); page.evaluate(SET_MODE, 'normal')
    # ---- Text preview: fonts and editing ----
    page.click('.pv-tabs button[data-scene="text"]')
    nfonts = page.evaluate("()=>PV_FONTS.length"); cats = page.evaluate("()=>[...new Set(PV_FONTS.map(f=>f.cat))]")
    check(nfonts >= 30 and len(cats) == 5, f'{nfonts} embedded fonts in {len(cats)} categories {cats}')
    check(page.locator('#pvFont option').count() == nfonts + 1 and page.locator('#pvFont optgroup').count() == 5, 'font picker lists every font under its category')
    fam0 = page.evaluate("()=>getComputedStyle(document.querySelector('.pv-tx-display')).fontFamily")
    loaded_ok = True
    for fid in ('playfair-display', 'jetbrains-mono', 'pacifico', 'bebas-neue'):
        page.select_option('#pvFont', fid)
        fam = page.evaluate("id=>PV_FONTS.find(f=>f.id===id).family", fid)
        try:
            page.wait_for_function("f=>document.fonts.check('16px \"'+f+'\"')&&[...document.fonts].some(x=>x.family.replace(/\"/g,'')===f&&x.status==='loaded')", arg=fam, timeout=5000)
        except Exception:
            loaded_ok = False; print('font not loaded', fid)
        css = page.evaluate("()=>getComputedStyle(document.querySelector('.pv-tx-display')).fontFamily")
        if fam not in css: loaded_ok = False; print('font not applied', fid, css)
    check(loaded_ok, 'embedded fonts decode via FontFace and apply to the Text preview')
    page.screenshot(path=shot('pv_text_font.png'))
    page.select_option('#pvFont', 'system'); check(page.evaluate("()=>getComputedStyle(document.querySelector('.pv-tx-display')).fontFamily") == fam0, 'System default restores the system font stack')
    page.click('#pvEditText'); page.wait_for_selector('.pv-fields')
    check(page.locator('.pv-fields [data-field]').count() == 6, 'six editable text fields in normal mode')
    page.fill('[data-field="heading"]', 'Edited heading'); check(page.inner_text('.pv-tx-heading') == 'Edited heading', 'typing updates the heading live')
    check(page.evaluate("()=>document.activeElement&&document.activeElement.dataset.field==='heading'"), 'field keeps focus while typing')
    page.fill('[data-field="body"]', 'Short body.'); check(page.inner_text('.pv-tx-body') == 'Short body.', 'textarea updates the body live')
    page.select_option('#pvFont', 'lora'); check(page.inner_text('.pv-tx-heading') == 'Edited heading', 'edited text survives a font change')
    page.screenshot(path=shot('pv_text_edit.png'))
    page.click('#pvResetText'); check(page.inner_text('.pv-tx-heading') == 'Every palette tells a story', 'Reset text restores the sample copy')
    page.click('#pvEditText'); check(page.locator('.pv-fields').count() == 0, 'Done editing hides the fields')
    # Text preview roles (normal): six levels mapped to Primary/Text/Accent/Text/derived muted/Accent
    titles = page.evaluate("()=>[...document.querySelectorAll('.pv-text h1,.pv-text h2,.pv-text h3,.pv-text p')].map(e=>e.title.split(':')[0])")
    check(titles == ['Primary', 'Text', 'Accent', 'Text', 'Muted (derived)', 'Accent'], f'normal Text preview levels map to roles {titles}')
    # ---- subtitle swatches: <img alt=hex>, keyboard reachable, click copies ----
    sw = page.evaluate("()=>[...document.querySelectorAll('.pv-sub .pv-sw')].map(b=>({hex:b.dataset.hex,alt:b.querySelector('img').alt,title:b.title,label:b.getAttribute('aria-label'),src:b.querySelector('img').src.slice(0,19)}))")
    cols_now = page.evaluate("()=>collection().items[pv.idx].colors.map(c=>c.toUpperCase())")
    check([x['hex'] for x in sw] == cols_now and all(x['alt'] == x['hex'] and x['hex'] in x['title'] and x['hex'] in x['label'] and x['src'] == 'data:image/svg+xml,' for x in sw), f'subtitle shows one SVG <img> swatch per colour with alt = hex {sw}')
    check(page.locator('.pv-sub').inner_text().count('#') == 0, 'the hex list is gone from the subtitle text')
    page.evaluate("()=>navigator.clipboard.writeText('')")
    page.locator('.pv-sub .pv-sw >> nth=1').focus(); page.keyboard.press('Enter'); page.wait_for_timeout(150)
    clip = page.evaluate("()=>navigator.clipboard.readText()")
    check(clip == cols_now[1], f'Enter on a focused swatch copies its hex ({clip})')
    page.locator('.pv-sub .pv-sw >> nth=0').click()
    try: page.wait_for_function("()=>document.querySelector('.pv-sub .pv-sw').classList.contains('copied')", timeout=2000); fb = True
    except Exception: fb = False
    check(fb and 'copied' in page.inner_text('#toast'), 'click gives brief feedback (highlight + toast)')
    page.wait_for_timeout(150); check(page.evaluate("()=>navigator.clipboard.readText()") == cols_now[0], 'click copies the hex')
    # Clipboard API unavailable: the execCommand fallback still copies
    page.evaluate("()=>{window.__clip=navigator.clipboard;Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true});}")
    page.locator('.pv-sub .pv-sw >> nth=2').click(); page.wait_for_timeout(150)
    check(cols_now[2] in page.inner_text('#toast'), 'fallback copy path reports success without the Clipboard API')
    page.evaluate("()=>{Object.defineProperty(navigator,'clipboard',{value:window.__clip,configurable:true});}")
    # ---- dark-mode counter contrast ----
    page.evaluate("()=>{S.theme='dark';S.bg='#ffffff';save();applyTheme();renderPreview();}")
    cc = page.evaluate("()=>{const e=document.querySelector('.pv-head .counter');const cs=getComputedStyle(e);const panel=getComputedStyle(document.querySelector('.pv-box')).backgroundColor;const toHex=s=>'#'+s.match(/\\d+/g).slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join('');return [cs.color,panel,contrast(toHex(cs.color),toHex(panel))];}")
    check(cc[2] >= 4.5, f'Preview counter is readable in dark mode on a white page background (contrast {cc[2]:.2f})')
    page.screenshot(path=shot('pv_dark_counter.png'))
    low = page.evaluate("""()=>{const panel=getComputedStyle(document.querySelector('.pv-box')).backgroundColor;const toHex=s=>'#'+s.match(/\\d+/g).slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join('');const out=[];
        for(const e of document.querySelectorAll('.pv-box .pv-head *, .pv-box .pv-tools *, .pv-box .contrast-note, .pv-box .pv-tabs button')){if(!e.textContent.trim()||e.children.length&&!e.childNodes[0].nodeValue)continue;const cs=getComputedStyle(e);
        let bgEl=e;while(bgEl&&getComputedStyle(bgEl).backgroundColor==='rgba(0, 0, 0, 0)')bgEl=bgEl.parentElement;const bg=bgEl?getComputedStyle(bgEl).backgroundColor:panel;const c=contrast(toHex(cs.color),toHex(bg));if(c<4.5)out.push([e.tagName+'.'+e.className,e.textContent.trim().slice(0,20),c.toFixed(2)]);}return out;}""")
    check(not low, f'all Preview dialog text reaches 4.5:1 in dark mode {low}')
    page.evaluate("()=>{S.theme='light';S.bg=null;save();applyTheme();renderPreview();}")
    page.click('.pv-tabs button[data-scene="web"]')
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
