> Current infrastructure status: see [INFRASTRUCTURE_STATUS.md](docs/INFRASTRUCTURE_STATUS.md). Earlier test/service snapshots below are historical.

# Instagram Research Library — isolated pilot

This is a working **partial proof of concept**, built in Research Agent. It imports saved-post metadata, preserves collections, tracks duplicate videos, runs a small resumable media queue, and provides a local dashboard. **It is not yet a complete autonomous research system.**

No packages were installed. No paid APIs were called. Personafy, Pennywise, and Cobalt were not modified. Your actual Instagram export and three real videos have not been tested because no export or video links were supplied.

## Open the dashboard

Open **http://127.0.0.1:5199** while the server is running. For a later session, double-click **Start Research Library.cmd** in this folder, then open that address. Leave its terminal open; Ctrl+C stops a server launched this way. It does not install a Windows startup task or run after the computer is shut down.

If the dashboard is already running, the launcher refuses to start a second copy. For the background preview started during development, run `node scripts/stop-server.mjs` from this folder to stop only this library's server.

1. Request your official Instagram data export through **Meta Accounts Center**, selecting your Instagram account and Saved information if offered. Include the complete date range. HTML or JSON is supported for the recognized saved-post/collection structures. Meta confirms its download controls live in [Accounts Center](https://about.fb.com/news/2023/10/manage-your-information-across-apps/).
2. Extract the ZIP using Windows. In the dashboard, choose the saved-post and saved-collection `.html` or `.json` files, then click **Import export files**. Select both files when available. The pilot does not open ZIPs itself.
3. If the export does not contain collection membership, those links appear under **Unassigned**. Collection names are never guessed from creator names. You can also paste up to three public video links and choose their collection manually.
4. Start your existing Cobalt using your established Personafy workflow. This library expects the existing loopback service at `127.0.0.1:9100`; it does not start or reconfigure it.
5. Click **Process up to 3 videos**. Default concurrency is one; maximum is two. A batch stays limited to its three selected records. **Pause queue** lets active videos finish and stops new starts.
6. A video with extracted media but incomplete research appears as **Needs research**, not Analyzed. Retry it after the missing tools are connected. A retry downloads fresh temporary media.
7. Review decisions are **New / Under Review / Approved / Rejected / Implemented**. They apply to a video's recommendation set and are recorded only when recommendations exist. Approval never changes another project. “Implemented” is an owner-entered record. New analysis resets old approvals.

Importing an updated export adds new links and memberships without reprocessing completed records. Missing old links remain as history; an export does not delete earlier research or prove that a link has been unsaved. Queries and fragments are removed from Instagram URLs; canonical shortcode identity merges `/p/`, `/reel/`, and `/tv/` variants.

## What is verified

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the full acceptance table and [docs/INSPECTION.md](docs/INSPECTION.md) for existing projects and repository research.

| Status | Result |
|---|---|
| VERIFIED | 38 automated tests: representative export parsing, deduplication, SQLite restart recovery, graceful interruption, retries, two-worker limit, three-video batch boundary, HTTP protections, approval reset, and cleanup isolation. |
| VERIFIED | Three synthetic local videos processed by installed FFmpeg/ffprobe, yielding 1, 3, and 6 frames. Optional audio extraction and cleanup passed. These are explicitly test fixtures. |
| VERIFIED | Existing Personafy Cobalt adapter tests: 15 passed. Selected Pennywise contract/data-model tests: 16 passed. |
| PARTIALLY VERIFIED | Local dashboard and guarded Cobalt integration. The downloader contract is tested with stand-ins; no real Instagram download has been attempted. |
| NOT VERIFIED | Real export compatibility, real video accessibility, local AI model inference, general visual reasoning, OCR quality, and recommendation usefulness. |
| BLOCKED | Real three-video acceptance needs your export or three public links; Cobalt was stopped at inspection. Speech transcription and independent web verification are not yet connected. |

## Optional existing local AI

The default is **off**. An optional LM Studio adapter can read sampled frames and produce tentative, project-specific suggestions. It requires an explicitly selected, already-loaded vision model. It will not download or load a model and will not fall back to a paid API. LM Studio was not running during inspection; inference remains **NOT VERIFIED**.

To try it later, stop the dashboard, start your existing local vision model in LM Studio, then use PowerShell from this folder:

```powershell
$env:RESEARCH_LOCAL_AI = '1'
$env:RESEARCH_LOCAL_MODEL = 'the-exact-id-of-your-loaded-vision-model'
# Optional; the default already matches Personafy's local writer:
$env:RESEARCH_LOCAL_AI_URL = 'http://127.0.0.1:1234'
node src/server.mjs
```

This requires LM Studio's `/api/v0/models` readiness listing. Other OpenAI-compatible servers are not assumed compatible. Generated claims are always **NOT VERIFIED**, model-supplied citations are discarded, and speech is not inferred from silent frames. Visual-only output stays **Needs research**.

For strong claim verification, Claude or Codex with browsing is a suitable next integration, using transcripts and selected evidence plus [the project context](docs/PROJECT_CONTEXT.md). No autonomous cloud integration, account token reuse, API key transfer, or paid provider use is configured here. Any provider pricing and upload/privacy choices must be disclosed and approved before enabling that stage.

## Storage and safety

- `.research-data/library.sqlite` retains URLs, titles, collection memberships, text results, statuses, and review history. It contains no Instagram passwords or cookies. Raw export contents are not retained.
- Each media attempt gets a private, ownership-marked directory in `.research-data/scratch`. The worker deletes its own media/frames/WAV on success, failure, cancellation, and before a fresh retry. On startup it removes only marked leftovers whose owning process is confirmed gone. Junctions, unowned directories, and unrelated Personafy downloads are preserved.
- Each input is capped at **80 MiB / 180 seconds / 4K pixel area**. At most six frames are sampled. Active media scratch for two workers is approximately bounded by **200 MiB**, excluding Cobalt's own operation and old files preserved because ownership could not be established. No permanent video library is created.
- Only Cobalt's same-origin local tunnel is accepted. Redirects and arbitrary remote download targets are refused. Carousels and overlong videos are skipped in this pilot; inaccessible media are retried only when classified as temporary, at most three attempts.
- FFmpeg runs without a shell, with local-file protocols and explicit container limits. The dashboard binds only to `127.0.0.1`, validates Host/Origin and per-process request tokens, uses a restrictive Content Security Policy, and renders export/model strings as text.
- The local database is not encrypted and is accessible to accounts/processes that can read this folder. Keep your Windows account protected. Do not expose the dashboard through a public tunnel.
- No code path changes Personafy/Pennywise files, calls a broker, or implements recommendations. Project context is a read-only snapshot and can become stale.

## Why these components

The [Instagram Saved Library](https://github.com/sthakur369/instagram-saved-library-app) supplies useful MIT HTML parsing patterns, adapted here with stronger URL identity and explicit format warnings. Its full UI and metadata cache would duplicate this dashboard and job store. Attribution is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The existing Cobalt service and installed FFmpeg are reused. Personafy's downloader, local vision writer and frame-extraction code were inspected as working integration examples, without changing or copying its configuration.

[MCP Video Analyzer](https://github.com/guimatheus92/mcp-video-analyzer) is a potential extraction upgrade, not installed here. Its one-shot CLI and local-file adapter are preferable to the reviewed MCP cache lifecycle. Its default optional transcription fallback can use a cloud API if an inherited key exists, so any later integration must explicitly control its environment. Pin a reviewed version, inspect dependency setup, configure local transcription/OCR, and verify cleanup before enabling it. See the source-linked [inspection report](docs/INSPECTION.md).

Fully automatic private Saved-collection access through a supported Meta API was **not verified**. The implemented alternative is official export import plus deduplication. Automatic export-folder watching and Windows background startup are **not implemented**.

## Developer commands

No `npm install` is needed. Use the existing Node 24+ and FFmpeg/ffprobe on PATH.

```powershell
node src/server.mjs
node scripts/doctor.mjs
node --test --test-concurrency=1 test/*.test.mjs
node scripts/media-smoke.mjs
```

Set `RESEARCH_CONCURRENCY=2` only when system memory permits; other values above two are rejected. The inspection found about 1 GiB of free RAM, so one worker is the default. `RESEARCH_PORT` can change the dashboard port; the supplied stop helper uses the same variable.

## Remaining work for full operation

1. Validate your actual export and a controlled three-video sample; record inaccessible/deleted cases honestly.
2. Connect a reviewed local speech-to-text/OCR backend or explicitly approved paid service. Retest accuracy and bounded cleanup.
3. Add independent research retrieval with source excerpts, dates, and claim-level evidence, then verify recommendation quality against both projects.
4. Add an explicit owner-approved expansion beyond three videos, export-folder monitoring if useful, and tested background lifecycle controls. No unattended service is claimed until this is implemented and verified.

No paid services were used for this pilot. Local processing has no per-request API charge; electricity, CPU/GPU time, and future downloaded model disk space remain costs. Exact future cloud costs are not estimated without choosing a provider and usage volume.
