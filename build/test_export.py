"""Export verification: trigger .ase/.gpl downloads in headless Chromium, then parse them in Python."""
import os, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import BROWSER, IS_FIREFOX, launch_kwargs, context_kwargs, browser_type, shot
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'palette_picker.html')
OUT = os.path.join(ROOT, 'shots', 'firefox' if IS_FIREFOX else '', 'exports')
os.makedirs(OUT, exist_ok=True)


def parse_ase(data):
    """Strict ASEF parser. Returns list of groups [{name, colors:[(name, model, values, ctype)]}]."""
    assert data[:4] == b'ASEF', 'bad signature'
    major, minor, nblocks = struct.unpack('>HHI', data[4:12])
    assert (major, minor) == (1, 0), f'version {major}.{minor}'
    pos, seen, groups, cur = 12, 0, [], None

    def rd_str(buf, p):
        n = struct.unpack('>H', buf[p:p + 2])[0]
        raw = buf[p + 2:p + 2 + n * 2]
        assert raw[-2:] == b'\x00\x00', 'name not null-terminated'
        return raw[:-2].decode('utf-16-be'), p + 2 + n * 2

    while pos < len(data):
        btype, blen = struct.unpack('>HI', data[pos:pos + 6])
        body = data[pos + 6:pos + 6 + blen]
        assert len(body) == blen, 'block truncated'
        if btype == 0xC001:
            assert cur is None, 'nested group'
            name, p = rd_str(body, 0)
            assert p == blen, 'group block length mismatch'
            cur = {'name': name, 'colors': []}
        elif btype == 0xC002:
            assert cur is not None and blen == 0
            groups.append(cur); cur = None
        elif btype == 0x0001:
            name, p = rd_str(body, 0)
            model = body[p:p + 4].decode('ascii'); p += 4
            nvals = {'RGB ': 3, 'CMYK': 4, 'LAB ': 3, 'Gray': 1}[model]
            vals = struct.unpack('>' + 'f' * nvals, body[p:p + 4 * nvals]); p += 4 * nvals
            ctype = struct.unpack('>H', body[p:p + 2])[0]; p += 2
            assert p == blen, f'color block length mismatch {p} != {blen}'
            assert ctype in (0, 1, 2) and all(0 <= v <= 1 for v in vals)
            assert cur is not None, 'color outside group'
            cur['colors'].append((name, model, vals, ctype))
        else:
            raise AssertionError(f'unknown block {btype:#x}')
        pos += 6 + blen; seen += 1
    assert pos == len(data), 'trailing bytes'
    assert seen == nblocks, f'block count {nblocks} != {seen}'
    assert cur is None, 'unterminated group'
    return groups


def parse_gpl(text):
    lines = text.split('\n')
    assert lines[0] == 'GIMP Palette', 'bad header'
    assert lines[1].startswith('Name: ') and lines[2].startswith('Columns: ')
    cols = int(lines[2][9:]); assert 1 <= cols <= 16
    assert text.endswith('\n')
    colors, comments = [], 0
    for ln in lines[3:]:
        if not ln.strip():
            continue
        if ln.startswith('#'):
            comments += 1; continue
        parts = ln.split('\t'); assert len(parts) == 2, repr(ln)
        r, g, b = (int(x) for x in parts[0].split())
        assert all(0 <= v <= 255 for v in (r, g, b))
        assert parts[1] == '#%02X%02X%02X' % (r, g, b), 'name does not match rgb'
        colors.append((r, g, b))
    return lines[1][6:], cols, colors, comments


def expect_download(page, trigger):
    with page.expect_download() as dl:
        trigger()
    d = dl.value
    path = os.path.join(OUT, d.suggested_filename)
    d.save_as(path)
    return d.suggested_filename, open(path, 'rb').read()


errors = []
with sync_playwright() as pw:
    print('browser', BROWSER)
    br = browser_type(pw).launch(**launch_kwargs())
    ctx = br.new_context(**context_kwargs(accept_downloads=True))
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL); page.wait_for_selector('.pal')
    page.evaluate("()=>{S.mode='generate';S.view='multi';S.color='#3b6ea5';save();applyMode();setColor(S.color,true);render();}")
    page.wait_for_selector('.pal')
    card_hex = page.evaluate("()=>collection().items[0].colors")
    card_name = page.evaluate("()=>collection().items[0].name")
    # (a) per-palette
    fn, data = expect_download(page, lambda: page.locator('.pal >> nth=0 >> button:has-text(".ase")').click())
    g = parse_ase(data)
    print('single ase:', fn, len(data), 'bytes;', [(x['name'], len(x['colors'])) for x in g])
    assert len(g) == 1 and [c[0] for c in g[0]['colors']] == [c.upper() for c in card_hex]
    for (nm, model, vals, ct), hx in zip(g[0]['colors'], card_hex):
        rgb = tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5))
        assert model == 'RGB ' and all(abs(v * 255 - c) < 0.01 for v, c in zip(vals, rgb)), (vals, rgb)
    fn, data = expect_download(page, lambda: page.locator('.pal >> nth=0 >> button:has-text(".gpl")').click())
    name, cols, colors, comments = parse_gpl(data.decode('utf-8'))
    print('single gpl:', fn, repr(name), cols, colors, 'comments', comments)
    assert name == card_name and len(colors) == len(card_hex)
    print(data.decode('utf-8'))
    # (c) all palettes of current type for current color
    n_items = page.evaluate("()=>collection().items.length")
    fn, data = expect_download(page, lambda: page.click('#exportAllAse'))
    g = parse_ase(data); print('all ase:', fn, len(data), 'bytes; groups', len(g), 'of', n_items)
    assert len(g) == n_items and fn.endswith('-3b6ea5.ase')
    fn, data = expect_download(page, lambda: page.click('#exportAllGpl'))
    name, cols, colors, comments = parse_gpl(data.decode('utf-8'))
    print('all gpl:', fn, repr(name), 'colors', len(colors), 'comments', comments)
    assert comments == n_items + 1
    # (b) custom list: save two palettes, export
    page.locator('.pal >> nth=0 >> button:has-text("Save")').click()
    page.locator('.pal >> nth=1 >> button:has-text("Save")').click()
    page.evaluate("()=>{S.mode='lists';save();applyMode();render();}")
    page.wait_for_selector('#listCard:not(.hidden)')
    n_list = page.evaluate("()=>curList().items.length")
    fn, data = expect_download(page, lambda: page.click('#listExportAse'))
    g = parse_ase(data); print('list ase:', fn, len(data), 'bytes; groups', [(x['name'], len(x['colors'])) for x in g])
    assert len(g) == n_list >= 2
    fn, data = expect_download(page, lambda: page.click('#listExportGpl'))
    name, cols, colors, comments = parse_gpl(data.decode('utf-8'))
    print('list gpl:', fn, repr(name), 'colors', len(colors), 'comments', comments)
    assert comments == n_list + 1
    print(data.decode('utf-8'))
    page.screenshot(path=shot('11_export_list.png'))
    # hex dump of the first bytes for the record
    print('ase head:', data[:0].hex(), open(os.path.join(OUT, fn.replace('.gpl', '.ase')), 'rb').read(48).hex(' '))
    br.close()
print('ERRORS', errors)
sys.exit(1 if errors else 0)
