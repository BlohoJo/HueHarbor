"""Magnify window verification: pattern list and order, the Diagonal pattern's geometry, the overlay text position
and the contrast-aware colour of its second line, and the old 'Diagonal' -> 'Vertical bars' mapping."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import BROWSER, launch_kwargs, context_kwargs, browser_type, shot, file_url
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = file_url()
errors, fails = [], []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

# Geometry of the overlay: both lines' boxes must lie inside the union of the coloured cells (never over the backing)
OVERLAY = """()=>{const st=document.querySelector('.mag-stage'),sm=st.querySelector('.sample small'),l1=st.querySelector('.sample .light'),l2=st.querySelector('.sample .dark');
 const rg=document.createRange();rg.selectNodeContents(sm);const r=rg.getBoundingClientRect();
 const cells=[...st.querySelectorAll('[data-c]')].map(e=>e.getBoundingClientRect()).filter(b=>b.width);
 const inside=(x,y)=>cells.some(b=>x>=b.left-.5&&x<=b.right+.5&&y>=b.top-.5&&y<=b.bottom+.5);
 const boxes=[r,l1.getBoundingClientRect(),l2.getBoundingClientRect()];
 const pts=boxes.flatMap(b=>[[b.left,b.top],[b.right,b.top],[b.left,b.bottom],[b.right,b.bottom]]);
 const toHex=c=>'#'+c.match(/\\d+/g).slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join('');
 // colours actually under line 2 (hit-tested, the same way the app samples them)
 const under=new Set();for(let i=0;i<=10;i++){const x=r.left+1+(r.width-2)*i/10;for(const y of[r.top+2,(r.top+r.bottom)/2,r.bottom-2]){const e=document.elementsFromPoint(x,y).find(el=>el.dataset&&el.dataset.c&&st.contains(el));under.add(e?e.dataset.c:MAG_BG[mag.bg]);}}
 const col=toHex(getComputedStyle(sm).color);const worst=Math.min(...[...under].map(u=>contrast(col,u)));
 const other=col==='#ffffff'?'#111111':'#ffffff';const worstOther=Math.min(...[...under].map(u=>contrast(other,u)));
 return {inside:pts.every(p=>inside(p[0],p[1])),color:col,worst,worstOther,under:[...under],cells:cells.length,stageBottom:st.getBoundingClientRect().bottom,textBottom:r.bottom};}"""

with sync_playwright() as pw:
    print('browser', BROWSER)
    br = browser_type(pw).launch(**launch_kwargs()); ctx = br.new_context(**context_kwargs()); page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    page.goto(URL); page.wait_for_selector('.pal')
    page.evaluate("()=>{localStorage.clear();S.theme='light';S.mode='generate';S.view='multi';S.type='Complementary';S.color='#2f6ea5';save();applyTheme();applyMode();buildTypeList();setColor(S.color,true);render();}")
    page.locator('.pal >> nth=0 >> button:has-text("Magnify")').click(); page.wait_for_selector('.mag-stage')
    pats = page.evaluate('MAG_PATTERNS')
    check(pats == ['Panels', 'Nested', 'Horizontal bars', 'Vertical bars', 'Diagonal', 'Vertical stripes'], f'six patterns, Diagonal right after Vertical bars {pats}')
    # cycle through the Pattern button and confirm the label follows the list
    seen = []
    for i in range(len(pats)):
        seen.append(page.inner_text('.mag-tools button:has-text("Pattern")').replace('Pattern: ', '')); page.click('.mag-tools button:has-text("Pattern")')
    check(seen == pats and page.evaluate('mag.pattern') == 0, f'Pattern button cycles through all six and wraps {seen}')
    # the user's case: Panels, dark navy palette, white backing -> line 2 must be white and both lines over the panels
    page.evaluate("()=>{const p=collection().items[mag.idx];p.colors=['#25335E','#101040','#477877'];p.name='Classic · template #909';mag.pattern=0;mag.bg=0;mag.rot=0;renderMagnify();}")
    o = page.evaluate(OVERLAY)
    check(o['inside'], f'Panels: both overlay lines lie inside the coloured panels (text bottom {o["textBottom"]:.0f} < stage bottom {o["stageBottom"]:.0f})')
    check(o['color'] == '#ffffff' and o['worst'] >= 4.5, f'Panels on dark navy: line 2 is white with {o["worst"]:.2f}:1 worst-case contrast')
    page.screenshot(path=shot('mag_panels_dark.png'))
    # a light palette -> dark text
    page.evaluate("()=>{const p=collection().items[mag.idx];p.colors=['#F5E1D5','#DCF0E4','#F1E2F3'];renderMagnify();}")
    o = page.evaluate(OVERLAY); check(o['color'] == '#111111' and o['worst'] >= 4.5, f'Panels on pastel palette: line 2 is dark with {o["worst"]:.2f}:1')
    check(page.evaluate("()=>{const s=document.querySelector('.mag-stage .sample small');return !s.classList.contains('on-mixed')&&getComputedStyle(s).textShadow!=='none';}"), 'single-tone palette: subtle shadow only, no strong halo')
    # many-colour palette with dark and light cells under the same line: neither colour reads everywhere, so the strong halo (on-mixed) takes over
    page.evaluate("()=>{const p=collection().items[mag.idx];p.colors=['#003049','#d62828','#f77f00','#fcbf49','#eae2b7','#4a4e69','#9a8c98','#c9ada7'];mag.pattern=3;renderMagnify();}")
    o = page.evaluate(OVERLAY); mx = page.evaluate("()=>{const s=document.querySelector('.mag-stage .sample small');const sh=getComputedStyle(s).textShadow;return {mixed:s.classList.contains('on-mixed'),shadow:sh,halo:(sh.match(/px/g)||[]).length>=6};}")
    check(o['worst'] < 3 and mx['mixed'] and mx['halo'] and o['worst'] + 1e-9 >= o['worstOther'], f'8-colour Vertical bars: worst contrast {o["worst"]:.2f}:1 < 3 -> strong halo ({mx["shadow"][:40]}…) on the better colour {o["color"]}')
    # every pattern x every background x rotations: inside the pattern, and the better of white/dark is chosen
    page.evaluate("()=>{const p=collection().items[mag.idx];p.colors=['#25335E','#F2C14E','#101040','#E0E1DD'];renderMagnify();}")
    bad = []
    for pi in range(len(pats)):
        for bi in range(4):
            for rot in range(4):
                page.evaluate("a=>{mag.pattern=a[0];mag.bg=a[1];mag.rot=a[2];renderMagnify();}", [pi, bi, rot])
                o = page.evaluate(OVERLAY)
                if not o['inside'] or o['worst'] + 1e-9 < o['worstOther']: bad.append((pats[pi], bi, rot, o['color'], round(o['worst'], 2), round(o['worstOther'], 2), o['inside']))
    check(not bad, f'all patterns x backgrounds x rotations: overlay inside the pattern and line 2 uses the better colour {bad[:6]}')
    # Rotate / Background / Prev / Next buttons re-evaluate the colour (compare against a fresh computation)
    page.evaluate("()=>{mag.pattern=2;mag.bg=0;mag.rot=0;renderMagnify();}")
    for btn in ('Rotate', 'Background', 'Next ›', '‹ Prev', 'Rotate'):
        page.click(f'.mag-tools button:has-text("{btn}")')
        o = page.evaluate(OVERLAY)
        check(o['worst'] + 1e-9 >= o['worstOther'], f'after {btn}: line 2 colour {o["color"]} is the better choice ({o["worst"]:.2f} vs {o["worstOther"]:.2f})')
    # Vertical bars: one equal full-height bar per colour; Diagonal: genuinely angled stripes cycling through every colour
    page.evaluate("()=>{const p=collection().items[mag.idx];p.colors=['#25335E','#F2C14E','#101040'];mag.pattern=3;mag.rot=0;mag.bg=0;renderMagnify();}")
    vb = page.evaluate("()=>{const st=document.querySelector('.mag-stage');const sr=st.getBoundingClientRect();return [...st.querySelectorAll('.cell')].map(e=>{const b=e.getBoundingClientRect();return [Math.round(b.width/sr.width*100),Math.round(b.height/sr.height*100),e.dataset.c]});}")
    check(len(vb) == 3 and all(w == 33 and hh == 100 for w, hh, _ in vb) and [c for _, _, c in vb] == ['#25335E', '#F2C14E', '#101040'], f'Vertical bars: three equal full-height bars {vb}')
    page.evaluate("()=>{mag.pattern=4;renderMagnify();}")
    dg = page.evaluate("""()=>{const st=document.querySelector('.mag-stage'),svg=st.querySelector('svg');const polys=[...svg.querySelectorAll('polygon')];
      const pts=polys[0].getAttribute('points').split(' ').map(s=>s.split(',').map(Number));
      const dx=pts[3][0]-pts[0][0],dy=pts[3][1]-pts[0][1];const angle=Math.abs(Math.atan2(dy,dx)*180/Math.PI);
      const sr=st.getBoundingClientRect(),cr=svg.getBoundingClientRect();
      const cols=[...new Set(polys.map(p=>p.getAttribute('fill')))];
      const seq=polys.slice(0,6).map(p=>p.getAttribute('fill'));
      // sample the rendered colour at a few points along a horizontal line: must change along x (stripes), and along a 45° line it must stay constant
      const at=(x,y)=>{const e=document.elementsFromPoint(x,y).find(el=>el.tagName==='polygon');return e&&e.getAttribute('fill');};
      const y0=sr.top+sr.height*.3;const row=[];for(let i=0;i<40;i++)row.push(at(sr.left+10+i*(sr.width-20)/40,y0));
      const diag=[];for(let i=0;i<10;i++)diag.push(at(sr.left+sr.width*.5-i*12,y0+i*12));
      return {angle,n:polys.length,cols,seq,fills:cr.width>=sr.width-3&&cr.height>=sr.height-3,fw:[cr.width,sr.width,cr.height,sr.height],diag,rowChanges:row.filter((c,i)=>i&&c!==row[i-1]).length,diagConst:new Set(diag).size===1};}""")
    check(abs(dg['angle'] - 45) < 0.01 or abs(dg['angle'] - 135) < 0.01, f'Diagonal: stripe edges are at 45 degrees ({dg["angle"]:.1f})')
    check(sorted(dg['cols']) == sorted(['#25335E', '#F2C14E', '#101040']) and dg['seq'] == ['#25335E', '#F2C14E', '#101040', '#25335E', '#F2C14E', '#101040'], f'Diagonal: stripes cycle through every palette colour {dg["seq"]}')
    check(dg['fills'] and dg['rowChanges'] >= 6 and dg['diagConst'], f'Diagonal: fills the stage (svg {dg["fw"][0]}x{dg["fw"][2]} in stage {dg["fw"][1]}x{dg["fw"][3]} incl. border), colour changes along a row ({dg["rowChanges"]} changes) and is constant along the 45-degree direction')
    page.screenshot(path=shot('mag_diagonal.png'))
    page.click('.mag-stage .cell'); check(page.evaluate('mag.rot') == 1, 'clicking the diagonal stripes rotates the colours')
    page.click('.mag-tools button:has-text("Background")'); page.screenshot(path=shot('mag_diagonal_bg.png'))
    # old pattern mapping: index 4 used to be 'Diagonal' (vertical bars); the renamed pattern keeps that look at index 3 and index 4 is the new Diagonal
    check(pats[3] == 'Vertical bars' and pats[4] == 'Diagonal' and pats.index('Vertical stripes') == 5, 'renamed pattern precedes the new Diagonal; Vertical stripes moved last')
    # saved state: the pattern choice is not persisted (nothing to migrate) and a stale index never breaks the dialog
    page.keyboard.press('Escape')
    stored = page.evaluate("()=>Object.entries(localStorage).map(([k,v])=>k+'='+v).join(' ')")
    check('pattern' not in stored.lower() and 'diagonal' not in stored.lower(), 'Magnify pattern is not written to localStorage (no saved index to migrate)')
    ok = page.evaluate("()=>{const out=[];for(const i of [4,5,6,-1]){mag.pattern=i;openMagnify(0);out.push([i,MAG_PATTERNS[mag.pattern],!!document.querySelector('.mag-stage [data-c]')]);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));}return out;}")
    check(all(name in pats and has for _, name, has in ok), f'reopening with any (even stale or out-of-range) pattern index renders a valid pattern {ok}')
    br.close()
print('ERRORS', errors)
print('FAILS', fails)
sys.exit(1 if errors or fails else 0)
