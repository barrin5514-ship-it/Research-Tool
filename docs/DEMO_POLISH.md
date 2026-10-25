# Demo polish — October 25, 2026

## Labels and counts

The five My library counts are Discovered, Excluded, Left to do, Summary ready and Failed, each with a short explanation. Summary ready checks saved DeepSeek provenance, not the internal completed status. This correctly counts successful summaries whose claims still need checking. Test fixtures are hidden as before. Current acceptance showed 1,186 discovered, 820 excluded, 356 left to do, 10 real saved DeepSeek summaries and zero non-excluded failed downloads. The spending card uses the same distinct summary count; its details retain recorded call totals, tokens, tests and retries. Paid call count is not the number of distinct usable summaries.

Not started replaces Waiting. Extracted records without a DeepSeek result show Ready for analysis. Saved DeepSeek results show Summary ready · claims not checked. Original internal statuses and all saved research remain unchanged. Older DeepSeek records without structured bullets display their actual saved short summary. Excluded reference/skipped details live under Give me more. Failed posts have a readable reason and Try again; retry returns them to the queue without automatically starting a paid batch.

Each saved DeepSeek result has a disabled Check claims (coming soon) button. It has no handler, endpoint or provider request. No fact-checking is implied or added.

## Batch display and results

The latest batch shows its picked posts, titles, collections and Up next / Working on it / Done / Failed labels. Failed attempts have a short reason. Selected posts are highlighted in the to-do library and results. Finished DeepSeek summaries disappear from the to-do list and appear in Research results on the existing automatic poll, without manual page refresh. Failed/incomplete attempts remain available for retry. Latest batch membership is restored from the existing private batch record after a dashboard restart; restoring it never starts work.

Just finished filters Research results to that latest batch. Batch status uses plain language, rounded estimated dollars and an approximate remaining time; unknown costs are shown as unknown. Browser acceptance showed the actual prior three-post batch, one failed analysis and two posts up next, with one result in Just finished. That pre-existing batch had already stopped on a DeepSeek failure before this task; it was not rerun.

## Project cards

The duplicate My projects / Project ideas lists are merged into one card per project. Each has the owner's exact plain description, matched ideas as short bullets with DeepSeek before Older keyword match, Combine ideas, and Edit / Turn off controls at the bottom. No Read the research result links remain. Full recommendation wording is retained under Give me more. Existing delete confirmation and older-result rechecks remain available inside Edit. Empty cards say No matches yet. New ideas remains a separate card.

The five supplied descriptions are stored in SQLite in a one-time migration. Each prior description is preserved verbatim in project_details and displayed under Give me more. Later owner edits are not overwritten on restart. Form fields survive regular polling because only the ideas/combination slots are refreshed when project definitions have not changed.

## Future food analyses

The existing DeepSeek call now asks for recipe ingredients and numbered instructions instead of the three usual answer sections for food collection posts. The prompt requires only already-gathered transcript, OCR and caption facts, amounts only when given, and no invented ingredients, times, temperatures or steps. Partial or comment-for-recipe clips must mark the full recipe as not shown. The renderer displays the exact line Full recipe not shown in the video when that flag is false.

Validation and result persistence accept the recipe format so the changed prompt can be used by future analyses. Existing food videos were not reprocessed, rewritten or populated with invented recipe cards. Recipe behavior was tested with a stand-in response only; live recipe accuracy remains unverified.

## Verification and preservation

119 automated Windows tests passed, zero failures. Full output: docs/demo-polish-windows-tests.txt. Added tests cover provenance-based summary counts, pending/ready labels, preserved project technical details and later edits, future partial recipes, short project bullets, and batch post/collection/outcome restoration. All model calls in tests use stand-ins.

Browser checks confirmed five count cards, ten disabled claim-check buttons, three picked posts, Just finished, five unique merged project cards, exact descriptions, no duplicate list or Read the research result links, and retained New ideas. Screenshots are private/ignored: .research-data/demo-library.jpg, .research-data/demo-results.jpg and .research-data/demo-projects.jpg.

A private pre-change SQLite backup is .research-data/before-demo-polish-20261025.sqlite. Original video rows and usage-ledger bytes match the pre-task baseline. The prior descriptions match their preserved technical-detail copies. Server reloads followed idle checks; no live batch was interrupted. No paid calls or real video processing ran during this task, and no other project or Cobalt files changed.
