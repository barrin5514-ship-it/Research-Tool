# Research Agent — frontend redesign: inspection and safe plan

Status: **plan only.** No application code, database rows, server behaviour, provider settings or tests were changed to produce this document.

- Repository: `C:\Users\barri\Documents\ChatGPT\Research Agent`, branch `master`, clean at `d26021b`.
- Last full test run: **225 passed, 0 failed** (40 s). Evidence: `docs/FULL_TEST_OUTPUT_20261031_FULL.txt`.
- Concept image: **not found.** There is no image in the repository, in this chat, or among images saved to Desktop/Downloads/Pictures in the last three weeks. The visual plan below follows the written brief (dark navy command centre, neon cyan/purple/pink, glass panels, sidebar, AI-brain centrepiece). Pixel-level matching needs the actual file.

## 1. Current stack

| Layer | What is actually there | Beginner note |
| --- | --- | --- |
| Frontend | Plain HTML + native ES modules. `public/app.js` (52 KB, 238 lines) plus 15 small `.mjs` helpers. No React, no Vue, no bundler, no TypeScript. | The browser loads the files directly. Nothing is compiled. |
| Routing | Hash routing. `location.hash` (`#my-library`, `#idea-map`, …) picks one of six sections; `showView()` hides the others. | A "page" is just a section being shown. |
| Backend | Node 24.19 built-in `node:http` in `src/server.mjs` (215 lines). No Express. about 40 JSON endpoints under `/api/*`, CSRF token header, local-host check, strict Content-Security-Policy. | The server is small and hand-written. |
| Database | SQLite through `node:sqlite` (`DatabaseSync`), file `.research-data/library.sqlite`, WAL mode, 23 tables, no ORM. | One local file holds everything. |
| Styling | One hand-written `public/style.css` (25 KB), 5 CSS variables in `:root`, light theme, responsive breakpoints at 600/700/800/850/950 px. **Zero `@keyframes`, zero `transition`, zero `animation`.** Two `backdrop-filter` uses, both inside the 3D map. | All look-and-feel lives in one file. Nothing animates today. |
| 3D / visuals | Three.js **0.186.1** vendored in `public/vendor/three/` (about 2.1 MB, MIT), lazy-loaded only for the Idea map. Hand-written SVG map as fallback. Charts use the native `<meter>` element. | No graph/chart/animation library beyond Three.js. |
| Tests | `node --test`, 43 test files, 225 tests in about 40 s. Many tests import the small frontend modules directly. | Changing a module's exports can break tests even if the page looks fine. |
| Runtime services | Cobalt on `127.0.0.1:9100`, DeepSeek API, Brave Search, Instagram browser capture, FFmpeg/Whisper/Windows OCR, CoachLab HTTP. | All optional features fail soft; the dashboard still runs. |

`package.json` has **no dependencies**. `npm start` runs Node directly; there is no install step and no build step.

## 2. Existing features (implemented today)

The dashboard itself needs no external service. Cobalt, the local vision model, Brave and DeepSeek are only needed when their specific action is used, and their failures are shown in plain text.

**Collect**
- Import Instagram saved-post exports (JSON/HTML), with deduplication and collection memberships.
- Paste up to three public Instagram links.
- Auto-sync saved posts from the signed-in Instagram browser profile (off by default, max 30 posts, stops at the first known post, never starts analysis).
- Reference hand-off: copy reference-collection media to Personafy's hand-off folder; reference posts stay excluded from research.
- Excluded collections and per-post "not reference" overrides.

**Process**
- Batch sizes 3/5/10/25, collection filter, frozen next-batch preview, one video at a time with a polite delay.
- Capture via Cobalt → browser recording fallback; bounded frames/audio.
- Transcription (Whisper/Windows speech), OCR, optional local vision, and DeepSeek analysis. DeepSeek is text-only except for silent videos, where up to six sampled frames are sent to the vision-capable `deepseek-flash` model.
- Single-post "Run now" and saved-text "Run again", both with a free cost preview and explicit confirmation.
- Spending tracker, DeepSeek balance refresh, usage ledger.

