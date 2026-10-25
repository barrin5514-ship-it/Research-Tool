# MVP presentation verification — October 24, 2026

Deadline: Sunday October 25; presentation Monday October 26, America/New_York. Final real visual run completed October 24 at approximately 8:55 p.m. local time (JSON artifacts use UTC).

## What can be demonstrated honestly

The MVP imports and organizes Instagram posts, captures an accessible video through the existing browser fallback, extracts speech and on-screen text, performs optional local sampled-frame visual analysis, retains unverified research notes and project suggestions, and removes temporary media. It is not a fully autonomous fact-checker or a guarantee of whole-video understanding.

### Verified results

- Repository audit and all 71 existing tests passed before changes. A consistent private SQLite backup and metadata fingerprint were made before editing.
- Final automated suite: 74 passed. Coverage includes three-answer presentation, no invented usefulness, OCR/vision distinction, and checking later frames after an OCR failure.
- Four synthetic FFmpeg scenarios passed, including streaming WebM normalization and cleanup.
- Actual local synthetic extraction: Whisper recovered the expected sentence and Windows OCR recovered known text from five frames. This clean fixture is not a real-world accuracy score.
- Two fresh real Instagram free-evidence runs passed capture, transcription, OCR, protected HTTP link/start/state operations and cleanup. Cobalt failed; unsigned browser playback succeeded. Existing paid research was not overwritten.
- Final real run WITH local vision: 55.521 seconds, 35,700,563 bytes, six extracted frames, 827 transcript characters and two OCR text samples. Steam, Figma, Office, Intercom and Superhuman were recovered. One of the six frames was sent to the existing local Qwen3-VL-2B model; it returned visual observations including the prominent AI-cloned-apps headline, consistent with extracted OCR. HTTP dashboard result was 200.
- OCR failed on a sampled frame, but processing continued and recovered later text. OCR still misreads some characters and brand names. Transcription is intelligible but not word-perfect; no word-error-rate score is claimed.
- The actual vision result remains needs_analysis / NOT VERIFIED. Real visual observations were not independently ground-truthed frame by frame; the generated summary also interprets promotional claims, which are not established facts.
- Model-free analysis generated a tentative low-priority Dev Squad AI suggestion. The final visual model returned no project recommendations. No matches were invented to fill a presentation section.
- All real attempts removed their temporary recordings/audio/frames/cache, and production data fingerprints stayed unchanged. No new paid calls; the ledger still contains only two historical entries.

### Visual-model reliability check

After the owner requested a retry, the existing smallest vision model loaded locally, CPU-only, with one prediction and a 4,096-token context. Estimated memory was about 2 GiB. Memory remains tight while loaded.

An unlabeled synthetic image contained only a red circle and blue square, with no transcript or OCR hints. The first response recognized the shapes but invented a Sims 4 project association from the project context. That failed the broader quality check. The existing prompt was corrected to distinguish owner project context from source evidence and require explicit observable findings.

The final controlled test passed in 17.128 seconds: both shapes recognized, structured findings present, no invented project, no technologies/claims/recommendations. The model then passed the real one-frame inference path. These are narrow acceptance checks, not proof of general model accuracy. The model was unloaded after testing; default dashboard provider remains free evidence analysis with paid approval false.

No new models, packages or providers were installed. No Instagram extension implementation exists in this repository; none elsewhere was modified. Browser capture, audio, DeepSeek, optional visual adapter, imports, reviews and data are preserved.

## Presentation sequence

1. **My library:** show imports and collection filters. Explain that counters include preserved historical imports. Do not start the entire library.
2. **Research results:** show the saved real Instagram example answering What is this?, Why is it useful?, and What can I do with it? Open **Show more** for transcript, OCR, per-result vision status, claims and review controls. The old DeepSeek example remains historical: 1,454 measured tokens and estimated USD 0.0012723, not a new charge or a free regeneration.
3. **Project ideas:** show suggestions and the unmatched **New ideas** area. Recommendations cannot modify projects.
4. For a fresh free demonstration, use the acceptance harness in README. It uses an isolated library, preserving production research. `--vision` stages capture/transcription first, then loads the existing model for one frame and unloads it afterward. It is slower and memory-sensitive; test before presenting. Instagram may reject access, so the saved real result is the fallback.
5. Say explicitly: speech and OCR work with recognition errors; sampled visual inference is demonstrated on a controlled image and one real frame. Whole-video understanding, robust accuracy across other clips and semantic fact verification are not established. All claims remain NOT VERIFIED.

## Evidence

- MVP_AUDIT.md — audit before edits; its initial unloaded-model observation is historical.
- MVP_REAL_INITIAL_ACCEPTANCE.json — initial free real run before OCR continuation fix.
- MVP_REAL_ACCEPTANCE.json — free real evidence run after the OCR fix.
- MVP_VISION_INITIAL_ACCEPTANCE.json — initial controlled-image context hallucination.
- MVP_VISION_ACCEPTANCE.json — passing controlled visual-only recognition after prompt correction.
- MVP_REAL_VISION_ACCEPTANCE.json — fresh real capture through local visual inference.
- mvp-windows-tests.txt, mvp-media-tests.txt, mvp-native-tests.txt — automated and actual local synthetic outputs.

Production data remain 1,187 records with the queue paused. Private backup and acceptance databases stay ignored by Git. No API keys, raw exports or database files are committed. No target project or Cobalt files were modified.
