import {readFile,writeFile} from 'node:fs/promises';
const initial=await readFile('C:/Users/barri/.codex/attachments/bac1315f-f958-4e40-ac6d-e769f30c645d/Pasted text.txt','utf8');
const infrastructure=`PROJECT: Autonomous AI Research Agent
LOCATION: C:\\Users\\barri\\Documents\\ChatGPT\\Research Agent

ROLE: Senior AI Integration Engineer and Software Developer

OBJECTIVE:
Finish the missing infrastructure for autonomous
Instagram video research.

TARGET COLLECTIONS:
- Pennywise
- Personafy
- Tech

PHASE 1 — INSPECT
- Read all existing project documentation.
- Verify the current integrations and 41 tests.
- Check laptop resources and dependencies.
- Diagnose why Cobalt and AI are unreachable.
- Preserve all existing project data.

PHASE 2 — DEPENDENCIES
- Inspect MCP Video Analyzer requirements.
- Identify lightweight speech, OCR, and visual tools.
- Prefer free local processing.
- Estimate memory, CPU, disk, and costs.
- Request approval before installing software.

PHASE 3 — CONNECT
- Locate and verify the existing Cobalt service.
- Restore connectivity using safe, reversible changes.
- Identify existing AI providers and test connectivity.
- Do not assume subscriptions include API access.
- Do not modify Personafy or Pennywise.

PHASE 4 — COMPLETE PIPELINE
- Import Instagram saved collections.
- Retrieve accessible videos using Cobalt.
- Extract transcripts, frames, and on-screen text.
- Analyze the content and research its claims.
- Attach supporting sources.
- Match findings to Pennywise or Personafy.
- Rank recommendations by usefulness, cost, and risk.
- Resume interrupted batches and avoid duplicates.
- Remove temporary media after processing.

PHASE 5 — SAFETY
- Start with one video at a time.
- Minimize RAM, CPU, and disk usage.
- Do not retain permanent video downloads.
- Protect secrets and existing files.
- Do not bypass Instagram security.
- Require approval before modifying target projects.
- Never spend money without approval.

PHASE 6 — VERIFY
- Run all existing and new tests.
- Test synthetic transcription and OCR.
- Verify service connectivity and cleanup.
- Test research accuracy with known examples.
- Verify the dashboard and resume functionality.
- Run three real Instagram videos when available.
- Clearly distinguish mock tests from live tests.

PHASE 7 — REPORT
Explain in beginner-friendly language:
- What works
- What was fixed
- What is still blocked
- Which tools are actually connected
- Any costs or resource concerns
- Whether the export can be imported
- What approval or action is needed next

START:
Inspect first, then safely implement and test
everything possible without new installations
or external project changes. Request approval
for those actions when needed.`;
const github=`PROJECT: Autonomous AI Research Agent
TASK: Verify and Complete GitHub Integrations

You previously built my Research Agent at:
C:\\Users\\barri\\Documents\\ChatGPT\\Research Agent

I want you to inspect the current implementation and
complete the integration of these two repositories:

1. Instagram Saved Library
https://github.com/sthakur369/instagram-saved-library-app

2. MCP Video Analyzer
https://github.com/guimatheus92/mcp-video-analyzer

INSTRUCTIONS:

PHASE 1 — VERIFY
1. Inspect the existing Research Agent.
2. Determine whether either repository is integrated.
3. Identify functionality already implemented.
4. Identify missing functionality.
5. Review both repositories for compatibility,
   security, licensing, and dependencies.

PHASE 2 — IMPLEMENT
If useful functionality from either repository
has not been integrated:

1. Integrate the compatible components.
2. Avoid duplicating features that already work.
3. Preserve the existing Research Agent dashboard.
4. Reuse my existing Cobalt integration where possible.
5. Support importing Instagram saved collections.
6. Support automated batch video analysis.
7. Support temporary video processing without
   permanently storing downloaded videos.
8. Connect the analysis pipeline to an available
   AI provider where technically feasible.
9. Include transcription and visual analysis.
10. Add independent fact-checking with source links.

If a repository is incompatible, insecure, or
unnecessary, explain why and implement a safe
alternative when feasible.

PHASE 3 — TEST
1. Run all existing automated tests.
2. Test the new integrations independently.
3. Verify temporary media cleanup.
4. Verify that batch processing can resume.
5. Confirm existing dashboard functionality.
6. Run a three-video real-world test when
   sample links or export data become available.

IMPORTANT:
Do not modify Pennywise or Personafy.
Do not disrupt the existing Cobalt installation.
Do not install software requiring additional
permissions without my approval.
Do not use paid APIs without approval.
Do not claim functionality works without testing.

You are authorized to implement and test changes
inside the isolated Research Agent project.

PHASE 4 — REPORT
Explain in beginner-friendly language:

- What was already integrated.
- What you added.
- What works now.
- What still needs testing.
- What is blocked.
- Whether the Research Agent is ready for
  my Instagram export.

Double-check your code and test results.

BEGIN.`;
const deepseek=`Codex task: Connect DeepSeek to the Research Agent

Project folder: C:\\Users\\barri\\Documents\\ChatGPT\\Research Agent

1. Make a first Git commit of the current project before changing anything.
2. Add a DeepSeek research adapter as a separate file. Do not delete the existing LM Studio adapter.
3. Send DeepSeek the transcript, the OCR text and the source URL. DeepSeek's API is text-only, so do not send images.
4. Keep the API key server-side, in a local .env file. Add .env to .gitignore, never send the key to the browser, and never print it in logs.
5. Allow outbound requests only to DeepSeek's official API address. Keep the existing local-only check for LM Studio.
6. Reuse the existing output format and project contexts (Pennywise, Personafy, Tech). Claims must stay "NOT VERIFIED."
7. Record the token usage and estimated cost of each call, and show both on the dashboard.
8. Add tests that use a stand-in DeepSeek server, so the tests make no paid calls.
9. Stop and ask the owner before making the first real DeepSeek call. State the expected cost before asking.
10. Do not modify Pennywise, Personafy, Dev Squad AI, or the Cobalt installation.
11. Report back with:
    - The full Windows test output
    - The files you changed
    - What is still unverified`;
