// Builds one short "apply this idea" plan with DeepSeek after an explicit cost confirmation.
// The plan is saved per project idea, so reopening the dashboard never pays twice.
import { randomUUID, createHash } from 'node:crypto';
import { DEEPSEEK_ENDPOINT, DEEPSEEK_RATES, estimateDeepSeekCost } from './deepseek.mjs';
import { shortSummary } from '../public/result-view.mjs';
import { projectFileSummary } from './project-files.mjs';

export const APPLY_MAX_USD = 0.01;
const MAX_OUTPUT_TOKENS = 900;
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const applyError = (code, stage, message) => Object.assign(Error(message), { applyFailure: true, code, stage });

export function applyPayload({ project, idea, sourceSummary, files }) {
  return {
    model: 'deepseek-flash',
    thinking: { type: 'disabled' },
    max_tokens: MAX_OUTPUT_TOKENS,
    stream: false,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Plan one small change to the supplied project. Use only the supplied idea, project profile and read-only file names. Never invent a feature, file, API, dependency or fact that the idea does not mention. If the project profile or file list shows the idea is already present, set alreadyHave true and explain briefly; do not pretend it is missing. Return JSON {plan:{changes,touches,effort,alreadyHave,alreadyHaveReason,buildPrompt}}. changes = what this idea would add or change, in plain English. touches = which part of the project it touches. effort = exactly small, medium or big. alreadyHave = true only when the supplied profile/files show it already exists. buildPrompt = a self-contained copy-paste prompt for the builder: inspect first, make only the described change, keep unrelated behavior and secrets untouched, and report what changed. Keep every field short and plain. All plans are NOT VERIFIED.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          project: { name: project.name, what: project.what, uses: project.uses, files },
          idea,
          sourceSummary,
        }),
      },
    ],
  };
}

