"""Assemble the single-file app: build/head.html + body.html + <script>app1(data)+app2+app3</script>.

Run from anywhere:  python3 build/assemble.py
Exits non-zero if a part is missing, the data placeholder is absent, or the script would break the HTML.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
B = ROOT / 'build'
OUT = ROOT / 'palette_picker.html'


def read(name):
    p = B / name
    if not p.exists():
        sys.exit(f'assemble: missing {p}')
    return p.read_text(encoding='utf-8')


head, body = read('head.html'), read('body.html')
data, a1, a2, a3 = read('data.js'), read('app1.js'), read('app2.js'), read('app3.js')
if '// DATA_PLACEHOLDER\n' not in a1:
    sys.exit('assemble: app1.js has no "// DATA_PLACEHOLDER" line')
script = a1.replace('// DATA_PLACEHOLDER\n', data) + '\n' + a2 + '\n' + a3 + '\n'
if '</script' in script.lower():
    sys.exit('assemble: the JavaScript contains "</script", which would end the inline <script> early')
html = head + body + '<script>\n' + script + '</script>\n</body>\n</html>\n'
OUT.write_text(html, encoding='utf-8')
print(f'{OUT.name}: {len(html.encode("utf-8"))} bytes')
