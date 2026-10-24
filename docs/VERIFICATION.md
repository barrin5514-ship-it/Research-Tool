> Current infrastructure status: see [INFRASTRUCTURE_STATUS.md](INFRASTRUCTURE_STATUS.md). Earlier test/service snapshots below are historical.

# Proof-of-concept verification

User-facing date: **October 23, 2026 (America/New_York)**. All development changes are isolated in `C:\Users\barri\Documents\ChatGPT\Research Agent`.

Overall status: **PARTIALLY VERIFIED**. This is a tested import/queue/media-extraction foundation with a dashboard, not a verified autonomous research engine. There were **zero real Instagram videos analyzed**. The user confirmed that an export is not ready.

## Acceptance evidence

| Requirement | Status | Evidence and limitation |
|---|---|---|
| Existing environment identified | VERIFIED | Personafy, Pennywise and Cobalt located and source-inspected; details in INSPECTION.md. |
| Existing baseline tests | VERIFIED | Personafy Cobalt adapter: 15/15. Pennywise pure contract/data-model: 16/16. Full UI/provider/trading suites were not run. |
| Official export import | PARTIALLY VERIFIED | Representative HTML/JSON fixtures pass; actual owner export not supplied. ZIP must be extracted manually. Unsupported structures fail or warn explicitly. |
| Collection names and URLs | PARTIALLY VERIFIED | Tests preserve explicit names and multiple memberships; absent membership stays Unassigned. No promise that Meta includes all collections in every export. |
| Duplicates and updated exports | VERIFIED | Shortcode normalization merges aliases and tracking variants; repeat imports preserve completed results/reviews. Older missing records remain as history. |
| Persistent processing state | VERIFIED | Real SQLite close/reopen test preserves results and recovers interrupted jobs. Graceful cancellation returns active jobs to pending and restores attempt accounting. |
| Bounded batch and retries | VERIFIED | At most three distinct records per batch; concurrency restricted to one or two; simulated two-worker test, retry timing and maximum attempts pass. Pause cannot replace an active cohort. |
| Live Instagram/Cobalt access | NOT VERIFIED | Cobalt at 9100 was stopped; stand-in HTTP contracts and malicious response paths were tested. No real source URLs provided. |
| Real local media decoding | VERIFIED | Three synthetic MP4s processed with installed FFmpeg/ffprobe; 1/3/6 frames extracted. Audio extraction exercised on the third. Synthetic fixtures do not validate social-media access or research. |
| Temporary media cleanup | VERIFIED | Success/failure/cancellation tests, ownership-marker recovery, Windows junction defense, and synthetic smoke cleanup pass. Only known owned attempt directories may be removed. |
| Transcript extraction | BLOCKED | No speech-to-text backend configured. WAV extraction is not transcription. |
| OCR and visual reasoning | NOT VERIFIED | Frames extracted; optional local vision adapter implemented, but no loaded local model was available for an inference test. |
| AI research and project recommendations | PARTIALLY VERIFIED | Local-only request/structured-output code and project contexts exist. Normalization tests reject claimed verification/citations; real model output/usefulness has not been tested. |
| Important factual claims verified | BLOCKED | Independent research retrieval and source-evidence verification are not connected. Claims remain NOT VERIFIED. |
| Dashboard | VERIFIED | Browser renders the empty library, responsive layout, export input and manual-link form. Missing files and invalid links show useful messages. API tests cover import/dedup, CSRF/Origin/Host restrictions. Real recommendation review UI is not tested with a live AI result. |
| Approval boundary | VERIFIED | Status-only review; no implementation/trading/project-write integration exists. Replacing findings resets old approvals. |
| Continuous background autonomy | NOT VERIFIED | Foreground/local process only. No auto-start, scheduled task, folder watcher, or continued operation after server shutdown. |
| Complete real three-video workflow | BLOCKED | Needs export/three accessible videos plus transcription and independently researched findings. |

## Automated test results

Command from the Research Agent folder:

```powershell
node --test --test-concurrency=1 test/*.test.mjs
```

Final observed result: **38 tests, 38 passed, 0 failed, 0 skipped**, approximately 2.30 seconds in the final run. This includes 12 importer tests, 14 processor safety tests, one SQLite persistence test, three server/research tests, and eight store/queue tests.

```powershell
node scripts/media-smoke.mjs
```

Observed result: **3 synthetic clips passed**, yielding **1, 3, and 6 frames**. Third fixture also exercises local WAV extraction with an explicitly fake callback returning no research. All statuses stay `needs_analysis`, all verification labels stay `NOT VERIFIED`, and test media/scratch directories are removed. There is no fabricated transcript, claim verification, or live Instagram success.

Initial sandbox runs blocked local sockets and some native processes. Personafy's first adapter run therefore failed 12 HTTP tests; the same 15 tests passed outside that restriction with approved execution. Do not interpret the initial sandbox failures as a Personafy regression. The final local socket and media tests used approved execution outside that sandbox.

## Bugs found and resolved before handoff

- Cross-record HTML regex could attach a creator's Name row to a following collection; importer fixtures caught and corrected it.
- Pausing and immediately starting could replace an active three-video cohort; new starts wait for active jobs to finish.
- A replaced recommendation could retain old approval; new findings now reset review to New.
- Graceful shutdown stored cancellation as failure; it now restores pending state for later resumption.
- Skipped-video reasons/warnings were hidden; dashboard now displays them.
- A null model claim discarded otherwise valid research; malformed claims are filtered.
- Narrow dashboard columns overflowed; responsive columns now shrink correctly.
- A host-header test used fetch, which did not send the override as intended; raw local HTTP confirmed the server's host restriction.

## Preservation and costs

No new package/model/tool installation occurred. No paid API requests, Instagram login/cookie access, or real trades occurred. Cobalt and Personafy services were not started or altered. Their stopped state prevented a full live-functionality check.

Personafy was clean in the initial Git baseline. Pennywise's six pre-existing changes were identical before and after its guarded tests, and nine checked file fingerprints plus HEAD were unchanged. No modifications were made to those repositories; preserving an existing dirty state is intentional.

Final read-only Git checks also confirmed Personafy and Cobalt clean, with Pennywise still showing the same six pre-existing changes. A workspace scan found no retained video, audio, or extracted frame files; the separately saved dashboard screenshot is a UI preview. The library's graceful shutdown endpoint was exercised successfully, its lock disappeared, and the local dashboard was reopened for handoff at `http://127.0.0.1:5199`.

The BMad build launcher failed before implementation with a Python/sandbox temporary-file permission error. The user explicitly authorized bypassing that workflow and building directly with existing tools. That authorization did not include installing tools, paid services, or editing the other projects.

## Next acceptance gate

Use an actual official export and three owner-selected accessible videos. First verify import/membership/dedup against Instagram's visible collection. Then verify local Cobalt retrieval, transcript correctness, sampled visual evidence, independent sources, project fit, retry/resume, and zero remaining temporary media. Broaden processing only after that end-to-end check is passed and the owner authorizes expansion.
