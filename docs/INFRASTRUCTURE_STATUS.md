# Infrastructure status — October 23, 2026

## Verified without installations

- Original 41 tests passed; current suite is 44/44 passing, including the upstream transcript-array regression and native extraction contracts.
- Cobalt 11.7.1 was installed but stopped. Started its existing API with unchanged loopback settings. HTTP 200 confirms 127.0.0.1:9100 and Instagram service registration. Logs are inside Research Agent. This does not prove access to any specific Instagram video.
- LM Studio was installed with downloaded text and vision models but its HTTP server was stopped. Initial CLI authentication timed out during severe laptop sluggishness; a later normal retry started loopback server1234. Its real model-list API responds; no credentials/security settings changed and no inference model was loaded.
- Windows System.Speech en-US and Windows.Media.Ocr work without installs. Exact synthetic sentence and text assertions passed. Integrated video test recovered the expected sentence plus text from five frames, removed its attempt media, and retained needs_analysis status.
- Three existing synthetic media tests again passed frame/audio extraction and cleanup. SQLite reopen and graceful interruption remain covered by automated tests.
- Outbound Node research fetch failed until standard --use-system-ca --use-env-proxy startup flags were used. Real SQLite documentation retrieval now succeeds with supporting URL/excerpt; TLS verification remains enabled. Flags are in package start and the Windows launcher.

## Changes

Windows extraction is enabled by default on Windows; set RESEARCH_WINDOWS_EXTRACTION=0 to disable it. It operates only on bounded temporary WAV/frame files already created by the worker. Recognized text is retained; media is removed. OCR text appears in the preserved dashboard. A native end-of-file exception initially discarded speech; the corrected adapter preserves recognized segments at stream exhaustion. The analyzer integration now handles its actual transcript array format. MCP Video Analyzer itself remains optional and uninstalled.

Tests distinguish mocked contracts from live execution: 44 automated tests include stand-in services; native smoke scripts actually exercise Windows speech/OCR and FFmpeg. No real Instagram acceptance has occurred, no AI inference/quality test has passed, and background-source retrieval is not semantic fact verification.

## Resources and dependency decision

Laptop: 8 logical cores, 15.75 GiB RAM, roughly 1.1–2.4 GiB free during checks. Initial test run took 194 seconds under load; later final suite about 1.6 seconds. Keep default concurrency one. Existing smallest Qwen3-VL model plus projector occupies about 1.8 GiB on disk; LM Studio estimates 1.99 GiB runtime memory with 2048-token context. Intel UHD uses shared resources. Leave it unloaded until adequate memory headroom is available, preferably at least 3 GiB free for a controlled inference trial. Model-list connectivity is verified; inference is not.

Native speech/OCR adds no downloaded model or per-request API fee. Accuracy on noisy, accented, musical or multilingual Instagram clips is not established by a clean English synthetic fixture. Whisper.cpp is a possible upgrade: official documentation lists tiny at 75 MiB disk/~273 MB memory, base142 MiB/~388 MB, excluding runtime overhead. CPU-only operation is supported. Reserve roughly 0.5 GiB installation/model space pending a reviewed Windows artifact; use one worker/two threads. Source: https://github.com/ggml-org/whisper.cpp#memory-usage . Installation approval was requested; no installation occurred. The Windows path is usable independently of that optional approval.

## Remaining blockers

- Supply an actual official Saved export or three public video links for Instagram accessibility, noisy speech/OCR accuracy and end-to-end research validation.
- Free memory before loading the existing vision model. No additional model download is required for that trial.
- Semantic claim verification and recommendation-quality evaluation remain incomplete. Current curated documentation retrieval covers only a few technologies; background links do not establish claim support. Trading claims remain unverified hypotheses.
- MCP Video Analyzer package/dependencies are not installed. Windows-native extraction is the tested no-install alternative; its optional CLI adapter remains available for a later approved installation.
- Services run as local processes, not verified reboot-persistent Windows services. Cobalt was started through its existing entry point; LM Studio through its existing lms CLI. After reboot they must be started again with their established local workflows.

## Owner readiness

The dashboard accepts recognized extracted Saved HTML/JSON files for Pennywise, Personafy and Tech, preserving unknown memberships, deduplication and prior research. Actual export compatibility is still unverified. No database reset, target-project edit, permanent video collection, paid API call, or new software installation was performed. Existing library data is preserved.

Run: node scripts/native-pipeline-smoke.mjs for the live local synthetic check. Run: node --test --test-concurrency=1 test/*.test.mjs for automated tests. Launch the dashboard with Start Research Library.cmd to use the repaired network flags.

## Approved Whisper installation

The owner approved project-local Whisper. Official Windows x64 CPU binaries v1.8.3 and the tiny.en model are now installed under .research-data/tools/whisper. The newer v1.9.5 release had no binary assets, so v1.8.3 is pinned to an available official CPU build. Published archive/model SHA-256 checks passed; INSTALL.json records sources/hashes and LICENSE preserves upstream terms. No system PATH or global installation was changed.

Whisper is automatically preferred for speech when its local files exist, with CPU-only inference, two threads, one processor and a 120-second subprocess timeout. Windows speech remains a fallback and Windows OCR remains connected. All 46 automated tests pass. A live synthetic video yielded the expected transcript and five OCR frames; scratch cleanup passed. No real Instagram or model reasoning validation is implied. No paid APIs used.

## Latest no-install completion pass

All 49 automated tests pass; the integrated live synthetic Whisper/OCR/cleanup test passes again. Cobalt and LM Studio return HTTP200; no model is loaded and free RAM was about1.1GiB. No further installation or paid call occurred.

The default no-model fallback now retains source excerpts, retrieves curated documentation, matches collections/keywords to projects, and ranks tentative recommendations by explicitly declared usefulness/cost/risk. Unknown values are penalized rather than guessed. Model-free results retain NOT VERIFIED and needs_analysis labels, and visual-reasoning status is not marked analyzed. A live SQLite example retrieves its official documentation; semantic claim support and recommendation quality still require review. Existing full AI mode remains optional.

The export can be imported, but real three-video validation awaits owner data/links. Freeing memory is required before safely loading the installed vision model. No additional approval is needed for the now-installed Whisper backend. The older pending-install paragraphs are historical.