**Understand and apply**
- Research results: "What is this?", "Why is it useful?", "What can I do with it?" with short bullets, longer "Give me more" explanations, thumbnails and a full-result dialog.
- Claim checking (DeepSeek + Brave), review states, evidence details.
- Projects: add/edit/enable/delete, "What this project is" and "What it already uses" profiles, re-check older results with cost preview, combine 2+ results into plans with cost preview.
- New ideas (unmatched results), manual "Move to project".
- Recipes + grocery list, Wishlist (Brave find, daily price checks, price-drop banner).
- Send selected results to CoachLab (Martial Arts and Fitness only).
- Idea map: 3D holographic project/video map, connect ideas, combine, 2D fallback.

**Not present:** YouTube or Reddit integration. The importer and `processor.mjs` accept only `instagram.com` post URLs; there is no YouTube/Reddit API client, OAuth, schema column, or UI. Brave only excludes social domains from shopping searches.

## 3. Existing UI structure

One HTML page (`public/index.html`, 47 lines, 131 element ids) laid out top-to-bottom:

1. `<header>` — brand "Research Library" + badge.
2. Intro block — eyebrow, headline, one paragraph.
3. Sticky navigation — "Idea map" link plus a `<details>` "Menu" dropdown (the six sections).
4. Notice, status message, price banner.
5. `<section id="idea-map" class="workspace-section">` — holographic map, tools, legend, accessible video list.
6. `<dialog id="full-result">` — result detail modal.
7. `<section id="my-library">` — 5 stat cards, charts, post detail panel, auto-sync, reference hand-off, import/sign-in `<details>`, batch controls + money cards, exclusions/skipped, last-run list, collection sidebar + library rows.
8. `<section id="research-results">` — filter, compact result cards, usage `<details>`.
9. `<section id="project-ideas">` — add-project form, project cards, combine/recheck confirmations, New ideas.
10. `<section id="recipes">` — recipe cards + grocery sidebar.
11. `<section id="wishlist">` — tracked items.
12. `<footer>` — privacy/limits note.

Rendering contract: JavaScript fills fixed containers by id. `app.js` performs **147 `$('id')` lookups plus 6 direct `getElementById` calls**, and toggles `hidden` on `.workspace-section`. The 131 ids are therefore a hard interface between HTML and JS.

Reusable pieces already present: `el()` (DOM builder), `card()`, `compactResult()`, `thumbnailNode()`, `videoStatus()`/pill, stat cards, money cards, `<details>` panels, native dialog, `mountWishlist()`, `mountRecipes()`, `mountVisualLayer()` (which owns the SVG/3D map), `bars()` chart helper, post-title links.

What the concept adds that does **not** exist: an app-wide sidebar, a dashboard-style hero with an AI-brain centrepiece, glass/neon visual language outside the map, motion, recent-research and pipeline surfaces, a knowledge-connections view, and source badges for non-Instagram platforms.

## 4. Risks

