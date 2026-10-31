# Research Agent handoff

Prepared October 31, 2026 (America/New_York). Continue the existing implementation; do not rebuild it. This is the Research Agent handoff, not CoachLab.

## Start here

- Project: C:\Users\barri\Documents\ChatGPT\Research Agent
- Repository: https://github.com/barrin5514-ship-it/Research-Tool.git
- Branch: master. Inspected HEAD: 267c7a1 (Add safe one-shot Sync now control).
- Before this document was written, Git status was clean and the locally recorded origin/master matched master. No remote fetch was performed for this handoff.
- Dashboard: http://127.0.0.1:5199/ (Idea map home).
- Read docs/PROMPT_LOG.md, README.md, docs/PERSONAFY_REFERENCE_HANDOFF.md and this file before editing. Honor any newer owner instructions.
- This handoff only writes documentation. No server launch, sync, analysis, download, paid call, installation, commit or push was performed for it.

## Owner boundaries

Preserve the database, imported library, saved research, projects, manual project choices, profiles and media metadata. Never commit .env, .research-data, Instagram exports, cookies or login information. Never display secrets. No new paid calls are authorized by this handoff; historical one-call approvals are exhausted and must not be reused.

Do not modify Pennywise, Personafy (actual folder named Persona Phi), Dev Squad AI or Cobalt. Personafy reference files may be read only for the existing integration; never use or copy its browser profile. The Research Agent owns a separate profile under .research-data/browser-profiles/instagram. Obtain approval before new installations. Do not bypass Instagram login/security checks. Wait for current work to finish before restarting the server.

## Run and stop

Desktop shortcuts were installed as Research Tool and Stop Research Tool on the owner's desktop (previously resolved to OneDrive\Desktop). Start opens the page and avoids a duplicate server; stop finishes current work cleanly.

From the project folder, the established launcher commands are:

~~~powershell
powershell -NoProfile -File scripts/research-tool.ps1 -Mode Start -NoOpen -NoDialog
powershell -NoProfile -File scripts/research-tool.ps1 -Mode Stop -NoDialog
~~~

npm start runs Node with the existing local environment, system certificates and proxy support. Server binds to loopback port 5199. GET /api/state reports queue/batch, savedSync, referenceHandoff, wishlist, rechecks and combining activity. Do not print its whole response or trigger actions just to inspect status. Current running state was not checked for this handoff.

## Main application

- Node 24+, plain browser JavaScript and a local Express-free Node HTTP server in src/server.mjs. Fixed static allowlist, CSRF/origin/host guards. SQLite LibraryStore in src/store.mjs.
- Private library: .research-data/library.sqlite. Provider configuration: ignored .env. DeepSeek was last explicitly confirmed as research provider in earlier work; it was not re-read for this handoff. Keys remain server-side.
- Instagram saved JSON/HTML importer; normalized collection names, only post/reel URLs; captions repaired conservatively for mojibake. Export remains outside the project. No need to re-import unless requested.
- One-at-a-time pipeline: Cobalt, optional installed yt-dlp, browser fallback using the tool's own profile; Whisper transcription, frame extraction and OCR; text-only DeepSeek research with transcript/OCR/caption/source URL. Temporary research media cleaned up, small thumbnails retained.
- Local vision is optional/off by default. DeepSeek never receives images. Research claims remain NOT VERIFIED. Independent claim verification is not implemented; disabled Check claims button is intentional.
- public/input-limits.mjs holds INPUT_LIMITS: 40 meaningful input characters minimum, 12,000-character transcript/caption caps, 30 OCR snippets, 25 MiB import limit. Too little content skips AI without a charge; shortened inputs are reported.
- Batch sizes 3/5/10/25, sequential work and polite delay, collection selection, stop-after-current, resume and duplicate handling. Spending/usage tracker and balance display. No claim that historical estimates equal billing invoices.
- Dynamic recommendation projects stored in SQLite; owner can add/edit/disable/delete. Current active projects reach new research. Manual Move to project choices survive re-analysis. Unmatched content goes to New ideas; do not force matches.
- Finished posts can Run again from saved text, with preview/cost confirmation; no re-download needed. Single waiting posts have Run now using the normal pipeline/guardrails.
- Recipes route separately from research, with source-grounded ingredients/steps and grocery list. Wishlist needs an owner-confirmed product URL before free page checks; blocked stores are not retried automatically.
- Research results exclude recipes and project-matched content. Project ideas displays full matched cards plus New ideas. Combined ideas use saved short summaries/recommendations only; one merged NOT VERIFIED plan with ordered video-linked steps, older plans retained. Preview and confirmation required.

## Idea map and performance

Three.js is vendored locally with MIT license, no runtime CDN. Glowing project/video nodes, hover labels, orbit/zoom, selection for Combine these, simple 2D fallback, visibility pause. Other tabs remain reachable.

Do not claim 30 fps on integrated graphics: prior embedded-browser checks were slow, and automatic 2D fallback is the reliable option. Existing hologram recording is a synthetic graphics preview, not proof of smooth real-data performance. See docs/HOLOGRAM_NOTES.md.

## Latest changes: reference hand-off and Sync now

Commits:

- 0e9cef4: optional reference hand-off with file validation and retries.
- 26e0cfc: all existing Personafy codes and current reference baseline count as handled.
- 267c7a1: one-shot Sync now button.

