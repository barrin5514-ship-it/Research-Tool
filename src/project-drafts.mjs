// First-draft project profiles written from a read-only inspection of each
// project's files. They only pre-fill the edit boxes; nothing is saved until
// the owner reviews and saves them. Files of other projects are never changed.
export const DRAFT_PROFILES = {
  Pennywise: {
    what: 'My stock trading bot: a Python/Streamlit paper-trading research system that tests strategies without real trades.',
    uses: 'Python, Streamlit, an EventBus, strategy/risk/execution modules, SQLite evidence storage, research fusion, a bounded scheduler, holdout and scientific-governance checks, and a deterministic copilot.'
  },
  Personafy: {
    what: 'My AI influencer studio that generates, reviews and publishes AI influencer content.',
    uses: 'Node 24 and TypeScript, a browser-native UI, SQLite storage, private media, the Cobalt loopback downloader, FFmpeg frame extraction, a local LM Studio vision writer, xAI adapters, generation/review/publishing gates, backup/migration scripts, and sharp for image processing.'
  },
  Tech: {
    what: 'General tech ideas that do not fit another project yet.',
    uses: 'Nothing yet: this is a catch-all project for ideas without a home.'
  },
  'Dev Squad AI': {
    what: 'My AI coding agent dashboard where Codex builds and Claude reviews.',
    uses: 'Node 24 with an Express 5 server, a Codex-builds/Claude-reviews flow, provider verification scripts for DeepSeek and free developers, and backup scripts.'
  },
  'Sims 4 Upgrades': {
    what: 'Upgrading The Sims 4 with mods, custom content, graphics and automation.',
    uses: 'Python helper scripts (graphics environment selection, Reshade setup review), the SimSpeak app (Python app/backend/engine plus a web UI), mod inventories and manifests for Basemental and WickedWhims, environment graphics upgrades, and an SSD storage plan.'
  },
  'Martial Arts and Fitness': {
    what: 'Coaching library for boxing, Brazilian jiu-jitsu, MMA, techniques, drills and training plans.',
    uses: 'Nothing yet: posts and lessons only, no code.'
  }
};
