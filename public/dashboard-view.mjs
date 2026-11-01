// Dashboard view-model and DOM builders for the command-centre home screen.
// Pure helpers stay free of the DOM so they can be unit tested with node --test.
import { collectNewIdeas, dashboardVideos, hasDeepSeekResult, shortSummary, spendingCards } from './result-view.mjs';
import { matchedProjects, newestFirst } from './result-routing.mjs';
import { thumbnailNode } from './thumbnail-view.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function formatCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('en-US').format(number) : '0';
}

export function relativeTime(at, now = Date.now()) {
  const value = Number(at);
  if (!Number.isFinite(value) || value <= 0) return 'Just now';
  const minutes = Math.floor(Math.max(0, now - value) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function librarySnapshot(state = {}) {
  const videos = dashboardVideos(state.videos || []);
  return {
    posts: videos.length,
    insights: videos.filter(hasDeepSeekResult).length,
    projects: (state.projects || []).filter((project) => project.enabled !== false).length,
  };
}

export function pipelineStages(state = {}) {
  const videos = dashboardVideos(state.videos || []);
  const summaries = videos.filter(hasDeepSeekResult);
  const waiting = videos.filter((video) => !hasDeepSeekResult(video) && video.status !== 'failed');
  const extracted = waiting.filter(
    (video) => video.status === 'needs_analysis' || video.result?.transcript || video.result?.extraction?.audioExtracted,
  );
  const matched = videos.filter((video) => matchedProjects(video, state.projects || []).length);
  const ideas = summaries.reduce((total, video) => total + (video.result?.recommendations?.length || 0), 0);
  const running = Boolean(state.queue?.running || state.queue?.active > 0 || state.batch?.active);
  return [
    { key: 'ingest', label: 'Ingesting Content', icon: 'i-download', count: videos.length, unit: 'posts' },
    { key: 'extract', label: 'Extracting Audio/Video', icon: 'i-wave', count: extracted.length, unit: 'ready' },
    { key: 'analyze', label: 'Analyzing Information', icon: 'i-cpu', count: summaries.length, unit: 'summaries', active: running },
    { key: 'match', label: 'Finding Opportunities', icon: 'i-target', count: matched.length, unit: 'matches' },
    { key: 'ideas', label: 'Generating Recommendations', icon: 'i-bulb', count: ideas, unit: 'ideas' },
  ].map((stage) => ({ ...stage, done: stage.count > 0 }));
}

export function recentResults(state = {}, limit = 6) {
  return dashboardVideos(state.videos || [])
    .filter((video) => video.result?.summary?.trim())
    .sort(newestFirst)
    .slice(0, limit);
}

export function activityModel(state = {}) {
  const queue = state.queue || {};
  const batch = state.batch || {};
  const posts = Array.isArray(batch.posts) ? batch.posts : [];
  const total = Number(batch.total ?? queue.batchSize ?? 0);
  const done = Number(batch.done ?? queue.done ?? 0);
  const running = Boolean(queue.running || queue.active > 0 || batch.active);
  const currentVideo = (state.videos || []).find((video) => video.status === 'running');
  const currentPost = posts.find((post) => post.label === 'Working on it');
  const title = currentVideo?.result?.title || currentVideo?.title || currentPost?.title || '';
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const minutesLeft = queue.estimatedSecondsLeft ? Math.max(1, Math.ceil(queue.estimatedSecondsLeft / 60)) : null;
  return {
    running,
    title,
    done,
    total,
    percent,
    minutesLeft,
    costUSD: Number(batch.costUSD || 0),
    posts: posts.slice(0, 5),
    hasBatch: posts.length > 0,
  };
}

export function projectSummaries(state = {}) {
  const videos = dashboardVideos(state.videos || []);
  const projects = state.projects || [];
  return projects.map((project, index) => ({
    id: project.id,
    name: project.name,
    enabled: project.enabled !== false,
    matches: videos.filter((video) => matchedProjects(video, projects).some((match) => match.id === project.id)).length,
    tone: index % 6,
  }));
}

export function ideaCount(state = {}) {
  const videos = dashboardVideos(state.videos || []).filter((video) => !['skipped', 'failed'].includes(video.status));
  const seen = new Set();
  let count = 0;
  for (const { video, recommendation } of collectNewIdeas(videos, state.projects || [])) {
    const key = [video.id, recommendation.project || '', recommendation.application || ''].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    count += 1;
  }
  return count;
}

export function knowledgeStats(state = {}) {
  let connections = 0;
  for (const set of state.combinedPlans || []) {
    for (const plan of set.plans || []) connections += Math.max(0, (plan.videoIds || []).length - 1);
  }
  return {
    projects: (state.projects || []).length,
    videos: dashboardVideos(state.videos || []).length,
    connections,
  };
}

export function settingsModel(state = {}) {
  const money = spendingCards(state.spending, state.balance);
  return {
    provider: String(state.researchProvider || 'deepseek'),
    balance: money.balance,
    spent: money.spent,
    instagram: state.instagramBrowser?.available
      ? state.instagramBrowser.windowOpen
        ? 'Sign-in window open'
        : 'Available'
      : 'Unavailable',
    coachlab: state.coachlab?.configured ? 'Configured' : 'Not configured',
    brave: state.braveConfigured ? 'Configured' : 'Not configured',
    sync: state.savedSync?.enabled ? 'On' : 'Off',
    handoff: state.referenceHandoff?.enabled ? 'On' : 'Off',
    queue: state.queue?.running || state.queue?.active > 0 ? 'Running' : 'Idle',
  };
}

function icon(document, name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', '#' + name);
  svg.append(use);
  return svg;
}

export function mountDashboard({ document, onOpen = () => {}, onNavigate = (hash) => { location.hash = hash; } }) {
  const $ = (id) => document.getElementById(id);
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  let signature = '';

  function latestUpdated(state) {
    let latest = 0;
    for (const video of state.videos || []) latest = Math.max(latest, Number(video.updated_at) || 0);
    return latest;
  }

  function signatureOf(state) {
    return JSON.stringify([
      (state.videos || []).length,
      dashboardVideos(state.videos || []).filter(hasDeepSeekResult).length,
      latestUpdated(state),
      state.projects?.map((project) => [project.id, project.name, project.enabled]),
      state.queue?.running,
      state.queue?.active,
      state.batch?.done,
      state.batch?.total,
      state.batch?.costUSD,
      state.spending?.calls,
      state.balance?.amount,
      state.instagramBrowser?.windowOpen,
      state.savedSync?.enabled,
      state.referenceHandoff?.enabled,
      state.combinedPlans?.length,
    ]);
  }

  function renderHeroStats(state) {
    const host = $('hero-stats');
    if (!host) return;
    const snapshot = librarySnapshot(state);
    host.replaceChildren(
      ...[
        [snapshot.posts, 'posts'],
        [snapshot.insights, 'insights'],
        [snapshot.projects, 'projects'],
      ].map(([value, label]) => {
        const tile = make('div', undefined, 'hero-stat');
        tile.append(make('strong', formatCount(value)), make('span', label));
        return tile;
      }),
    );
  }

  function renderPipeline(state) {
    const host = $('pipeline-stages');
    if (!host) return;
    host.replaceChildren(
      ...pipelineStages(state).map((stage) => {
        const item = make('li', undefined, 'pipeline-stage' + (stage.done ? ' is-done' : '') + (stage.active ? ' is-active' : ''));
        item.append(icon(document, stage.icon, 'icon stage-icon'));
        const text = make('span', undefined, 'stage-text');
        text.append(make('strong', stage.label), make('small', formatCount(stage.count) + ' ' + stage.unit));
        item.append(text);
        return item;
      }),
    );
    const badge = $('pipeline-state');
    if (badge) badge.textContent = state.queue?.running || state.queue?.active > 0 ? 'Running' : 'Idle';
  }

  function renderActivity(state) {
    const host = $('activity-body');
    if (!host) return;
    const model = activityModel(state);
    const live = $('activity-live');
    if (live) {
      live.classList.toggle('is-live', model.running);
      const text = live.querySelector('span') || live;
      text.textContent = model.running ? 'Live' : 'Idle';
    }
    const dot = $('activity-dot');
    if (dot) dot.hidden = !model.running;

    const nodes = [];
    if (model.running) {
      const current = make('div', undefined, 'activity-current');
      const row = make('div', undefined, 'activity-head');
      row.append(make('span', undefined, 'activity-spinner'));
      const info = make('div');
      info.append(make('strong', model.title || 'Preparing the next post'), make('p', 'Running the local research queue', 'small'));
      row.append(info);
      current.append(row);
      const progress = make('div', undefined, 'progress');
      const fill = make('span', undefined, 'progress-fill');
      fill.dataset.tone = 'violet';
      fill.style.width = model.percent + '%';
      progress.append(fill);
      current.append(progress);
      const meta = make('p', undefined, 'activity-meta');
      meta.textContent =
        model.done + ' of ' + model.total + ' finished · ' + model.percent + '%' + (model.minutesLeft ? ' · about ' + model.minutesLeft + ' min left' : '');
      current.append(meta);
      nodes.push(current);
      if (model.costUSD > 0) nodes.push(make('p', 'Estimated spend this batch: $' + model.costUSD.toFixed(4), 'small'));
    } else {
      const idle = make('div', undefined, 'activity-idle');
      idle.append(make('span', undefined, 'idle-ring'));
      idle.append(make('strong', 'No analysis running'));
      idle.append(make('p', 'Start a batch from the Library when you are ready. Nothing runs in the background.', 'small'));
      const button = make('button', 'Open Library', 'btn-ghost');
      button.type = 'button';
      button.dataset.go = 'my-library';
      idle.append(button);
      nodes.push(idle);
    }

    if (model.posts.length) {
      const list = make('ol', undefined, 'activity-list');
      for (const post of model.posts) {
        const item = make('li', undefined, 'activity-item ' + (post.label === 'Done' ? 'is-done' : post.label === 'Working on it' ? 'is-working' : post.label === 'Failed' ? 'is-failed' : 'is-waiting'));
        item.append(icon(document, post.label === 'Done' ? 'i-check' : post.label === 'Failed' ? 'i-alert' : 'i-clock', 'icon'));
        const body = make('span');
        body.append(make('strong', post.title || post.id), make('small', post.label));
        item.append(body);
        list.append(item);
      }
      nodes.push(make('p', model.running ? 'Queue order' : 'Last batch', 'activity-label'), list);
    }

    host.replaceChildren(...nodes);
  }

  function renderProjects(state) {
    const host = $('home-projects');
    if (!host) return;
    const cards = projectSummaries(state).map((project) => {
      const link = make('a', undefined, 'project-chip');
      link.href = '#project-' + project.id;
      link.dataset.tone = String(project.tone);
      if (!project.enabled) link.classList.add('is-off');
      const orb = make('span', (project.name || '?').slice(0, 1).toUpperCase(), 'project-orb');
      const meta = make('span', undefined, 'project-meta');
      meta.append(make('strong', project.name), make('small', formatCount(project.matches) + ' insights'));
      link.append(orb, meta);
      return link;
    });
    const add = make('button', undefined, 'project-chip project-add');
    add.type = 'button';
    add.dataset.go = 'project-ideas';
    add.setAttribute('aria-label', 'Add a project');
    const addMeta = make('span', undefined, 'project-meta');
    addMeta.append(make('strong', 'Add project'), make('small', 'New project'));
    add.append(icon(document, 'i-plus', 'icon'), addMeta);
    host.replaceChildren(...cards, add);
  }

  function renderRecent(state) {
    const host = $('home-recent');
    if (!host) return;
    const videos = recentResults(state, 3);
    if (!videos.length) {
      const empty = make('p', 'No saved research yet. Process a post and its summary will appear here.', 'empty-note');
      host.replaceChildren(empty);
      return;
    }
    host.replaceChildren(
      ...videos.map((video) => {
        const card = make('button', undefined, 'recent-card');
        card.type = 'button';
        card.onclick = () => onOpen(video);
        const thumb = make('span', undefined, 'recent-thumb');
        thumb.append(thumbnailNode(document, video.thumbnailUrl));
        thumb.append(icon(document, 'i-play', 'icon recent-play'));
        const info = make('span', undefined, 'recent-info');
        const title = video.result?.title || video.title || 'Saved research';
        info.append(make('strong', title.length > 90 ? title.slice(0, 87) + '…' : title));
        const tags = make('span', undefined, 'recent-tags');
        const projects = matchedProjects(video, state.projects || []);
        const tag = projects[0]?.name || video.collections?.[0] || 'Research';
        tags.append(make('em', tag));
        info.append(tags, make('small', relativeTime(video.updated_at)));
        card.append(thumb, info);
        return card;
      }),
    );
  }

  function renderIdeas(state) {
    const count = $('idea-count');
    if (count) count.textContent = formatCount(ideaCount(state));
  }

  function renderSidebar(state) {
    const host = $('sidebar-status');
    if (!host) return;
    const money = spendingCards(state.spending, state.balance);
    const running = Boolean(state.queue?.running || state.queue?.active > 0);
    const rows = [
      ['Provider', String(state.researchProvider || 'deepseek')],
      ['Balance', money.balance],
      ['Spent', money.spent],
      ['Queue', running ? 'Running' : 'Idle'],
    ];
    host.replaceChildren(
      ...rows.map(([label, value]) => {
        const row = make('div', undefined, 'status-row');
        row.append(make('span', label), make('strong', value));
        return row;
      }),
    );
  }

  function renderKnowledge(state) {
    const host = $('knowledge-stats');
    if (!host) return;
    const stats = knowledgeStats(state);
    host.replaceChildren(
      ...[
        [stats.projects, 'projects'],
        [stats.videos, 'videos'],
        [stats.connections, 'connections'],
      ].map(([value, label]) => {
        const chip = make('span', undefined, 'stat-chip');
        chip.append(make('strong', formatCount(value)), make('span', label));
        return chip;
      }),
    );
  }

  function renderSettings(state) {
    const model = settingsModel(state);
    const values = {
      'settings-provider': model.provider,
      'settings-balance': model.balance,
      'settings-spent': model.spent,
      'settings-instagram': model.instagram,
      'settings-coachlab': model.coachlab,
      'settings-brave': model.brave,
      'settings-sync': model.sync,
      'settings-handoff': model.handoff,
      'settings-queue': model.queue,
    };
    for (const [id, value] of Object.entries(values)) {
      const node = $(id);
      if (node) node.textContent = value;
    }
  }

  function render(state) {
    if (!state) return;
    const next = signatureOf(state);
    if (next === signature) return;
    signature = next;
    renderHeroStats(state);
    renderPipeline(state);
    renderActivity(state);
    renderProjects(state);
    renderRecent(state);
    renderIdeas(state);
    renderSidebar(state);
    renderKnowledge(state);
    renderSettings(state);
  }

  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('[data-go]');
    if (!target) return;
    event.preventDefault();
    onNavigate(target.dataset.go);
  });

  return render;
}
