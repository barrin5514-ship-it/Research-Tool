# Environment and upstream inspection

Inspection date: 2026-10-23, America/New_York. This report records the inspection and existing-project baseline. It does not certify a completed three-video Instagram trial.

## Status meanings

- **VERIFIED**: supported by inspected local files, a recorded command/test result, or cited upstream source. Source inspection alone does not prove runtime behavior.
- **PARTIALLY VERIFIED**: some parts are confirmed, but the complete workflow has not run.
- **NOT VERIFIED**: no confirming runtime evidence.
- **BLOCKED**: a required input or running service is currently unavailable.

## Confirmed local environment

| Item | Finding | Status |
| --- | --- | --- |
| Isolated new workspace | `C:/Users/barri/Documents/ChatGPT/Research Agent` | VERIFIED |
| Personafy project | `C:/Users/barri/Documents/ChatGPT/Persona Phi` | VERIFIED |
| Personafy baseline | Read-only Git status was empty; 15/15 selected adapter tests passed outside the restricted sandbox | VERIFIED for that selected baseline |
| Personafy HTTP endpoint | `http://127.0.0.1:5185` refused the connection with `ECONNREFUSED` during the outside-sandbox probe | VERIFIED unavailable at inspection; live UI NOT VERIFIED |
| Cobalt installation | `C:/Users/barri/Documents/Personafy-Tools/cobalt`, local version 11.7.1; API configuration points to loopback port 9100 | VERIFIED from files |
| Cobalt endpoint | `http://127.0.0.1:9100` returned `ECONNREFUSED` outside the sandbox | BLOCKED for live media retrieval |
| LM Studio endpoint | Loopback port 1234 returned `ECONNREFUSED` outside the sandbox | BLOCKED for the existing local model endpoint |
| Node.js | 24.19 | VERIFIED |
| Existing FFmpeg | 9.0.1 | VERIFIED |
| CPU | 8 logical cores | VERIFIED snapshot |
| Memory | About 15.75 GiB installed; about 1 GiB free when checked | VERIFIED snapshot |
| Disk | About 224 GiB free when checked | VERIFIED snapshot |
| Official Instagram export | Owner confirmed that no export is available yet | BLOCKED for a real collection import |
| New installations / paid APIs | Neither used during this inspection and isolated implementation | VERIFIED task boundary |

The first sandboxed Git and loopback probes were unreliable: sandbox access restrictions produced misleading work-tree/network errors. The status and connection-refusal results above use the later approved, outside-sandbox checks. A refused connection establishes that no listener answered that address then; it does not establish whether the installed application is healthy when started.

With roughly 1 GiB free memory, start with one processing worker. The requested ceiling is two simultaneous videos; there is no reason to load a large local speech or vision model during this initial proof of concept.

## Existing Personafy components

Personafy has a browser-native interface, a Node 24/TypeScript backend, and SQLite storage. The inspected package includes the `sharp` image library; parts of its README dependency description are older than the current implementation.

Useful existing seams are:

- `src/media/cobalt.ts`: a loopback-only HTTP adapter for Cobalt.
- `src/media/video-frames.ts`: FFmpeg frame extraction.
- `src/providers/local-vlm-prompt-writer.ts`: an LM Studio integration using the local endpoint.
- Provider integrations for xAI, Mage, Pruna, and SpicyAPI, plus social OAuth configuration.

Only configuration names and integration structure were recorded. No passwords, tokens, cookies, or API-key values were exposed, copied into the new app, or used. A configured integration is not evidence that the service currently works or is free.

**VERIFIED:** 15/15 selected Personafy adapter tests passed. **NOT VERIFIED:** full Personafy UI operation, a live Cobalt download, and local-model inference. No Personafy files or existing downloads were changed.

Reuse the architecture through a separate adapter in the Research Agent workspace. Do not import Personafy modules in a way that starts its server, opens its database, reads its credentials, or writes into its downloads.

## Existing Penny_Wise components

Location: `C:/Projects/Penny_Wise`.

Branch: `continue-from-b29`. Commit: `f881ff3362e31e95c012de2c471881419a5015e8`.

The project is a Python application with a Streamlit dashboard, an independent autonomous paper-trading runtime, an event bus, market-data and strategy layers, risk controls, execution abstractions, SQLite trade/equity records, and atomic JSON checkpoints.

| Relevant component | Local evidence |
| --- | --- |
| Streamlit launch and dashboard | `run.py`, `dashboard.py` |
| Independent paper runtime | `run_autonomous.py`, `services/autonomous_runtime.py` |
| Event and risk separation | `core/events.py`, `risk/manager.py`, `main.py` |
| Normalized research observations | `services/research_intelligence.py` |
| Research fusion without order placement | `services/research_fusion.py` |
| Bounded research jobs and resource budgets | `services/research_scheduler.py` |
| Holdouts, evidence tiers, chronological validation | `services/scientific_governance.py`, `services/intelligence_evaluation.py` |
| Persistent research and execution state | `services/runtime_state_store.py`, `services/db_manager.py` |

