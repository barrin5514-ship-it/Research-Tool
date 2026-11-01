---
name: bolo-house-rules
description: Apply Bolo's house rules to every Research Agent task. Use at the start and end of a task for beginner comments, paid-call approval, secret safety, deepseek provider confirmation, project isolation, tests/PROMPT_LOG/commit/push, short plain-English reports, and BMAD only for big features.
---

# Bolo house rules

These rules apply to work in the **Research Agent** project. Read them at the
start of a task and use the checklist before reporting back.

## The eight rules

1. **Beginner comments.** Add short, plain-English comments to any code you
   change. Explain what the block does and why, not just what the syntax means.
2. **No surprise paid calls.** Never call a paid API without first showing the
   estimated cost and waiting for Bolo's explicit OK. A saved plan may be
   shown without another call.
3. **Never expose secrets.** Do not print, log, commit, or paste `.env` values,
   API keys, tokens, passwords, or database URLs. Compare secrets locally
   without displaying them.
4. **Keep DeepSeek.** `RESEARCH_PROVIDER` must stay `deepseek`. Confirm it at
   the end of every task without printing the rest of `.env`.
5. **Other projects are read-only.** Do not edit Pennywise, Personafy,
   CoachLab, Dev Squad AI, Cobalt, or any other project unless Bolo explicitly
   says to. Reading is allowed. Never change their code, data, profiles, or
   browser sessions.
6. **Finish every task the same way.**
   - Run all tests in the affected project(s).
   - Save the complete test output under `docs/`.
   - Update `PROMPT_LOG.md`.
   - Make a small, focused commit.
   - Push it.
   - Report the commit hash.
7. **Short and plain.** Explain the result in plain English. Lead with what
   changed, what was verified, and any limitation. Avoid jargon.
8. **BMAD only for big features.** For a big new feature:
   - Plan first: what it does, user stories, and which files it touches.
   - Show the plan and wait for Bolo's OK.
   - Build only after approval.
   - Test as a separate step.
   Small fixes skip BMAD and are done directly.

## Working order

1. Read the relevant files and existing tests before editing.
2. For a big feature, present the BMAD plan and stop for approval.
3. Make the smallest change that solves the request. Keep beginner comments.
4. Do not touch another project. Read-only inspection is fine.
5. If a paid call is needed, show the estimate and wait for an explicit OK.
6. Run the full test suite. Save the exact output to `docs/`.
7. Update `PROMPT_LOG.md` with what changed, verification, and any limits.
8. Commit and push. Report the hash, test counts, and the confirmed provider.

## Finish checklist

- [ ] Beginner comments added to changed code.
- [ ] No paid call without a cost estimate and Bolo's OK.
- [ ] No `.env` value, key, token, password, or database URL printed or committed.
- [ ] `RESEARCH_PROVIDER=deepseek` confirmed.
- [ ] No other project changed without permission.
- [ ] Full tests run and exact output saved in `docs/`.
- [ ] `PROMPT_LOG.md` updated.
- [ ] Small commit pushed.
- [ ] Commit hash reported.
- [ ] Plain-English summary with limitations.
- [ ] BMAD plan approved before building, if this was a big feature.

## What this skill does not do

It does not grant permission to edit other projects, make paid calls, reset
databases, or change the research provider. It does not replace project tests
or the owner's approval.
