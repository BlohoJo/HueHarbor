# QC review log — Preview: Precise mode, Text preview, swatches

Each round below was carried out by an independent reviewer (a fresh review pass
with no authorship of the code) given `README.md` and the internal findings
document as the specification, with the instruction to check errors,
functionality and cosmetics in light and dark mode, for every preview type and
every palette colour count, in Chromium and Firefox. Findings are recorded as
reported; each one has a disposition.

## Background: root cause of the Light / Dark bug

Symptom: after pressing **Shuffle roles** a number of times, the **Light** /
**Dark** segment in the Preview dialog appeared to do nothing; after a few more
shuffles it worked again.

Cause: `pvRoles()` runs through a cycle of `2n` role assignments for a palette
of `n` colours. The first `n` are "soft" variants (background derived from the
palette hue at a lightness chosen by the base, light or dark); the second `n`
are "bold" variants that used a palette colour directly as the background,
**regardless of the base**. So for shuffle counts `n … 2n-1` switching
Light/Dark changed only the room floor tint, nothing else visible. When the
shuffle count wrapped back into the soft half the switch "worked again", which
made the bug look intermittent. It was never a state or event-handler problem:
the base was stored and the dialog re-rendered correctly every time.

Fix: in the bold half the palette colour is only used as background when its
lightness suits the base (light base: L ≥ 0.6; dark base: L ≤ 0.45); otherwise
the background is derived from that colour's hue at a base-appropriate
lightness, so Light/Dark always produces a visibly different, correct result.
The `aria-pressed` state of the two buttons is now also computed from the
resolved base. `build/test_preview.py` checks Light vs Dark after 1 … 10
shuffles for several palettes.

## Round 1

Scope reported by the reviewer: read `build/app3.js`, `build/head.html`,
`build/app2.js`, `build/test_preview.py`, ran `test_preview.py` in Chromium and
Firefox (both exit 0, no console errors), measured the counter contrast in dark
mode (6.33 : 1), and confirmed the exact-count layouts use only palette colours.

| # | Finding | Severity | Disposition |
|---|---------|----------|-------------|
| 1 | The global `keydown` handler only ignores `INPUT`/`TEXTAREA`/`SELECT`; with focus on a subtitle swatch button the arrow keys still step to the next palette, re-rendering the dialog and dropping focus. | Minor | **Rejected after trial** — a guard that ignored arrow keys inside `.pv-swatches` was tried and reverted: after the dialog opens or re-renders, focus lands on the first focusable control, which is now the first swatch, so the guard would have disabled the documented ← / → palette stepping for keyboard users entirely. Arrow keys step palettes from anywhere in the dialog, as the README says; the swatch buttons themselves do not use arrow keys. |
| 2 | "Precise does not apply to Your photo" is not guarded in code. | — | **Not a defect** — `pvCurrentRoles()` returns the normal roles whenever the scene is `photo`, and the Precise / exact-count checkboxes are not rendered on that tab. |
| 3 | README does not state how much the embedded fonts add to the file. | Minor (docs) | **Fixed** — the Text preview paragraph now gives the WOFF2 total (≈ 780 KB) and the base64 cost (≈ 1.05 MB); the Quick start already said the file is about 1.3 MB. |
| 4 | `pv.exact` should be reset when switching preview type. | — | **By design** — the exact-count toggle is per preview type on purpose (the spec asks for a per-type toggle), and the setting is remembered while the dialog is open. |

Verified clean by the reviewer in this round: counter contrast in dark mode;
Light/Dark after shuffles; every palette hex present in Precise mode for 2–5
colours in both exact-count modes and every preview type; Text preview level
count per colour count; font switching and text editing; swatch `alt` text and
copy-to-clipboard with toast feedback.

## Round 2

Method: a second independent reviewer pass plus a scripted QC harness that
drives the built file in Chromium and Firefox (1280 × 900) through every
preview type × light/dark × normal / Precise / Precise-exact-count × 2, 3, 4, 5
and 6-colour palettes (180 screenshots per browser, inspected as contact
sheets), and records: palette hexes missing from the rendered scene, Light vs
Dark after 1 … 10 shuffles, counter contrast on each background quick pick,
Text levels per colour count, font loading (`document.fonts.check`), live text
editing and reset, swatch markup, clipboard copy + toast, Precise controls on
Your photo, and all console errors / page errors.

| # | Finding | Severity | Disposition |
|---|---------|----------|-------------|
| 1 | Text preview, Precise + exact count, 5- and 6-colour palettes: the subheading is set in the Primary colour even when it does not read on the background (e.g. #5BC0BE on #6FFFE9, #2A9D8F on #E9C46A). Both browsers. | Minor (cosmetic) | **Fixed** — the subheading now uses the same rule as the other exact-count layouts: Primary when it reaches 3 : 1 on the background, otherwise the Text colour (the chip label follows). The unused Primary then appears in the colour strip so every exact hex is still shown. |
| 2 | Text preview, Precise modes: a palette colour the levels could not place was shown as a single small square below the panel, which looked like a stray artefact. Both browsers. | Cosmetic | **Fixed** — the remaining colours are now a full-width strip along the bottom of the scene, matching the SVG previews. |
| 3 | The font menu has 37 entries while the README and FONTS_NOTICE say 36 fonts. | — | **Not a defect** — the extra entry is "System default" (the browser's own sans-serif); the README names it. |
| 4 | Per-type memory of "Use exact number of colours" is not described in the README. | Minor (docs) | **Already covered** — README section 7 says the choice is "remembered per preview type"; no change. |

Checked, none found: palette hexes missing in Precise / exact-count (0 of 120
combinations per browser); Light/Dark differs after every shuffle count 1 … 10;
counter contrast 6.33 : 1 in dark mode on every quick pick; Text levels 1 / 2 /
3 / 5 / 5 for 2 / 3 / 4 / 5 / 6 colours; Playfair Display loads and applies;
editing updates live and Reset restores the sample; swatches are
`<button><img alt="#RRGGBB">` with `title="Copy #RRGGBB"`, Enter copies and
toasts "#RRGGBB copied ✓"; no Precise controls on Your photo; zero console
errors or page errors in Chromium and Firefox.

Verdict after fixes: PASS (harness re-run in Firefox and Chromium: no missing
hexes, no console errors; contact sheets re-inspected).

## Round 3 — stock Firefox Developer Edition 162.0b1 (Linux)

Playwright can only drive its own patched Firefox (157), and its `firefox-beta` target no longer exists, so the
Developer Edition channel was checked separately: Mozilla's Linux Developer Edition build 162.0b1 (same Gecko as the
Windows Developer Edition build of the same date) driven by geckodriver 0.36 + Selenium with `build/test_ffdev.py`.

Coverage: dark-mode counter contrast (6.33:1), Light/Dark after 1–10 shuffles in normal/Precise/exact modes,
every exact palette hex in scene + role chips for 2/3/4/5 colours × Precise and exact-count × all six non-photo
scenes × light/dark × three shuffles, exact-count Text level counts, all 36 embedded fonts (`document.fonts`
reports each as loaded and applied), text editing/reset, swatch alt text + clipboard copy, keyboard stepping, Esc.

Result: 313 checks passed, 0 failed, 0 page errors/console errors. Not tested: the Windows binary itself
(only the Linux build of the same version); screenshots in `shots/ffdev/`.