Its AI research includes local baseline models, bounded NumPy neural/recurrent/attention models, contextual-bandit policies, evolutionary research, and paper-only reinforcement learning. `copilot/copilot.py` describes a deterministic event-based copilot that explains trades and risk decisions; it does not execute orders. No direct hosted LLM SDK integration was found in the production service/copilot files inspected.

The architecture, safety, verification, and user-guide README files inspected are placeholders, so the implementation is the stronger evidence source.

### Penny_Wise baseline and preservation

**VERIFIED:** 16 tests passed in 4.24 seconds across:

- `tests/test_intelligence_contracts.py`
- `tests/test_data_models.py`

The test process used Python `-B`, disabled bytecode, plugin autoload and pytest cache/capture/logging/tmpdir support, removed provider credentials, and set network opt-in off. A pre-import audit guard blocked network, subprocess, and filesystem-write attempts. The initial attempt stopped before tests because pytest capture tried to create a temporary file; disabling capture allowed the guarded run to pass.

This is a deliberately narrow baseline, not a full trading-system certification. No application runtime, real trade, paper session, or financial-provider request was started.

The following existing working-tree changes were present before testing and identical afterward:

```text
 M docs/batches/batch58/review_package/CHANGED_FILES.txt
 M tests/test_batch57_experiment_automation.py
 D tools/start_pennywise.ps1
 M tools/sync_staged_release.ps1
?? data/learning/
?? tools/install_windows_startup.ps1
```

The repository was therefore **not clean** before this work. These files were left untouched. Nine recorded source/configuration/test fingerprints remained unchanged after testing.

| File | SHA-256 |
| --- | --- |
| `main.py` | `0bd294109d4f8f5ab1fd0b43c4831cfbd3da893318ecac28c5307be45b8029e9` |
| `run.py` | `bf2e4954fbeeca0fe33310863dc11e61ad6c304fb41f29bbb0902ac74c0a1837` |
| `run_autonomous.py` | `70c161a7105371896ead07142909b8014af93ee0aeb540abb2620705241be6a6` |
| `dashboard.py` | `c5190d1c2942d3d6bcc2e19863b00ea5b676e9a6cce856f7a390799d87620c4e` |
| `config/safety_config.py` | `ba87a7a2645ee7fa0abc22f5ccd84e02fbc7cf2395a23a8bc4d27b7ae97ff8ed` |
| `services/research_intelligence.py` | `d187bd5214650d0d63947e8068e95b4b17104b4ef33d1c17d564dd9f8a94b049` |
| `services/research_fusion.py` | `2c4aa0d9ffb6e419067a0faa616766dd13b9863ab1177e407dba534bf1c8fd28` |
| `tests/conftest.py` | `18918320c5656415d22d8f085d5516a5f934875c3bfdeee6d7e13be6acaeeefc` |
| `pyproject.toml` | `b484e57527fbc9714661119ba8a74d0ff40d0879daa40c77f90906dea0bb7da8` |

## Upstream repository assessment

### Instagram Saved Library

**PARTIALLY VERIFIED:** source and documentation inspected; the upstream application was not installed or run.