| # | Risk | Why it matters / mitigation |
| --- | --- | --- |
| R1 | **Concept image missing** | "Very close to the image" cannot be judged. Ask for the file before Phase 1; treat this plan as the written-brief version. |
| R2 | **131-id contract** | Moving or renaming an id silently breaks a feature (no build error). Keep every id; run an automated id-list diff before/after each HTML change. |
| R3 | **Tests import frontend modules** | `test/*.test.mjs` import `result-view.mjs`, `visual-layer.mjs`, `hologram-layout.mjs`, etc. Renaming exports breaks tests. Keep module paths/exports; add tests for new pure helpers. |
| R4 | **Strict CSP** | `script-src 'self'; style-src 'self'` with no `unsafe-inline`/`unsafe-eval`. No CDN scripts, no Google Fonts, no `<style>` blocks, no `style="…"` attributes. Use the stylesheet, classes, and CSSOM (`el.style.setProperty`) only. |
| R5 | **Static allowlist** | The server serves only paths explicitly listed in `STATIC` (`src/server.mjs`). Every new CSS/JS/font/icon file needs an entry, or it 404s. This is a 5-line server change, not a backend redesign. |
| R6 | **3D performance** | Documented embedded-browser samples were **1–11 fps** for the map (target 30 fps unverified). A heavy WebGL brain on the landing view could make the app feel worse. Prefer a 2D canvas/CSS brain for the hero; keep the Three.js map on its own tab with the existing auto-fallback. |
| R7 | **Readability** | Research answers are long paragraphs. Neon-on-black needs ≥ 4.5:1 body contrast and no glow behind text. Keep body copy near-white on near-black, glow only on borders/accents. |
| R8 | **Mobile** | A fixed sidebar must become a drawer. Test 390/768/1024/1440 px; no horizontal scroll; 44 px touch targets. |
| R9 | **No framework** | Utility-class or component-library approaches assume a build step. Introducing one now is a rewrite risk, not a redesign. |
| R10 | **Feature illusion** | The brief lists Instagram/YouTube/Reddit. Only Instagram exists. Show the other two as "not connected yet"; do not fake data or dead buttons that look live. |
| R11 | **Data safety** | The UI must not start batches, syncs, price checks or paid calls on load. Today it doesn't; preserve that. No schema change is needed for this redesign. |
| R12 | **Docs drift** | `docs/dashboard-preview.png` is actually a JPEG and shows an old proof-of-concept screen, not today's UI. Don't use it as a visual baseline. |

## 5. Recommended redesign strategy

**CSS-first reskin inside the existing vanilla app. No framework, no bundler, no backend changes.**

Why: the app already has clean separations (view-model modules, mount functions, one stylesheet, self-contained API). The redesign is mostly *presentation*: a new shell, a dark theme, a dashboard composition, and motion. A React/Tailwind rewrite would add a toolchain, duplicate 225 tests' assumptions, and risk the research pipeline — with no user-visible benefit over a disciplined CSS pass.

Shape of the work ("strangler" reskin):
1. **Tokens before pixels.** Define one palette/type/spacing/radius/shadow token set; switch the page to dark by default via `<html data-theme="dark">`, keeping a light fallback.
2. **Shell first, content second.** Add `.app-shell` (sidebar + topbar + main) around the *existing* sections without moving ids. The hash router and `showView()` keep working unchanged.
3. **One surface at a time.** Restyle panels/cards/buttons/inputs/pills globally, then section-specific layouts. Never change copy or behaviour in the same commit.
4. **Dashboard from existing data.** Build the command-centre hero out of data already in `/api/state` (counts, recent results, statuses, projects). No new endpoints.
5. **Motion last.** Ambient CSS animation, `prefers-reduced-motion` honoured; no layout-property animation.

### Visual target (from the brief, using the map's existing palette)

- Base: `#05070f` → `#0a1020` radial/linear; panel `rgba(14,21,40,.72)`; hairline border `rgba(120,180,255,.14)`.
- Neon accents (already used by the map, so the app stays coherent): cyan `#36e4ff`, violet `#a782ff`, blue `#4a95ff`, pink `#ff74dc`, mint `#62f3bd`, amber `#ffd17a`.
- Text: primary `#e8f1ff`, secondary `#93a4c3`; body copy max 72 ch.
- Glass: 14 px `backdrop-filter: blur() saturate()`, 1 px border, inset top highlight, soft outer shadow; glow only on 1–2 focal elements per view.
- Type: self-hosted **Inter** (body/UI) + **Space Grotesk** (headings/numbers) — both OFL, ~60–120 KB WOFF2 each; fallback `system-ui`. Avoid Orbitron-style fonts for body text.
- Radius 8/12/16/20; spacing 4/8/12/16/24/32/48; elevation via shadow + border, not heavy gradients.
- Layout: 250 px sidebar, 64 px topbar, content max 1560 px, 12-column dashboard grid.
- Motion: 150–220 ms ease-out hovers/reveals; 6–10 s ambient brain pulse; no parallax; respect reduced motion.

### AI-brain centrepiece (recommended build)

