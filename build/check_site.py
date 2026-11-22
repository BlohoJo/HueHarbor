"""Check that the repository is ready to be served by GitHub Pages (Deploy from a branch: main / (root)).

Run from anywhere:  python3 build/check_site.py
Exits non-zero if index.html is not a byte-identical copy of palette_picker.html (rebuild with
`python3 build/assemble.py`), or if the root `.nojekyll` marker is missing (without it GitHub runs
Jekyll over the repository and the README, not the app, becomes the homepage).
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
problems = []

app, index = ROOT / 'palette_picker.html', ROOT / 'index.html'
for p in (app, index):
    if not p.exists():
        problems.append(f'missing {p.name}')
if not problems and app.read_bytes() != index.read_bytes():
    problems.append('index.html differs from palette_picker.html — run: python3 build/assemble.py')

nojekyll = ROOT / '.nojekyll'
if not nojekyll.exists():
    problems.append('missing .nojekyll at the repository root — create it with: touch .nojekyll')
elif nojekyll.stat().st_size:
    problems.append('.nojekyll should be empty')

if problems:
    print('check_site: FAIL')
    for m in problems:
        print('  -', m)
    sys.exit(1)
print(f'check_site: OK — index.html == palette_picker.html ({app.stat().st_size} bytes), .nojekyll present')
