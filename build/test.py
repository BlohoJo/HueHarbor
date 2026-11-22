import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import BROWSER, IS_FIREFOX, ROOT, launch_kwargs, context_kwargs, browser_type, shot
from playwright.async_api import async_playwright
URL='file://'+os.path.join(ROOT,'palette_picker.html')
async def clip(page):
    try: return await page.evaluate("navigator.clipboard.readText()")
    except Exception as e: return 'CLIPBOARD-UNAVAILABLE'
async def main():
    print('browser', BROWSER)
    async with async_playwright() as p:
        b=await browser_type(p).launch(**launch_kwargs())
        ctx=await b.new_context(**context_kwargs())
        page=await ctx.new_page()
        errs=[]
        page.on('console',lambda m: errs.append(m.text) if m.type in('error','warning') else None)
        page.on('pageerror',lambda e: errs.append('PAGEERROR '+str(e)))
        await page.goto(URL); await page.wait_for_timeout(300)
        await page.screenshot(path=shot('01_single.png'))
        # counts per type
        counts=await page.evaluate("()=>ALL_TYPES.map(t=>[t,generate(t,'#2f6fed').length])")
        low=[c for c in counts if c[1]<8]; print('types',len(counts),'low',low)
        # anchor exact in every palette for several colors
        bad=await page.evaluate("""()=>{const out=[];for(const c of ['#2f6fed','#ff0000','#000000','#ffffff','#808080','#ffe400','#123456','#fed7e0']){for(const t of ALL_TYPES){for(const p of generate(t,c)){if(p.colors[p.anchor]!==c)out.push([t,c,p.name]);if(p.colors.some(x=>!/^#[0-9a-f]{6}$/.test(x)))out.push(['BADHEX',t,c,p.colors.join()]);if(p.colors.length<2||p.colors.length>5)out.push(['LEN',t,c,p.colors.length]);}}}return out.slice(0,20);}""")
        print('anchor/format issues',bad)
        # paging
        await page.keyboard.press('ArrowRight'); await page.wait_for_timeout(100)
        print('counter',await page.inner_text('#pager .counter'))
        await page.click('#viewSeg [data-view=multi]'); await page.wait_for_timeout(200)
        await page.screenshot(path=shot('02_grid.png'),full_page=False)
        await page.click('#layoutSeg [data-layout=rows]'); await page.wait_for_timeout(200)
        await page.screenshot(path=shot('03_rows.png'))
        # mood type
        await page.click('#viewSeg [data-view=single]')
        await page.click("#typeGroups button:has-text('Romantic')"); await page.wait_for_timeout(200)
        await page.screenshot(path=shot('04_mood.png'))
        print('mood title',await page.inner_text('#title'), await page.inner_text('#subtitle'))
        # picker drag + hex input
        box=await page.locator('#svBox').bounding_box()
        await page.mouse.click(box['x']+box['width']*0.8, box['y']+box['height']*0.3)
        await page.fill('#hexIn','#c0392b'); await page.press('#hexIn','Enter'); await page.wait_for_timeout(150)
        print('color now',await page.evaluate("S.color"))
        # swatch popover + copy
        await page.click('#stage .sw >> nth=0'); await page.wait_for_timeout(100)
        await page.screenshot(path=shot('05_popover.png'))
        await page.click(".pop .kv button >> nth=0")
        print('clipboard',await clip(page), '| toast:', await page.inner_text('#toast'))
        await page.keyboard.press('Escape')
        # copy css
        await page.click("#stage .acts button:has-text('CSS')")
        print('css clip',(await clip(page))[:40].replace('\n',' '), '| toast:', await page.inner_text('#toast'))
        # eyedropper: expected to be disabled where the API is missing (Firefox)
        print('eyedropper api',await page.evaluate("!!window.EyeDropper"),'button disabled',await page.evaluate("document.querySelector('#eyeBtn')?.disabled"))
        # magnify
        await page.click("#stage .acts button:has-text('Magnify')"); await page.wait_for_timeout(150)
        await page.screenshot(path=shot('06_magnify.png'))
        await page.click(".mag-tools button:has-text('Pattern')"); await page.click(".mag-stage .cell >> nth=-1")
        await page.keyboard.press('Escape')
        # save to list
        await page.click("#stage .acts button:has-text('Save')"); await page.wait_for_timeout(100)
        print('saved label',await page.inner_text("#stage .acts button:has-text('Save')"))
        # library
        await page.click('nav.modes [data-mode=library]'); await page.wait_for_timeout(200)
        print('lib',await page.inner_text('#title'),await page.inner_text('#subtitle'),await page.inner_text('#pager .counter'))
        await page.click('#viewSeg [data-view=multi]'); await page.click('#layoutSeg [data-layout=grid]'); await page.wait_for_timeout(200)
        await page.screenshot(path=shot('07_library.png'))
        await page.click("#pager button:has-text('Forward')"); print('lib page2',await page.inner_text('#pager .counter'))
        await page.click('#libKind [data-kind=color]'); await page.wait_for_timeout(100)
        await page.click('#baseGrid button >> nth=4'); await page.wait_for_timeout(150)
        print('lib color',await page.inner_text('#subtitle'))
        await page.screenshot(path=shot('08_library_color.png'))
        await page.click('#libKind [data-kind=sci]'); await page.select_option('#libSci','Distinct'); await page.wait_for_timeout(100)
        print('lib sci',await page.inner_text('#subtitle'))
        # lists
        await page.click('nav.modes [data-mode=lists]'); await page.wait_for_timeout(200)
        print('lists',await page.inner_text('#subtitle'))
        await page.screenshot(path=shot('09_lists.png'))
        page.on('dialog',lambda d: asyncio.ensure_future(d.accept('Test list')))
        await page.click('#listNew'); await page.wait_for_timeout(150)
        print('lists now',await page.evaluate("LISTS.map(l=>l.name+':'+l.items.length)"))
        # theme + help
        await page.click('#themeBtn'); await page.click('nav.modes [data-mode=generate]'); await page.wait_for_timeout(200)
        await page.screenshot(path=shot('10_dark.png'))
        await page.click('#helpBtn'); await page.wait_for_timeout(100); await page.screenshot(path=shot('11_help.png')); await page.keyboard.press('Escape')
        await page.click('#infoBtn'); await page.wait_for_timeout(100); await page.screenshot(path=shot('12_info.png'))
        # persistence
        await page.reload(); await page.wait_for_timeout(300)
        print('persist',await page.evaluate("[S.theme,S.type,S.color,LISTS.length]"))
        # mobile
        await page.set_viewport_size({'width':420,'height':800}); await page.wait_for_timeout(200)
        await page.screenshot(path=shot('13_mobile.png'))
        print('ERRORS',errs)
        await b.close()
        return errs
sys.exit(1 if asyncio.run(main()) else 0)
