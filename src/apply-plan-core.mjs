// Shared prompt and validation for an "apply this idea" plan. This file deliberately
// has no network code so both the manual button and automatic analysis can use it.
export const APPLY_MAX_USD = 0.01;
export const APPLY_MAX_OUTPUT_TOKENS = 900;

export function applyPayload({ project, idea, sourceSummary, files, videoId = null }) {
  return {
    model: 'deepseek-flash',
    thinking: { type: 'disabled' },
    max_tokens: APPLY_MAX_OUTPUT_TOKENS,
    stream: false,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Plan one small change to the supplied project. Use only the supplied idea, project profile and read-only file names. Never invent a feature, file, API, dependency or fact that the idea does not mention. If the project profile or file list shows the idea is already present, set alreadyHave true and explain briefly; do not pretend it is missing. Return JSON {plan:{changes,touches,effort,alreadyHave,alreadyHaveReason,buildPrompt}}. changes = what this idea would add or change, in plain English. touches = which part of the project it touches. effort = exactly small, medium or big. alreadyHave = true only when the supplied profile/files show it already exists. buildPrompt = a self-contained copy-paste prompt for the builder: inspect first, make only the described change, keep unrelated behavior and secrets untouched, and report what changed. Keep every field short and plain. All plans are NOT VERIFIED.',
      },
      {
        role: 'user',
        content: JSON.stringify({ project: { name: project.name, what: project.what, uses: project.uses, files }, idea, sourceSummary, ...(videoId ? { videoId } : {}) }),
      },
    ],
  };
}

export function normalizeApplyPlan(raw) {
  const plan = raw?.plan;
  const invalid = (message) => { throw Object.assign(Error(message), { applyFailure: true, code: 'INVALID_APPLY_PLAN', stage: 'validation' }); };
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) invalid('DeepSeek did not return one plan.');
  const clean = (value, max, label) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) invalid(label + ' is missing or too long.');
    return value.trim();
  };
  const effort = String(plan.effort || '').trim().toLowerCase();
  if (!['small', 'medium', 'big'].includes(effort)) invalid('Effort must be small, medium or big.');
  return {
    changes: clean(plan.changes, 1800, 'What changes'),
    touches: clean(plan.touches, 1200, 'Which part it touches'),
    effort,
    alreadyHave: plan.alreadyHave === true,
    alreadyHaveReason: typeof plan.alreadyHaveReason === 'string' ? plan.alreadyHaveReason.trim().slice(0, 600) : '',
    buildPrompt: clean(plan.buildPrompt, 6000, 'Build prompt'),
    verification: 'NOT VERIFIED',
  };
}