The MIT-licensed project is a small standard-library Python server with a vanilla browser interface. It imports HTML saved-item exports and stores parsed metadata in `cache/library.json`; it is not a transcript, research, MCP, or Cobalt system. Its Windows batch launcher and browser-only interface are relevant compatibility evidence, not a local Windows runtime test. [Repository](https://github.com/sthakur369/instagram-saved-library-app), [Python implementation](https://github.com/sthakur369/instagram-saved-library-app/blob/main/app.py).

Useful concepts to reuse are collection grouping, extracting source links, and presenting the original Instagram post. The inspected parser relies on particular HTML labels/structure, and URL deduplication is limited; another export layout needs explicit tests. The proof of concept should normalize validated Instagram URLs and use stable shortcodes rather than treat differently formatted links as different videos. [Parser and cache code](https://github.com/sthakur369/instagram-saved-library-app/blob/main/app.py).

Static review identified a browser risk around an inline `onclick` handler near line 860: HTML escaping alone does not safely escape an apostrophe inside JavaScript embedded in an HTML attribute. Do not copy this rendering pattern. Render untrusted export text as text and attach event listeners programmatically. This is a source-review finding, not a reproduced exploit. [Browser implementation](https://github.com/sthakur369/instagram-saved-library-app/blob/main/public/index.html).

Maintenance is limited in scope: the repository was readable and had commit history, but no local dependency/security audit or compatibility matrix was executed. Its lightweight parser concepts are useful; a second gallery/server would duplicate the new dashboard.

### MCP Video Analyzer

**PARTIALLY VERIFIED:** upstream source, release information, and documentation inspected. Version 0.11.0 was reported for the October 13, 2026 release; this is not an installed local version. The package is MIT licensed, requires Node >=22.12, uses TypeScript, and includes FastMCP, FFmpeg, browser/image/OCR dependencies and test tooling. Windows CI/configuration is present, but local Windows execution remains **NOT VERIFIED**. [Package](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/package.json), [releases](https://github.com/guimatheus92/mcp-video-analyzer/releases), [CI](https://github.com/guimatheus92/mcp-video-analyzer/tree/main/.github/workflows).

The documented interfaces include MCP and a one-shot CLI usable by shell-capable agents such as Codex; Claude configuration is documented. Extraction is separate from proving factual claims. The CLI can emit partial results with warnings, so a zero exit code alone cannot certify transcripts, OCR, and frames. Local processing is possible when suitable speech/OCR dependencies are available. Optional fallback providers can incur charges, especially if an OpenAI key is inherited. [Usage and provider behavior](https://github.com/guimatheus92/mcp-video-analyzer#readme).

A prior SSRF advisory affects versions through 0.10.0 and lists 0.10.1 as the fix. That advisory is relevant to selecting a reviewed version; it is not evidence that 0.11.0 has the same flaw. [GHSA-hpmc-4g74-v53v](https://github.com/guimatheus92/mcp-video-analyzer/security/advisories/GHSA-hpmc-4g74-v53v). Current security guidance also treats outbound destinations, external binaries, file paths, and credentials as sensitive boundaries. [Security policy](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/SECURITY.md).

Static review raised these integration concerns:

| Concern | Consequence and evidence |
| --- | --- |
| CLI persistent frame output | The default output cache is not automatically reaped; use a job-owned output directory and explicit cleanup. [CLI](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/cli.ts) |
| MCP cache/temp lifecycle | A retained single-video result can keep temporary files; cache eviction does not itself guarantee their deletion, and asynchronous cleanup at process exit is unreliable. [Analysis tool](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/tools/analyze-video.ts), [cache](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/utils/cache.ts), [temporary files](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/utils/temp-files.ts) |
| Cached frame paths | Batch cleanup can leave cached paths pointing at removed files. Validate returned assets before using them. [Analysis core](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/tools/analyze-core.ts) |
| Transcript/timeline ordering | Review found fallback transcription after timeline assembly, potentially omitting late transcript content from the timeline. Check transcript and timeline separately. [Analysis core](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/tools/analyze-core.ts) |
| Frame resource limit | A limit on returned frames is not necessarily a limit on temporary extraction work. Bound duration, bytes, and extraction rate externally. [Frame extractor](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/processors/frame-extractor.ts) |

These are source-review concerns and require focused regression tests before upstream integration. They were not reproduced against an installed analyzer in this task.

A safe later Cobalt integration would obtain media through the already established loopback API, then hand a bounded temporary local file to the analyzer. Native Cobalt support was not established. Broadly enabling private-URL access is unnecessary for the local-file approach.

**Decision:** defer analyzer installation/full reuse until approved and its cleanup/provider behavior is tested. The isolated proof of concept can reuse the installed FFmpeg now. This avoids silently installing another FFmpeg distribution, browser stack, OCR engine, speech model, or package dependency tree. Exact analyzer disk/model costs were **NOT VERIFIED**; model and native-binary sizes vary.

## Import and autonomous-update boundary

Meta provides an official account-information download path. [Meta account-information announcement](https://about.fb.com/news/2023/10/manage-your-information-across-apps/). No supported API for automatically reading this owner's private saved collections was verified: relevant Help/Developer requests were rate-limited during research. That is **NOT VERIFIED**, not proof that every possible supported integration is unavailable.

Use an owner-supplied official export or explicit pasted source links. Preserve collection names present in the export; do not infer missing collection membership as fact. Updated imports can identify additions by stable URL identity. Do not assume an absent item means it was deleted from Instagram, and do not treat an old export as a live collection.

Do not ask for Instagram passwords, extract browser cookies, bypass access controls, or scrape authenticated private collections. Deleted/private/login-restricted posts should remain unavailable with a clear reason. No actual saved-video accessibility, transcription, OCR, or source-based AI research is confirmed without the owner's input and working media/model services.

## Proposed integration and acceptance boundary

Keep the library, queue, database, temporary files, and project-context summaries inside the new workspace. Existing projects are read-only sources of architectural context. Approval of a recommendation records the owner's decision; it does not modify either project or enable trading.

The bounded workflow is: validated export/links → stable URL deduplication → at most three selected videos → at most two workers (default one) → temporary media → available transcript/frames/OCR → evidence-backed research → owner review.

Store source URLs, collection membership, necessary text excerpts, findings, citations, uncertainty, costs/risks, recommendations and status. Delete job-owned media and extracted frames after processing; interrupted jobs need startup cleanup and restart rules. Never delete Personafy downloads or unrelated files. Real cleanup/resume claims require tests of the implementation, separate from this inspection.

A local desktop/app subscription does not automatically provide a callable hosted API for an unattended service. No paid provider is enabled or used here. Local-model integration remains blocked at the inspected endpoint, and any source verification must retain actual reputable supporting links rather than manufacture citations.

The full real three-video acceptance run is **BLOCKED** by the missing export/three owner-selected videos and unavailable Cobalt/local-model endpoints. Fixture tests, offline adapters, and generated-media tests can verify mechanics; they cannot establish real Instagram accessibility or factual research quality. Continuous unattended background operation is **NOT VERIFIED** until explicitly implemented and tested.
