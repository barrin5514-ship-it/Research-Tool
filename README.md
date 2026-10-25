# Research Library MVP

Local Instagram research dashboard. Open **http://127.0.0.1:5199/** while the server is running. Start it later with **Start Research Library.cmd**. No install is needed.

The deadline is Sunday, October 25, 2026, for a Monday, October 26 presentation. See [MVP audit](docs/MVP_AUDIT.md) and [presentation verification](docs/MVP_PRESENTATION.md) for current evidence; older documents describe earlier development snapshots.

## Three sections

1. **My library** — import both saved JSON/HTML files, filter collections, add links, connect the separate Instagram browser, and start/pause the existing three-video batch. One video runs at a time. Importing never starts processing. Counts include preserved earlier imports.
2. **Research results** — each saved result answers What is this?, Why is it useful?, and What can I do with it? **Show more** retains the transcript, OCR, visual observations if present, claims, sources, recommendations and review decisions. AI usage and estimated costs remain available.
3. **Project ideas** — suggestions for Pennywise, Personafy, Tech, Dev Squad AI and Sims 4 Upgrades. Useful unmatched ideas remain in New ideas. These are recommendations only; no target project is changed.

## What is connected

- Official export importer, normalized post identity, deduplication, local SQLite history and resumable queue.
- Existing Cobalt, optional existing yt-dlp, public browser capture, then the Research Agent's separate signed-in profile where needed. No Instagram browser-extension implementation is present in this repository.
- Existing FFmpeg/ffprobe, local Whisper tiny.en (two CPU threads), Windows speech fallback and Windows OCR. A failed OCR frame no longer stops later frames being checked.
- Existing free evidence-based analysis, optional LM Studio vision adapter and separately approved DeepSeek text-only adapter. DeepSeek never receives images. Keys remain server-side in ignored .env.

Speech transcription, OCR and general visual reasoning are different capabilities. Speech and OCR have actual extraction tests. The existing local vision adapter passed an unlabeled-shapes check and a real one-frame inference test; this does not establish whole-video accuracy. The dashboard states this honestly. Claims remain NOT VERIFIED, and partial results remain Needs research.

## Safety and limits

No paid calls are authorized for the current acceptance work. No new packages, providers or models are installed. The current free test harness never imports the paid adapter. Existing DeepSeek behavior and its approval guard are preserved.

Processing uses owned temporary directories and removes recordings, frames, audio and browser playback cache after each attempt. Source limits remain 80 MiB, 180 seconds, six sampled frames, and a six-minute overall timeout. Playback recording is limited to 90 seconds; partial recordings are rejected. Browser buffering can exceed the final 80 MiB acceptance cap, so one worker is enforced. Capture attempts have polite delays and a daily ceiling.

Imported metadata, research and history remain under ignored .research-data/library.sqlite. Reimport does not erase earlier records or research. A private consistent pre-MVP database backup was created before changes. No export, browser profile, API key or database is committed.

## Verification commands

- `npm test` — automated tests using stand-in services; no paid calls.
- `npm run test:media` — four synthetic FFmpeg scenarios, including streaming-WebM normalization and cleanup.
- `node scripts/native-pipeline-smoke.mjs` — actual Windows/Whisper/OCR extraction of a known synthetic clip.
- `node --use-system-ca --use-env-proxy scripts/mvp-real-acceptance.mjs` — fresh real capture of the owner-supplied Instagram post in an isolated test database, local extraction and free analysis, protected HTTP dashboard checks, cleanup and production-data preservation. No paid provider is used.
- `npm run doctor` — installed tooling, local service reachability and memory headroom.

The full Instagram export remains in Downloads. The CLI importer can read its two JSON entries directly from a ZIP in memory using the existing Windows runtime; the dashboard accepts extracted JSON/HTML files. See [import correction](docs/IMPORT_CORRECTION.md) for the confirmed counts.

General visual-model accuracy across clips and independent semantic fact verification remain unverified. Do not describe this MVP as fully autonomous or claim word-perfect transcription. To test existing local vision as well, add `--vision` to the real acceptance command. It stages capture and speech first, loads the installed model for one sampled frame, and unloads afterward; it is slower and memory-sensitive. An Instagram post may also require manual login, be deleted or fail on the presentation day; use the preserved real result as the fallback demonstration.