`public/brain-orb.mjs` — a ~150-line **2D canvas** module:
- 120–180 nodes in a soft sphere, distance-based links, slow rotation, project-coloured sparks.
- Device-pixel-ratio capped at 1.5, 30 fps cap, pause when hidden or offscreen.
- Static SVG/gradient fallback when canvas is unavailable or reduced motion is on.
- Pure layout helper in a separate module so it can be unit-tested without a DOM.

This avoids WebGL cost on the first screen and leaves the existing Three.js map untouched. If the owner insists on a 3D brain, reuse `hologram-map.mjs`'s renderer limits and fallback rather than adding React Three Fiber.

## 6. Libraries to add

| Candidate | Verdict | Reason |
| --- | --- | --- |
| Tailwind CSS | **No, for now** | Requires a build step and a purge config that understands class names built inside `app.js` strings. Existing CSS is only 25 KB. Revisit only if the app moves to Vite. |
| Framer Motion | **No** | React-only; the app is vanilla. CSS transitions/keyframes + Web Animations API cover this design. |
| React Flow | **No** | React-only; current SVG/Three.js map already does selection, combining and navigation. |
| Cytoscape.js | **Later, only if needed** | Vanilla and capable, but ~370 KB and duplicates the existing renderer. Justified only if the knowledge web exceeds ~1,000 nodes and needs built-in pan/zoom/layout. |
| d3-force | **Optional, vendored** | ~30 KB, ISC, pure layout math with no DOM ownership. Good fit if the connections view needs a tidy force layout; can also be hand-written in ~60 lines. |
| React Three Fiber | **No** | Needs React + bundler + Three.js; the app already has raw Three.js 0.186.1 for the map. |
| Three.js | **Keep as is** | Already vendored and licensed; used only by the Idea map. |
| Chart.js / Recharts | **No** | Native `<meter>` bars are sufficient; add hand-drawn SVG sparklines if needed. |
| Icon library (Lucide) | **Optional, copy inline SVG** | ISC licensed; copy the ~20 needed icons into an SVG sprite (`<symbol>`), no runtime package or CDN. |
| GSAP | **No** | Licence/weight not justified; CSS + WAAPI is enough. |
| Fonts (Inter, Space Grotesk) | **Yes, self-hosted** | OFL licensed. Place WOFF2 in `public/fonts/`, add `@font-face`, register files in `STATIC`, add `font-src 'self'` to the CSP. No Google Fonts (blocked by CSP and privacy). |

**Net new runtime dependencies: zero.** Optional vendored files: fonts (~200 KB total) and, later, `d3-force`.

## 7. Components to create

Build in this order; each is a CSS class plus a small DOM helper, not a framework component.

1. **AppShell** — sidebar + topbar + scrollable main, wrapping existing sections.
2. **SidebarNav** — hash links (Command Center, Library, Results, Projects, Recipes, Wishlist), active state from `hashchange`, project shortcuts, status footer (queue, DeepSeek balance, provider).
3. **Topbar** — section title, sync/queue indicator, balance chip, "New research" primary action (scrolls to import), menu button on mobile.
4. **GlassPanel** — shared surface class (replaces plain `.panel` look).
5. **StatTile** — one KPI number + label + context line (extracted from `.stat`); used by the hero.
6. **ResearchCard** — thumbnail + title + 3-line summary + project tags + status + open action (evolved from `compactResult`).
7. **StatusPill** — status → colour/dot mapping; keeps exact status text used by tests.
8. **BrainOrb** — canvas centrepiece with `mountBrain({canvas, data})`, reduced-motion/visibility handling.
9. **PipelineStrip** — Imported → Queued → Analyzing → Summary ready → Project matched, with counts and click-to-filter; pure `pipelineCounts()` helper.
10. **RecentResearch** — top 6 results by `updated_at`; pure `recentResults()` selector.
11. **SourceChip** — Instagram (connected), YouTube/Reddit ("not connected yet", disabled, tooltip).
12. **EmptyState** — icon + one sentence + one action (replaces bare `<p>` empty messages).
13. **Tabs** — accessible tablist for dashboard panels (Overview / Map / Connections).
14. **Icon** — inline SVG sprite lookup.
15. **KnowledgeWeb** — reuse `ideaMapData()` and `combinedPlans` edges in a connections tab; no new API.
16. **ConfirmSheet** — extracted wrapper around the existing native `<dialog>` and cost-confirmation pattern (do not change confirmation behaviour).

