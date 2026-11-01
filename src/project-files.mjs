// Read-only top-level file names for the project folders this dashboard knows.
// Only names and cautious purposes are sent to the model; file contents, .env
// files, keys, tokens and databases are never read or included.
import { readdir } from 'node:fs/promises';
import path from 'node:path';

export const PROJECT_ROOTS = Object.freeze({
  Personafy: 'C:/Users/barri/Documents/ChatGPT/Persona Phi',
  'Dev Squad AI': 'C:/Users/barri/OneDrive/Desktop/Next Chapter Projects/DevSquadAI',
  'Sims 4 Upgrades': 'C:/Users/barri/Documents/ChatGPT/Sims4',
});

const SECRET_NAME = /(?:^|[._-])(?:env|secret|secrets|key|keys|token|tokens|credential|credentials|password|passwd|auth)(?:[._-]|$)|\.(?:pem|key|p12|pfx|sqlite|sqlite3|db|log)$/i;
const SKIP_NAMES = new Set(['.git', '.next', '.venv', '__pycache__', 'node_modules', 'dist', 'build', 'coverage', 'backups', 'backup']);
const PURPOSE = {
  src: 'application source code',
  source: 'application source code',
  app: 'main application code',
  server: 'backend server code',
  public: 'browser UI and static assets',
  test: 'automated tests',
  tests: 'automated tests',
  docs: 'documentation',
  scripts: 'developer and maintenance scripts',
  data: 'local project data',
  assets: 'images and other static assets',
  lib: 'shared library code',
  packages: 'workspace packages',
  config: 'configuration helpers',
  prisma: 'database schema and migrations',
  'app.py': 'Python application entry point',
  'package.json': 'Node project metadata and scripts',
  'package-lock.json': 'locked Node dependencies',
  'requirements.txt': 'Python dependencies',
  'pyproject.toml': 'Python project metadata',
  'README.md': 'project documentation',
  'vite.config.js': 'frontend build configuration',
  'vite.config.ts': 'frontend build configuration',
  'tsconfig.json': 'TypeScript compiler configuration',
  Dockerfile: 'container build recipe',
};

function purposeFor(name) {
  if (PURPOSE[name]) return PURPOSE[name];
  if (/\.(?:js|mjs|cjs|ts|tsx|jsx|py|go|rs|java|cs|rb|php)$/i.test(name)) return 'source code';
  if (/\.(?:json|toml|ya?ml|ini)$/i.test(name)) return 'project configuration';
  if (/\.(?:md|txt)$/i.test(name)) return 'documentation';
  if (/\.(?:css|scss|sass|html)$/i.test(name)) return 'browser styling or markup';
  return 'project file';
}

export async function projectFileSummary(name, { roots = PROJECT_ROOTS, maxFiles = 30 } = {}) {
  const root = roots[name];
  if (!root) return { root: null, files: [], note: 'No local folder is configured for this project, so the plan uses only the saved project profile.' };
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return { root: null, files: [], note: 'The local project folder could not be read, so the plan uses only the saved project profile.' };
  }
  const files = entries
    .filter((entry) => !SKIP_NAMES.has(entry.name) && !entry.name.startsWith('.') && !SECRET_NAME.test(entry.name) && !entry.isSymbolicLink())
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .slice(0, maxFiles)
    .map((entry) => ({ name: entry.isDirectory() ? entry.name + '/' : entry.name, purpose: entry.isDirectory() ? (PURPOSE[entry.name] || 'project folder') : purposeFor(entry.name) }));
  return { root: path.basename(root), files, note: files.length ? 'Read-only top-level names only; file contents were not read.' : 'The project folder had no safe top-level files to list.' };
}