### Saved-post sync

src/saved-sync.mjs and src/saved-page.mjs use only the Research Agent signed-in browser profile. Scheduled auto-sync defaults off, owner selects once or twice daily, and checks run only while the server is open. At most 30 posts per collection check, slow scroll pauses, stop at the first known code. Login, captcha, warning or access limits stop safely and disable scheduling. New general posts enter the library waiting; no automatic research.

My library has Sync now beside Auto-sync. It runs the same routine once even with scheduling off, without enabling the schedule. Server/client reject overlapping sync or batch/research work; feedback says Found X new posts or a plain error. POST /api/saved-sync/now uses the existing authenticated local CSRF checks. Reference hand-off runs first when its separate switch is on. This can include media acquisition, but never DeepSeek. Do not click it without intending a live Instagram check.

### Personafy history and duplicate policy — latest owner instruction wins

Read-only source: C:\Users\barri\Documents\ChatGPT\Persona Phi\data\personafy.db. Earlier audit found 74 distinct Instagram codes: 26 playable copies and 48 missing/uncertain. The owner subsequently instructed that ALL 74 are already handled, regardless of media quality: never download or retry those old codes.

The current ReferenceHandoff combines all audited codes, permanently remembered handled codes, and a persistent baseline of reference posts already in this library. It no longer treats the 48 uncertain codes as retry candidates. The baseline is initialized at first startup of the new code; it is not an Instagram saved-at timestamp. Do not reset it or promise that arbitrary unseen historical saves can be dated from their post date. First-known stopping and the baseline prevent ordinary backfill; verify live collection order if behavior is questioned.

Settings in the Research Agent database: reference-handoff-baseline, reference-handoff-handled, personafy-reference-audit-summary. Keep these intact. New failures remain eligible for one automatic retry on the next sync, then manual Retry / Retry all failed. Existing handled codes are excluded from these retry jobs.

Private audit artifacts, when still present: .research-data/personafy-reference-audit.json and personafy-reference-codes.txt. Do not commit them or display login data. No need to repeat the audit just to start work.

### Hand-off files

Owner-authorized destination:

C:\Users\barri\Documents\Personafy-Handoff\references

~~~text
references/index.json
references/<post-code>/index.json
references/<post-code>/media-01.jpg (or png/webp/mp4/webm etc.)
~~~

UTF-8 JSON root index lists codes, source URLs, status, reason and relative per-post index. Each post index includes caption, postedAt when known, savedAt, method, completion/item count and file metadata (relative name, bytes, MIME/kind, dimensions/duration, SHA-256). Read docs/PERSONAFY_REFERENCE_HANDOFF.md for exact contract.

Personafy code was not changed to import these files automatically. This is a hand-off folder, not a confirmed Personafy ingestion pipeline. Reference media are intentionally retained there, unlike temporary research downloads. Reference posts stay excluded from research.

Done requires full valid nonempty media that decodes/plays and matches the expected item count. Unknown/partial captures stay Incomplete. Retry uses the same code folder, replaces managed bad copies and never duplicates the post. Full carousel/cardinality and browser recording checks remain conservative. Hand-off defaults off. A normal scheduled run needs auto-sync plus hand-off enabled; a one-shot Sync now can run enabled hand-off without enabling the schedule.

## Verified results and limits

Latest committed full-suite output: docs/FINAL_SYNC_TEST_OUTPUT.txt — 194 passed, zero failures/skips. Also docs/REFERENCE_BASELINE_FOCUSED_TEST_OUTPUT.txt and docs/REFERENCE_BASELINE_VERIFIED_TEST_OUTPUT.txt. The final small cancellation-message fix had the focused saved-sync tests rerun afterward. Those logs are historical test evidence, not tests rerun today.

~~~powershell
npm test
~~~

Tests run serially via node --test --test-concurrency=1 test/*.test.mjs. Use stand-in providers; do not make paid calls in tests. The package has no production build script; do not invent a build result. Live media smoke/doctor commands can access configured services: inspect them and authorization before running.

Verified previously: synthetic PNG/video full decode and cleanup, partial/empty/corrupt refusal, good-copy checks, Personafy read-only audit, failed retries, safety shutdown, collector limits, manual sync concurrency/messages, temporary indices and duplicate behavior. Latest sync changes were not exercised against a live signed-in Instagram collection.

Still unverified:

1. Live Instagram general/reference collection DOM, ordering and capture compatibility after the latest changes.
2. Full live hand-off and consumption by Personafy; the initial folder contained only an empty root index. Present folder contents were not inspected for this handoff.
3. Current provider/service connectivity, current laptop resources and server running state.
4. Hologram 30+ fps performance; prior evidence does not meet that target.
5. Any new paid analysis: no authorization is carried forward by this document.

## Suggested next action for the receiving agent

Start read-only: check Git status and instructions, read the owner request, inspect only relevant files. If asked to verify sync, check own-browser sign-in and idle status first; explain that Sync now can acquire reference media when hand-off is enabled. Preserve the baseline and old 74-code skip policy. Never use a research run as a connectivity probe. Make focused changes with tests, update docs/PROMPT_LOG.md, and commit/push only when authorized by the next task. No pending implementation task was requested beyond creating this handoff.