Keep existing helpers (`card()`, `mountVisualLayer`, `mountWishlist`, `mountRecipes`) intact; restyle them rather than replacing them.

## 8. Suggested implementation order

Each phase ends with: `npm test` green, screenshots at 1440 and 390 px, id-list unchanged (or intentionally extended), commit. Work on branch `redesign/command-center`; `master` stays releasable.

**Phase 0 — Baseline (≈30 min)**
Capture all six sections, record the 225-test result, confirm queue/batch/rechecks idle. Do not start any processing.

**Phase 1 — Design tokens and dark theme (≈half day)**
Add token variables, dark defaults, restyle body/typography/inputs/tables/dialog/toasts. No markup move. Acceptance: every section readable, contrast checked, tests green.

**Phase 2 — App shell and sidebar (≈1 day)**
`index.html`: wrap in `.app-shell`, add `<nav>` and topbar, keep all 131 ids and all six `.workspace-section` nodes. Mobile drawer via `<details>` (no new JS). Acceptance: hash routing, all ids present, "Research Library" text still on the page (a test asserts it).

**Phase 3 — Command Center hero (≈1–2 days)**
Inside `#idea-map`: add headline, BrainOrb, KPI tiles, recent research, quick actions; move the existing map block into an "Idea map" tab/panel with all its ids intact. New pure helpers for counts/recents; 3-line hook in `render()`. Acceptance: 3D/2D map, connect and combine still work; no extra API calls.

**Phase 4 — Component reskin (≈1–2 days)**
Cards, panels, pills, buttons, forms, charts, dialog, library rows, project cards, recipe/wishlist. Text unchanged. This is the "looks like the concept" milestone.

**Phase 5 — Motion (≈half day)**
Ambient glow, staged card entrance, hover lift, brain rotation; `prefers-reduced-motion: reduce` disables all of it. Acceptance: no layout shift, no dropped frames while scrolling.

**Phase 6 — Pipeline, sources, connections (≈1–2 days)**
PipelineStrip and RecentResearch wiring; SourceChips with honest states; knowledge-web tab using existing map/combination data. No backend change. YouTube/Reddit remain visibly "not connected".

**Phase 7 — QA, docs, screenshots (≈1 day)**
Mobile/keyboard/contrast/performance pass, full test evidence file, update `README.md`, `PROMPT_LOG.md`, screenshots into `docs/` (ignored artifacts otherwise). Ship.

Total: roughly 6–9 focused days at a beginner-friendly pace; a presentable concept match is reachable at the end of Phase 4.

## 9. Preservation checklist (must stay true after every phase)

- All 131 ids and six sections exist; `showView()` behaviour unchanged.
- All `/api/*` endpoints, request/response shapes and CSRF header unchanged.
- No database migration, no data rewrite, no batch/sync/price check started by the UI.
- No paid provider call in any phase; tests use stand-ins.
- CSP stays strict (no `unsafe-inline`, no `unsafe-eval`, no third-party origins).
- Static allowlist updated for every new asset.
- 225 tests stay green; add tests for new pure helpers.
- Exact status/answer copy preserved where tests or user meaning depend on it.
- `prefers-reduced-motion`, keyboard focus, aria-live and the accessible map list preserved.

## 10. Open questions for the owner

1. **The concept image** — please drop the file into the repo (e.g. `docs/concept.png`) or give a path. Without it, Phase 4 is an interpretation.
2. **Theme** — dark-only, or dark default with a light toggle for readability?
3. **Fonts** — okay to vendor Inter + Space Grotesk (OFL, ~200 KB) or keep system fonts?
4. **Name** — keep "Research Library" (a test asserts it) or rename to something like "Research Command Center" and update that test?
5. **Source order** — if YouTube/Reddit come later, which first? (Both need new backend adapters; they are outside this redesign.)
6. **Brain** — 2D canvas orb (fast, recommended) or attempt the 3D version on the landing view?
