# DeepSeek integration — October 24, 2026

Baseline commit created before edits: `c556e62`.

DeepSeek is a separate text-only adapter. Its fixed destination is `https://api.deepseek.com/chat/completions`; redirects are refused and no configurable remote base URL exists. Tests inject a local stand-in transport; production uses normal fetch. The existing LM Studio loopback restriction and adapter remain intact. Curated documentation retrieval remains separate from the DeepSeek request.

Only bounded transcript text, OCR text, the Instagram source URL, collection names and existing project contexts are sent. Frames, image data, cookies and the API key are never included in the prompt. DeepSeek suggestions use the existing result shape. Model citations/verification claims are discarded and claims remain NOT VERIFIED; text analysis does not establish visual reasoning or independent fact-checking.

## Configuration and approval

An ignored `.env` file was created with an empty key, evidence-only provider, and paid calls disabled. Put your key in this local file using an editor; do not paste it in chat. `.env.example` contains placeholders only. The launcher and npm start load `.env` server-side. The browser receives no environment values or API key.

`RESEARCH_PROVIDER=deepseek` selects the adapter. `RESEARCH_DEEPSEEK_APPROVED=1` enables paid requests, and must only be set after explicit owner approval. Current defaults are `RESEARCH_PROVIDER=evidence` and `RESEARCH_DEEPSEEK_APPROVED=0`. No real DeepSeek request has been made. No key was copied from another project.

## Usage and pricing

Successful API responses record provider-reported input/output/cache-hit token counts and a USD cost estimate before research parsing, including when model output is invalid. The append-only ledger is `.research-data/deepseek-usage.jsonl`; the dashboard shows the latest100 call records. Missing provider usage is shown as unavailable rather than zero. A transport/HTTP failure cannot establish billable token counts; checking the provider account is required in that case. Automatic paid request retries are not implemented.

Rates checked against https://api-docs.deepseek.com/quick_start/pricing/ : deepseek-flash peak USD0.30/M uncached input, USD0.006/M cached input and USD1.20/M output. Peak rates are deliberately used for conservative estimates; actual off-peak bills may be lower. Model thinking is disabled and output is capped at1200 tokens. Pricing can change; recorded rates and date accompany estimates.

Example estimate: 5000 uncached input tokens plus1200 output tokens costs USD0.00294 at these rates, about0.3 US cents. This is a scenario estimate, not a guaranteed cap on arbitrary transcript input. A first small synthetic test would send no private video content and should cost less; owner approval is still required.

## Verification

All53 Windows automated tests pass, including a real local stand-in HTTP server. Complete output: `docs/deepseek-windows-tests.txt`. Tests verify the fixed official request address, plain-text-only payload, project contexts, auth isolation, approval gate, no image reads, usage arithmetic, invalid-output usage recording, and generic sanitized errors. All prior tests pass. JavaScript syntax and Git whitespace checks also pass.

Unverified: a real key/account balance, real DeepSeek response compatibility, actual billed cost, recommendation quality, and the dashboard with a live paid result. No paid calls were made and no target projects or Cobalt files were changed. Usage UI is implemented but has not been visually checked with a live result.

Changed files: `.gitignore`, `.env` (ignored, blank key), `.env.example`, `Start Research Library.cmd`, `package.json`, `src/deepseek.mjs`, `src/deepseek-usage.mjs`, `src/server.mjs`, `src/processor.mjs`, `public/index.html`, `public/app.js`, `test/deepseek.test.mjs`, this report and the full test-output file. Existing `.processor-test-*` scratch directories were excluded from the baseline commit and ignored without deleting them.