const approval=`Approved: one synthetic DeepSeek test call, max $0.01. I have entered the key in .env.
Before the call:
1. Commit the DeepSeek changes.
2. Create docs/PROMPT_LOG.md as previously requested, including all prompts so far.
After the call, report: the actual tokens used, the actual cost, whether the response parsed correctly, and the dashboard result. Do not make any further paid calls without approval.`;
const entries=[['Initial pasted project request',initial],['Export availability reply','I don’t have an export ready yet'],['Direct-build approval','Yes—build directly with existing tools'],['GitHub integration completion request',github],['Infrastructure request (first occurrence)',infrastructure],['Whisper installation approval','Approve project-local Whisper installation'],['Infrastructure request (repeated)',infrastructure],['DeepSeek adapter request',deepseek],['One-call approval and prompt-log request',approval]];
let log='# User prompt log\n\nCreated October24,2026 before the first paid test. Scope: user task prompts and approvals visible in this conversation; excludes credentials, ambient UI/environment blocks, system/developer instructions and tool results. Formatting normalized; no earlier request outside the available conversation is asserted. The infrastructure request appeared twice and is recorded twice.\n\n';
for(const [title,text]of entries)log+='## '+title+'\n\n```text\n'+text+'\n```\n\n';
log+='## Research runtime prompts at commit time\n\nThe exact system/user construction templates are preserved below; runtime transcript/OCR values are not private user data in this log.\n\n';
for(const file of ['src/deepseek.mjs','src/research.mjs','src/evidence-research.mjs','scripts/deepseek-one-shot.mjs'])log+='### '+file+'\n\n```javascript\n'+await readFile(file,'utf8')+'\n```\n\n';
await writeFile('docs/PROMPT_LOG.md',log);
