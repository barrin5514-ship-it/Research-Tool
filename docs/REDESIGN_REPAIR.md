# Dashboard visual repair — root cause and verification

Date: 2026-11-01. The futuristic redesign from commit `30e63c1` is preserved; this repair fixes why the real application rendered as an unstyled light page with giant icons.

## Root cause report

### Verified primary cause: the running server predated the redesign

The owner's recording was compared with the live process:

- The Recording was made at 23:55 on 2026-10-31.
- The dashboard process serving port 5199 had started at **22:20**, before the redesign was committed at 23:46.
- `src/server.mjs` used a **hand-written static-file allowlist** built once at startup. The old process therefore served the new `index.html` from disk, but returned **404** for:
  - `/theme.css`
  - `/dashboard-view.mjs`
  - `/hero-core.mjs`
- `app.js` itself was served (it was in the old allowlist), but its module imports failed. The dashboard never initialised.
- Without `theme.css`, only the legacy light stylesheet applied: white/paper background, block-stacked layout, no sidebar grid, default SVG sizes (giant icons), legacy `header` bars on panel headings, and empty dashboard regions.
- A fresh server returned 200 for every asset and rendered the dark command centre correctly.

This explains the recording exactly and is confirmed, not inferred.

### Secondary causes found while verifying the real app

1. **Slow first state load**: every `/api/state` poll ran a Windows process scan (`profileProcesses`) to detect an open Instagram window. Measured at ~1.8 s per call, making state ~2.4–3.0 s and delaying the first render.
2. **No first-paint placeholders**: dashboard panels were empty until state resolved, looking like missing content.
3. **Hidden 3D map work on the dashboard**: the Knowledge Web module initialised its renderer during page load even while hidden, delaying the first usable screen on a low-power laptop.
4. **Sidebar specificity bug**: legacy `.sidebar nav` rules (built for library collection filters) applied to the new app `<nav>`, producing a 2-column drawer on mobile and unexpected grid sizing. This is why sidebar elements did not display at intended dimensions.
5. **Drawer blur**: the mobile scrim had a higher z-index than the sidebar, so the drawer appeared blurred behind the overlay.
6. **Narrow-width overflow**: source chips spilled out of the panel at 1366 px, and pipeline labels crowded each other.
7. **Stale-asset failure was silent**: no message told the owner that the server was out of date.

## Repairs implemented

### Asset delivery (durable fix)

- New `src/static-files.mjs` resolves files under `public/` by path and an **extension allowlist**, rejecting dotfiles, traversal, symlinks and unknown types.
- `src/server.mjs` uses this resolver for all GET static requests instead of the hard-coded map. New CSS/JS/icons/fonts are served without adding server code, while `.env`, JSON and `.research-data` remain blocked.
- All assets are still protected by the strict CSP and `cache-control: no-store`.

### Performance and first paint

- `LibraryStore.list()` now loads per-video override/export flags in **two batched queries** instead of two queries per row.
- Browser-window status is cached for five minutes with in-flight sharing, invalidated after connect/confirm, and **pre-warmed at server startup**. State now responds in ~70–150 ms instead of ~2.5–3 s.
- `refresh()` renders the dashboard immediately, yields two animation frames so it paints, then builds the rest of the hidden sections.
- The Knowledge Web renderer and 3D scene now initialise only when that page is actually opened; the 2D SVG is also deferred until visible. The existing 2D fallback and map behaviour are unchanged.
- Dashboard containers show a calm loading line while the first state request is in flight.

### Styling and layout

- `theme.css` now explicitly restores the app nav to `display:flex`/single column with higher specificity than legacy `.sidebar nav` grid rules.
- Drawer z-index raised above the scrim.
- Source chips stay inside the panel at 1366 px; pipeline labels and project names fit their cards.
- Compact height rules at ≤820 px reduce top bar, panel padding, hero height and activity list height.
- New `style.css` rule only for the stale-server banner.
- `display-errors.js` detects a missing `theme.css` and shows a plain banner telling the owner to restart the server, so a stale process is no longer a silent broken page.

### Preserved

No schema change, no record deletion, no API contract change, no new dependency, no paid call, no batch/import/sync. YouTube and Reddit remain disabled. The existing Instagram, library, results, projects, recipes, wishlist, Knowledge Web and 2D fallback features are untouched.

## Visual verification (real application)

Server started with the normal command (`node --env-file-if-exists=.env --use-system-ca --use-env-proxy src/server.mjs`) on `http://127.0.0.1:5199/`. Chrome DevTools Protocol captured the actual page (not the synthetic preview):

| Viewport | Result |
| --- | --- |
| 1536 × 1024 | dark theme, sidebar 252 px, icons 18 px, brain 292×357, pipeline/projects/recent populated, horizontal overflow 0 |
| 1366 × 768 | dark theme, icons 18 px, brain 245×300, source chips on one row, horizontal overflow 0 |
| 390 × 844 | single column, drawer opens sharp above scrim, brain 326×398, no horizontal overflow |

Pages checked at 1536: Home, Knowledge Web, Library, Research, Projects. Console exceptions: **0**. Failed network requests: **0**. The mobile drawer opens to the correct 276 px width with `left: 0`.

Screenshots are stored privately in `.test-artifacts/real-home-1536.png`, `real-home-1366.png`, `real-home-390.png`, `real-home-390-drawer.png`, plus the other pages. They are not committed because they contain the owner's real library titles and balance.

### Remaining visual differences from the concept

- The concept's floating-island Knowledge World is represented by the existing 3D sphere map; the illustration itself was not reproduced.
- Typography uses system Bahnschrift/Segoe UI rather than a bundled display font.
- At 1366 × 768 the lower row (Projects/Recent/Idea Generator) begins below the fold; the command centre and activity fit, but the page scrolls for the second row.
- The avatar is a local monogram and the bell jumps to activity; there are no accounts or notifications.

## Testing

- Full suite: **241 passed, 0 failed, 0 skipped** (28.8 s).
- Evidence: `docs/FULL_TEST_OUTPUT_20261101_REPAIR.txt`.
- New coverage:
  - `test/static-files.test.mjs`: resolver allowlist, traversal/dotfile refusal, every local asset referenced by the real page returns 200, `.env`/JSON 404.
  - `test/theme.test.mjs`: stylesheet order, balanced CSS, required layout/icon/viewBox/min-width contracts, appended rules.
  - `test/browser-fallback.test.mjs`: browser status cache reuses the expensive scan and expires after five minutes.
- Automated tests are necessary but not sufficient; the three viewport captures above are the visual acceptance evidence.

## Git

- Branch: `master`
- Base commit: `30e63c1`
- Repair commit: created locally after verification.
- Push: intentionally not performed, pending owner approval.