export function normalizeApplyPlan(raw) {
  const plan = raw?.plan;
  const invalid = (message) => { throw applyError('INVALID_APPLY_PLAN', 'validation', message); };
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

export class ProjectApplyPlans {
  constructor({ store, apiKey, isBusy = () => false, onUsage = async () => {}, fetcher = fetch, files = projectFileSummary } = {}) {
    Object.assign(this, { store, apiKey, isBusy, onUsage, fetcher, files });
    this.state = { running: false, error: null, project: null, videoId: null, costUSD: null };
  }

  async snapshot(projectId, videoId) {
    const project = this.store.projects().find((item) => item.id === projectId);
    if (!project) throw Error('Project not found.');
    const video = this.store.get(videoId);
    if (!video?.result?.summary?.trim()) throw Error('Choose a saved analyzed post first.');
    const recommendation = (video.result.recommendations || []).find((item) => item.projectId === project.id || item.project === project.name);
    if (!recommendation?.application?.trim()) throw Error('This post has no saved idea for that project.');
    const profile = project.profile || {};
    const what = String(profile.what || project.description || '').trim();
    const uses = String(profile.uses || '').trim();
    const fileSummary = await this.files(project.name);
    return {
      project: { id: project.id, name: project.name, what, uses },
      videoId: video.id,
      idea: recommendation.application.trim(),
      sourceSummary: shortSummary(video),
      files: fileSummary.files,
      fileNote: fileSummary.note,
      fingerprint: digest({ projectId: project.id, videoId: video.id, idea: recommendation.application, what, uses, files: fileSummary.files }),
    };
  }

  async prepare({ projectId, videoId } = {}) {
    if (this.state.running || this.isBusy()) throw Error('Wait for current work to finish.');
    const saved = this.store.getApplyPlan(projectId, videoId);
    if (saved) return { saved: true, project: saved.plan.project || projectId, videoId, plan: saved.plan, estimatedUSD: 0, note: 'Saved plan loaded. No paid call was made.' };
    const snapshot = await this.snapshot(projectId, videoId);
    const payload = applyPayload({ project: snapshot.project, idea: snapshot.idea, sourceSummary: snapshot.sourceSummary, files: snapshot.files });
    const bytes = Buffer.byteLength(JSON.stringify(payload));
    if (bytes > 250000) throw Error('This idea and project description are too large for one safe request.');
    const estimatedUSD = (bytes + 2048) * DEEPSEEK_RATES.input / 1e6 + payload.max_tokens * DEEPSEEK_RATES.output / 1e6;
    if (estimatedUSD > APPLY_MAX_USD) throw Error('The estimated cost for this idea is over the $0.01 limit.');
    this.preview = { ...snapshot, token: randomUUID(), at: Date.now(), estimatedUSD, payload };
    return {
      token: this.preview.token,
      project: snapshot.project.name,
      videoId,
      idea: snapshot.idea,
      estimatedUSD,
      note: 'One DeepSeek call using only this idea, the two project boxes and read-only file names. No download, transcription or project change. Maximum $0.01.',
    };
  }

  confirm({ token, confirmed } = {}) {
    if (confirmed !== true || !this.preview || token !== this.preview.token || Date.now() - this.preview.at > 600000) throw Error('Review the estimated cost, then confirm.');
    if (this.state.running || this.isBusy()) throw Error('Wait for current work to finish.');
    if (!this.apiKey?.trim() || /[\r\n]/.test(this.apiKey)) throw Error('Configure the server-side DeepSeek key.');
    const plan = this.preview;
    this.preview = null;
    this.state = { running: true, error: null, project: plan.project.name, videoId: plan.videoId, costUSD: null };
    this.finished = this.run(plan)
      .catch((error) => {
        this.state.errorCode = error.applyFailure ? error.code : 'UNEXPECTED_FAILURE';
        this.state.errorStage = error.applyFailure ? error.stage : 'unknown';
        this.state.error = 'Apply plan failed: ' + (error.applyFailure ? error.message : 'an unexpected local error occurred.') + ' No paid retry was made.';
      })
      .finally(() => { this.state.running = false; });
    return this.status();
  }

  async run(plan) {
    let recorded = false;
    const record = async (usage, responseContent) => {
      recorded = true;
      this.state.costUSD = usage?.estimatedUSD ?? null;
      await this.onUsage({ kind: 'project-apply', projectId: plan.project.id, videoId: plan.videoId, at: new Date().toISOString(), model: 'deepseek-flash', usage, ...(responseContent !== undefined ? { responseContent } : {}) });
    };
    try {
      let response;
      try {
        response = await this.fetcher(DEEPSEEK_ENDPOINT, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90000), headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(plan.payload) });
      } catch {
        throw applyError('REQUEST_FAILED', 'request', 'DeepSeek could not be reached; billing could not be confirmed.');
      }
      if (!response.ok || response.redirected) {
        await response.body?.cancel().catch(() => {});
        throw applyError('HTTP_' + response.status, 'request', 'DeepSeek rejected the request (HTTP ' + response.status + ').');
      }
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > 200000) throw applyError('RESPONSE_TOO_LARGE', 'response', 'DeepSeek returned a response larger than the safe limit.');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw applyError('INVALID_ENVELOPE', 'response', 'DeepSeek returned unreadable response data.'); }
      const usage = estimateDeepSeekCost(body.usage);
      await record(usage, body.choices?.[0]?.message?.content ?? null);
      let raw;
      try { raw = JSON.parse(body.choices?.[0]?.message?.content); } catch { throw applyError('INVALID_PLAN_JSON', 'validation', 'DeepSeek did not return readable plan JSON.'); }
      const normalized = normalizeApplyPlan(raw);
      const planRecord = { ...normalized, project: plan.project.name, idea: plan.idea, createdAt: new Date().toISOString() };
      try { this.store.saveApplyPlan({ projectId: plan.project.id, videoId: plan.videoId, plan: planRecord, usage }); } catch { throw applyError('SAVE_FAILED', 'save', 'The plan was received but could not be saved locally.'); }
      this.state.plan = planRecord;
    } catch (error) {
      if (!recorded) await record(null);
      throw error;
    }
  }

  status() { return { ...this.state }; }
  async close() { await this.finished; }
}
