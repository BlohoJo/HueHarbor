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

## Round 4 — Products scene, Magnify overlay, Vertical bars / Diagonal

Scope: three changes — the new **Products** preview scene (2 × 2 grid of flat
inline-SVG products: headphones, tumbler, smartwatch, controller), the Magnify
overlay readability fix (both sample lines moved fully over the pattern;
line 2 switches between white and near-black from the colours hit-tested
beneath it), and the Magnify pattern list (the old "Diagonal", which was equal
vertical bars, renamed **Vertical bars**; a new true 45° **Diagonal** added
right after it).

Method: two independent reviewer passes (a runtime pass in Chromium and
Firefox, and a static line-by-line review of `build/app2.js`, `build/app3.js`,
`build/head.html`, `build/test_magnify.py`, the Products block of
`build/test_preview.py` and the README), each given `README.md` and the internal
findings document, plus an adversarial probe written for this round
(`2 / 3 / 4 / 5 / 6 / 8 / 12`-colour palettes, five near-whites, five
near-blacks, light and dark app theme, all six patterns × four backgrounds,
window resize with Magnify open, Pattern pressed 7 times, Next on the last
palette, Preview opened from Magnify on the Diagonal pattern, Your photo →
Products tab switching, Esc / focus return) in both browsers.

| # | Finding | Severity | Disposition |
|---|---------|----------|-------------|
| 1 | Magnify, palettes with many colours (8 and 12 tested): under the Panels, Vertical bars, Diagonal and Vertical stripes patterns both a very dark and a very light cell can lie beneath line 2, so neither white nor near-black reaches 3 : 1 everywhere (worst case 1.37 : 1 … 2.63 : 1 with the subtle shadow only). Found by the adversarial probe; not reachable with the 2–5-colour generated palettes, but imported lists allow up to 12 colours. | Minor (cosmetic) | **Fixed** — `magUpdateSample()` now also records the best worst-case ratio; below 3 : 1 it adds the class `on-mixed`, which replaces the subtle shadow with a strong halo of the opposite colour (`build/head.html`). Single-tone palettes are unchanged. Covered by a new check in `test_magnify.py` (8-colour Vertical bars → halo; pastel palette → no halo). |
| 2 | The static reviewer flagged UI strings using British "colour" against README prose using American "color". | — | **Not a defect** — this is the project's convention (UI British, README prose American), stated in the brief and the README; no change. |
| 3 | The static reviewer asked whether `PV_PRODUCT_EXACT` handles 6 + colours. | — | **Not a defect** — as for every SVG scene, `pvExactScene` uses the five-colour layout and appends the strip of remaining colours; verified in the contact sheets (6-colour greyscale palette shows the sixth colour in the strip) and by `test_preview.py` (every exact hex present for 6 colours). |
| 4 | Migration of a saved Magnify pattern index. | — | **Not needed** — `mag` (`idx, pattern, bg, rot`) is held in memory only; `localStorage` holds the settings object and the lists, neither of which stores a pattern (verified by grep and at runtime). A user who had the old "Diagonal" selected simply sees the pattern list start at Panels next time, as before. |
| 5 | Your photo with a one-colour palette throws in `pvRamp` (pre-existing, not part of this change). | — | **Not reachable** — generated palettes have 2–5 colours and `cleanItem()` rejects imported palettes with fewer than 2 (or more than 12) colours; left as is. |

Checked, none found: `test.py`, `test_export.py`, `test_bg.py`,
`test_ff_probe.py`, `test_preview.py`, `test_magnify.py`, `test_perf.py` exit 0
in Chromium and Firefox (zero console / page errors); `test_ffdev.py` in the
stock Firefox Developer Edition build: 361 checks, 0 failed; Products renders
four labelled cards for every palette size × normal / Precise / exact ×
Light / Dark × shuffles (labels ≥ 4.5 : 1 normal, ≥ 3 : 1 Precise; every exact
hex in scene and chips; Light ≠ Dark at every shuffle step, or only at the
middle-colour steps of odd palettes in Precise modes, as in every scene);
Magnify overlay lines inside the pattern for all 6 patterns × 4 backgrounds ×
rotations and after Rotate / Background / Prev / Next / Shuffle / resize, line 2
always the better of white / near-black (12.25 : 1 on the user's navy Panels
case); Diagonal edges at 45°, stripes cycle through every colour, fill the
stage and rotate on click; Vertical bars equals the old geometry; Pattern
button order and wrap; photo controls absent on Products; Esc returns focus.

Verdict after fix: PASS.

## Round 5 — verification of the Round 4 fix

A fresh reviewer pass re-read `magUpdateSample()` and the `.on-mixed` rules,
probed the 8-colour and the navy 3-colour palette through all 6 patterns × 4
backgrounds (line 2 inside the stage, colour and shadow recorded, screenshots
inspected), re-ran `test_magnify.py` and `test_preview.py` in Chromium and
Firefox, and re-checked the Products tab with a 5-colour palette in normal,
Precise and exact-count modes.

Findings: none from the reviewer. One hardening added while writing the
saved-state test: `renderMagnify()` now wraps an out-of-range `mag.pattern`
(e.g. a stale index) into `0 … 5` instead of rendering a nameless pattern.
Confirmed: the halo class is added only when the best
worst-case ratio is below 3 : 1 and applies to both text colours; the subtle
shadow remains otherwise; the overlay stays inside the stage; the four
products and their labels read in every mode. Verdict: PASS.

## Round 6 — second Products set ("Everyday") and the Tech / Everyday switch

Scope: the alternate 2 × 2 set (sneaker, backpack, phone case, coffee mug) in
`pvProductSvg` / `pvProductMap` / `PV_PRODUCT_EXACT`, the `.pv-set` segmented
control rendered only on the Products tab, the in-memory `pv.productSet`
selection, the new checks in `test_preview.py` and `test_ffdev.py`, README §7
and `docs/screenshots/pv_products_everyday.png`.

Two independent reviewer passes (code review + switch behaviour; visual /
contrast probe) were given README.md and the findings document and an
adversarial brief. They re-ran `test_preview.py` in Chromium and Firefox
(exit 0 both), reviewed every hunk of the diff, and probed the Everyday set for
2 / 3 / 4 / 5 / 6 / 8-colour palettes × normal / Precise / exact × Light / Dark
× shuffle steps 0–2 (229 screenshots, contact sheet inspected), measuring
label contrast (lowest 4.90 : 1 normal on the 8-colour palette, 7.39 : 1 in
Precise), confirming every exact hex in scene and chips, no part filled with
its card colour, nothing drawn outside its card, and the strip present for 6+
colours. Switch: two buttons with correct `aria-pressed`, absent on the seven
other tabs, selection kept across Prev / Next, tab changes, Shuffle,
Light / Dark, Precise / exact; nothing written to localStorage (only
`hueharbor.settings.v1` present); an out-of-range `pv.productSet` falls back
to Tech.

Findings: no defects. One observation from the layout probe: at a 900 px wide
viewport the toolbar wraps so that Shuffle and Light / Dark move to a second
row below the Tech / Everyday control. Checked against the Dashboard tab at the
same width: the toolbar already wrapped there before this change
(`.pv-tools` is `flex-wrap: wrap`), nothing overlaps and every control stays
usable at 900 px and 700 px, so this is existing behaviour, not a regression.

Full run after the review: all 7 suites in Chromium and Firefox exit 0
(`test_preview.py` 434 checks in Chromium, both sets covered), and the stock
Firefox Developer Edition smoke test passes 414 checks including the Everyday
hex / label checks and the switch. Verdict: PASS.
