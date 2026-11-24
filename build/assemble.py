"""Assemble the single-file app: build/head.html + body.html + <script>app1(data)+app2+app3</script>.

Run from anywhere:  python3 build/assemble.py
Writes the same bytes to two files at the repository root:
  palette_picker.html  the file people download
  index.html           what GitHub Pages serves at the site root (Deploy from a branch: main / (root))
Both are generated; never edit them by hand. `python3 build/check_site.py` verifies they are identical.
Exits non-zero if a part is missing, the data placeholder is absent, or the script would break the HTML.
"""
import base64, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
B = ROOT / 'build'
OUTS = [ROOT / 'palette_picker.html', ROOT / 'index.html']


def read(name):
    p = B / name
    if not p.exists():
        sys.exit(f'assemble: missing {p}')
    return p.read_text(encoding='utf-8')


head, body = read('head.html'), read('body.html')
data, a1, a2, a3 = read('data.js'), read('app1.js'), read('app2.js'), read('app3.js')


def fonts_js():
    """Embed the Text-preview fonts (build/fonts/*.woff2, Latin subsets) as base64 so the app stays one offline file.
    build/fonts/manifest.json lists each font's family, category, designer and license (see FONTS_NOTICE.md)."""
    man_path = B / 'fonts' / 'manifest.json'
    if not man_path.exists():
        sys.exit(f'assemble: missing {man_path}')
    out = []
    for f in json.loads(man_path.read_text(encoding='utf-8')):
        wp = B / 'fonts' / (f['id'] + '.woff2')
        if not wp.exists():
            sys.exit(f'assemble: missing {wp}')
        b64 = base64.b64encode(wp.read_bytes()).decode('ascii')
        out.append(json.dumps({'id': f['id'], 'family': f['family'], 'cat': f['category'], 'data': b64}, ensure_ascii=False))
    return '/* Text-preview fonts: Latin woff2 subsets, base64 (generated from build/fonts by assemble.py; licenses in FONTS_NOTICE.md) */\nconst PV_FONTS=[\n' + ',\n'.join(out) + '\n];\n'


fonts = fonts_js()
if '// DATA_PLACEHOLDER\n' not in a1:
    sys.exit('assemble: app1.js has no "// DATA_PLACEHOLDER" line')
script = a1.replace('// DATA_PLACEHOLDER\n', data) + '\n' + a2 + '\n' + fonts + '\n' + a3 + '\n'
if '</script' in script.lower():
    sys.exit('assemble: the JavaScript contains "</script", which would end the inline <script> early')
html = head + body + '<script>\n' + script + '</script>\n</body>\n</html>\n'
for out in OUTS:
    out.write_bytes(html.encode('utf-8'))
    print(f'{out.name}: {len(html.encode("utf-8"))} bytes')
