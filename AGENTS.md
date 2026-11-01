# Bolo house rules — Research Agent

These instructions apply to every AI tool working in this repository. If a
tool-specific instruction conflicts with these rules, stop and ask Bolo.

## Rules

1. **Beginner comments in code.** Any code you change gets short,
   plain-English comments explaining what it does and why.
2. **No surprise paid calls.** Never make a paid API call without showing the
   estimated cost and waiting for Bolo's explicit OK. Showing a saved plan is
   free and does not need approval.
3. **Never expose secrets.** Do not print, log, commit, or paste `.env` values,
   API keys, tokens, passwords, or database URLs. You may compare them locally
   without displaying them.
4. **Keep DeepSeek.** `RESEARCH_PROVIDER` must remain `deepseek`. Confirm it at
   the end of every task without printing the rest of `.env`.
5. **Other projects are read-only.** Do not touch Pennywise, Personafy,
   CoachLab, Dev Squad AI, Cobalt, or any other project unless Bolo explicitly
   says to. Reading is fine. Never change another project's code, data,
   profile, or browser session.
6. **Finish every task the same way.**
   - Run all tests in the affected project(s).
   - Save the complete test output under `docs/`.
   - Update `PROMPT_LOG.md`.
   - Make a small, focused commit.
   - Push it.
   - Report the commit hash.
7. **Explain results plainly and briefly.** Lead with what changed, what was
   tested, and any limitation. Avoid jargon.
8. **BMAD only for big new features.**
   - Plan first: what it does, user stories, and which files it touches.
   - Show the plan and wait for Bolo's OK.
   - Build only after approval.
   - Test as a separate step.
   Small fixes skip BMAD and are done directly.

## Start and finish

At the start: read the relevant files and tests, check whether this is a big
feature (BMAD) or a small fix, and check whether any paid call is involved.

Before reporting: use the finish checklist below.

- [ ] Beginner comments added to changed code.
- [ ] No paid call without cost estimate and Bolo's OK.
- [ ] No secret values printed or committed.
- [ ] `RESEARCH_PROVIDER=deepseek` confirmed.
- [ ] No other project changed without permission.
- [ ] Full tests run; exact output saved in `docs/`.
- [ ] `PROMPT_LOG.md` updated.
- [ ] Small commit pushed.
- [ ] Commit hash reported.
- [ ] Plain-English summary with limitations.
- [ ] BMAD plan approved before building, if this was a big feature.

## What these rules do not permit

They do not permit editing other projects, making paid calls, resetting
databases, or changing the research provider. They do not replace tests or
Bolo's approval.
