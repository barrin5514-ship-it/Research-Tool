# DeepSeek integration — October 24, 2026

DeepSeek is a separate text-only adapter. Research requests go only to https://api.deepseek.com/chat/completions, without redirects. Only bounded transcript text, OCR, source URL, collection names and existing project contexts are sent. No images, cookies or secrets are included in prompts. Keys remain in the ignored server-side .env file. The LM Studio adapter and loopback restriction remain intact. Claims stay NOT VERIFIED.

## Configuration

RESEARCH_PROVIDER=deepseek is the default. Local vision and evidence fallback remain optional and off by default. Dashboard batches start directly when the owner clicks Start batch; there is no spending cap or separate approval step. RESEARCH_DEEPSEEK_APPROVED is retained only for historical one-off scripts and does not gate dashboard batches. Opening the dashboard does not start processing.

## Usage and pricing

Provider-reported input/output/cache-hit tokens and conservative estimated costs are recorded before research parsing, including invalid model responses. The private ledger is .research-data/deepseek-usage.jsonl. Lifetime totals include all ledger entries; individual dashboard history shows recent non-fixture records. Unknown usage is labeled unknown rather than treated as a known zero charge. Failed model calls are never automatically retried.

Rates last checked October 24, 2026: deepseek-flash peak USD0.30 per million uncached input tokens, USD0.006 cached input and USD1.20 output. Source: https://api-docs.deepseek.com/quick_start/pricing/ . Estimates use these conservative rates; they are not invoices. Output remains limited to 1200 tokens, and thinking is disabled.

## Verification

93 automated Windows tests pass using synthetic jobs and stand-in providers; full output: docs/batches-windows-tests.txt. Earlier real three-video results are recorded in docs/DEEPSEEK_DEMO_RESULTS.md. No new video or paid research call was made while implementing batch controls and spending tracking.

## Adjustable batches and spending tracker

Choose 3, 5, 10 (default) or 25 videos and a collection, then click Start batch. At the owner's request there is no per-batch spending cap and no separate paid approval step. Starting a batch runs research. Merely opening the dashboard never processes videos.

Processing remains sequential with at least 20 seconds after each video finishes. The progress counter counts finished attempts, including failures. Time remaining starts from two minutes per video and adapts to observed durations; it is approximate. Stop after current video lets the active attempt finish and clean up, then prevents new work. A DeepSeek error stops the batch without a paid retry. Server restarts never automatically resume batches. Explicitly queued retries can be included, while fixtures and records not in a waiting state are excluded.

The tracker shows per-batch and lifetime Research Agent estimated spend and token totals, including earlier synthetic calls. Refresh DeepSeek balance performs a server-side GET to the official https://api.deepseek.com/user/balance endpoint. This is an account query, not a research/model request. The account balance includes other applications using that account; it is not estimated by subtracting this app's costs. A timestamp shows freshness. The key stays server-side. Historical one-off demo scripts retain their original guards.
