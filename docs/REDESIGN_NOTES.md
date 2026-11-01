# Research Agent redesign — implementation notes

Date: 2026-10-31. The dashboard now uses the neon command-centre design from the owner's concept image while every existing research feature stays in place.

## What changed

| File | Change |
| --- | --- |
| `public/index.html` | Rebuilt the page shell: left sidebar, top bar, command-centre home, Ideas view, Settings view. `#idea-map` is now the Knowledge Web page; the six original sections still exist and load on demand. |
| `public/theme.css` | New theme layer loaded after `style.css`: design tokens, glass panels, sidebar/top bar, dashboard grids, neon controls, dark skins for every existing panel/card/list, motion and responsive rules. |
| `public/dashboard-view.mjs` | New view-model and DOM builder for the home dashboard (pipeline counts, activity, project cards, recent research, idea count, sidebar status, knowledge stats, settings values). Pure helpers are exported for tests. |
| `public/hero-core.mjs` | New holographic brain-in-a-chamber visual, generated as inline SVG with CSS animation. No WebGL and no dependency. |
| `public/favicon.svg` | Small neon mark so the browser no longer logs a missing favicon. |
| `public/app.js` | Wires the dashboard renderer, the hero visual, sidebar navigation/active state, the mobile drawer, source chips, the activity jump and the Idea Generator shortcut. Existing endpoint calls are unchanged. |
| `public/visual-layer.mjs` | Project circles now use SVG presentation attributes instead of `style="…"`, so the strict CSP no longer blocks their colors (console errors removed). |
| `src/server.mjs` | Added the four new static assets to the existing allowlist. Usage-ledger path can be overridden with `RESEARCH_USAGE_FILE` for isolated previews; default behavior is unchanged. |
| `scripts/ui-preview.mjs` | New local preview server with synthetic records, thumbnails, fake spend and an in-memory database. It never opens `.research-data`, never starts a batch and never calls a provider. |
| `test/dashboard-view.test.mjs` | 10 new tests: pure dashboard helpers, deterministic hero layout, preserved page controls, static asset/CSP check, no-op mount. |
| `docs/FULL_TEST_OUTPUT_20261031_REDESIGN.txt` | Exact output of the final full suite. |
| `docs/redesign-*.jpg` | Screenshots captured from the synthetic preview at 1536x1024 and 500×900. |

## Dependencies

**None added.** `package.json` is unchanged; there is no build step and no install. The design uses the existing vanilla ES modules, the existing vendored Three.js map and system fonts (Bahnschrift / Segoe UI / Cascadia Mono on Windows).

## What the new UI contains

- **Sidebar**: brand, Home, Research, Library, Projects, Ideas, Knowledge Web, Recipes, Wishlist, Settings, plus a live provider/balance/spend/queue card.
- **Command centre**: holographic brain chamber, live posts / insights / projects totals, Start New Research, Research Pipeline, Research Activity, Your Projects, Recent Research and Idea Generator.
- **Start New Research**: Instagram chip is live and feeds the existing link/import controls. YouTube and Reddit are visibly disabled because no backend adapter exists. URL focuses the link box, Document opens the export picker.
- **Pipeline**: five stages with counts derived from real library statuses; the Analyzing stage pulses while a batch runs.
- **Activity**: shows the current post, real done/total progress and estimated time when a batch runs; otherwise shows the last batch outcomes and a link to the Library.
- **Knowledge Web**: the existing 3D/SVG idea map, restyled with a new heading, live totals, dark glass tools and the same Connect/Combine behavior.
- **Ideas**: New ideas moved to a dedicated page plus a free Idea Generator panel; the paid Combine flow still requires its cost preview.
- **Settings**: read-only scaffold showing provider, balance, spend, queue, Instagram, CoachLab, Brave and automation status. Secrets are never shown.
- **Motion**: ambient core pulse, orbit/dash animation, staggered panel entry, hover glow, progress motion. `prefers-reduced-motion` turns it off.
- **Responsive**: icon rail at 1100 px, off-canvas drawer at 940 px, single column at 940/640 px. Verified no horizontal overflow at 390 px.

## Preservation

- All original working controls still exist. The only removed id is `view-menu`, the old dropdown navigation; the new sidebar replaces it.
- `/api/*` endpoints, request/response shapes, CSRF handling, SQLite schema and processing behavior are unchanged.
- No database migration, no paid call, no batch, sync or price check was started by this work.
- The real `.research-data` library was never opened by the preview server (in-memory SQLite + temp thumbnails).
- The strict CSP stays strict: no inline styles, scripts, eval or third-party origins. The one inline style violation that existed in the 2D map is fixed.

## Verification

- Full suite: **235 passed, 0 failed, 0 skipped** (27.3 s), up from 225 because of the 10 new tests. Output in `docs/FULL_TEST_OUTPUT_20261031_REDESIGN.txt`.
- Layout probe at 1536 and 390 px: document `scrollWidth === clientWidth`, no failed resources, no console errors.
- Screenshots: home, Knowledge Web, Projects and mobile captured from the synthetic preview only.

## Follow-ups (not part of this UI task)

1. **YouTube/Reddit** need real backend adapters (source detection, metadata, media/captions, rate limits) before their chips can be enabled. The UI currently says they are not connected.
2. **Settings** is a read-only scaffold. Moving the automation toggles there from the Library would be a separate, deliberate change.
3. **Activity per-step events** (download, extract, analyze) are not exposed by the queue; the panel shows real overall progress instead of inventing steps.
4. **3D map performance** is unchanged from before (documented 1–11 fps in the embedded browser); the automatic 2D fallback remains. Consider defaulting to 2D on low-power devices.
5. **Fonts** are system fonts. Self-hosted Inter/Space Grotesk would improve cross-machine fidelity but needs font files, licences and a `font-src` CSP entry.
6. **The concept's floating-island Knowledge World** is represented by the existing 3D sphere map, which is the stable option; the island illustration was not reproduced.
7. **Demo screenshots** use synthetic records; they do not show the owner's real library or spending.
