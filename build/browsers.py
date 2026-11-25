"""Shared browser selection for the test scripts.

Usage:  BROWSER=firefox python3 build/test.py      (default: chromium)
        BROWSER=msedge  python3 build/test.py      (installed Microsoft Edge via Playwright's "msedge" channel)
Both sync and async Playwright objects work, because `launch()` only picks the
BrowserType and builds keyword arguments; the caller awaits if needed.
"""
import os, sys
for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, 'reconfigure'):
        _s.reconfigure(encoding='utf-8', errors='replace')  # Windows consoles default to cp1252

BROWSER = (os.environ.get('BROWSER') or (sys.argv[1] if len(sys.argv) > 1 else 'chromium')).lower()
assert BROWSER in ('chromium', 'firefox', 'msedge'), BROWSER
IS_FIREFOX = BROWSER == 'firefox'
IS_EDGE = BROWSER == 'msedge'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Chromium shots go to shots/, Firefox to shots/firefox/, Edge to shots/msedge/
SHOT_SUB = 'firefox' if IS_FIREFOX else ('msedge' if IS_EDGE else '')
SHOT_DIR = os.path.join(ROOT, 'shots', SHOT_SUB)
os.makedirs(SHOT_DIR, exist_ok=True)


def file_url(name='palette_picker.html'):
    """file:// URL for a file in the repo root; works with Windows drive letters too."""
    from pathlib import Path
    return Path(ROOT, name).resolve().as_uri()


def export_dir():
    """Where downloaded exports are saved for this browser."""
    d = os.path.join(SHOT_DIR, 'exports')
    os.makedirs(d, exist_ok=True)
    return d


# Generated test fixtures (images) live outside the repo; override with HH_FIXTURES=/some/dir
FIXTURES = os.environ.get('HH_FIXTURES') or os.path.join(os.path.expanduser('~'), '.tmp', 'hueharbor-fixtures')
os.makedirs(FIXTURES, exist_ok=True)


def test_photo(name='test_photo.png', size=(640, 400)):
    """Small colourful PNG used by the Preview tests (created once)."""
    path = os.path.join(FIXTURES, name)
    if not os.path.exists(path):
        from PIL import Image
        w, h = size
        img = Image.new('RGB', size)
        px = img.load()
        for y in range(h):
            for x in range(w):
                px[x, y] = (int(255 * x / w), int(255 * y / h), int(255 * ((x // 40 + y // 40) % 2)))
        img.save(path)
    return path


def shot(name):
    """Screenshot path for this browser (Firefox shots go to shots/firefox/)."""
    return os.path.join(SHOT_DIR, name)


def launch_kwargs():
    if IS_FIREFOX:
        return {'firefox_user_prefs': {
            # allow navigator.clipboard.readText()/writeText() without a user prompt in automation
            'dom.events.testing.asyncClipboard': True,
            'dom.events.asyncClipboard.readText': True,
            'dom.events.asyncClipboard.clipboardItem': True,
            # don't open a dialog for downloads
            'browser.download.useDownloadDir': True,
            'browser.download.folderList': 2,
        }}
    if IS_EDGE:
        return {'channel': 'msedge'}
    return {'executable_path': '/usr/local/bin/chromium'} if os.path.exists('/usr/local/bin/chromium') else {}


def context_kwargs(**extra):
    kw = {'viewport': {'width': 1280, 'height': 860}}
    if not IS_FIREFOX:
        # Firefox does not support granting clipboard permissions via the context API
        kw['permissions'] = ['clipboard-read', 'clipboard-write']
    kw.update(extra)
    return kw


def browser_type(pw):
    return pw.firefox if IS_FIREFOX else pw.chromium
