> Current infrastructure status: see [INFRASTRUCTURE_STATUS.md](INFRASTRUCTURE_STATUS.md). Earlier test/service snapshots below are historical.

# Integration update — October 23, 2026

## Already present

Saved Library's MIT parsing patterns were adapted into `src/importer.mjs`, with attribution in THIRD_PARTY_NOTICES.md. The full upstream gallery is unnecessary because Research Agent already has a dashboard and SQLite history. HTML/JSON imports, memberships, URL deduplication, resumable three-item batches, local Cobalt tunnels, FFmpeg frames, and temporary-file cleanup already existed.

MCP Video Analyzer was previously neither installed nor invoked. The existing local vision adapter was optional and disabled.

## Added

`src/analyzer-integration.mjs` connects an explicitly configured installed analyzer's one-shot CLI to the existing Cobalt-downloaded temporary file. Configure `RESEARCH_ANALYZER_ENTRY` to the absolute path of its reviewed `dist/index.js`. No automatic installation or npx download occurs. Child environment excludes cloud credentials and runtime injection variables; temporary home/cache/output paths stay inside the owned attempt and are cleaned with it. Transcripts and OCR text are passed into local visual research. Missing dependencies or partial output remain incomplete.

`src/fact-check.mjs` retrieves bounded independent documentation from curated Python, SQLite, Node.js, and FFmpeg sites for matching claims. The dashboard displays source links. This is limited evidence collection, **not completed semantic fact-checking**: fetched background documentation does not prove a particular claim, so labels remain NOT VERIFIED. Other topics need additional curated retrieval and evidence review.

## Upstream compatibility and security

Both repositories use MIT licensing. Saved Library is a lightweight Python/HTML application; its parser concepts are already reused. MCP Video Analyzer 0.11.0 requires Node >=22.12 and dependencies including FastMCP, ffmpeg-static, Sharp, Tesseract.js, Cheerio and Zod. This machine's Node24 meets its engine requirement. Its CLI supports local files, transcription/OCR and explicit output locations. Existing inspection documents its temporary-cache risks and the older fixed SSRF advisory. See https://github.com/guimatheus92/mcp-video-analyzer/blob/main/package.json and https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/cli.ts .

No dependency installation was performed. Analyzer runtime, speech models and OCR language assets are not provisioned or verified. Removing cloud credentials prevents the documented paid-key fallback but does not provide missing local speech tools. A reviewed installed analyzer plus its local speech/OCR dependencies is required before enabling the adapter. Running third-party code is not a sandbox: it must remain trusted and reviewed.

## Tests and current readiness

All **41 automated tests pass**, including all original 38. Three synthetic clips again pass real FFmpeg frame/audio extraction and cleanup. Resume and dashboard HTTP behavior remain covered. New tests cover credential isolation, URL configuration rejection and independent-source handling using stand-ins. They do **not** validate an installed analyzer or live AI inference.

Current service probes: Cobalt9100, Personafy5185 and local AI1234 unreachable. Neither existing project nor Cobalt was changed or restarted. No paid APIs used. No actual export or three public sample videos supplied, so real-world acceptance remains blocked.

**Ready for an export:** yes, for recognized extracted HTML/JSON Saved files; actual export compatibility still needs validation. **Ready for complete autonomous research:** no. Live analyzer transcription/OCR, local model inference and substantive claim verification remain unverified or incomplete. The dashboard retains its existing layout and three-video pilot limit.
