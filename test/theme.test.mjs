import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('the page loads the legacy sheet first and the theme second', async () => {
  const html = await read('public/index.html');
  assert.ok(html.indexOf('/style.css') < html.indexOf('/theme.css'), 'theme.css must load after style.css');
  assert.match(html, /<html lang="en" data-theme="dark">/);
  assert.match(html, /id="hero-core"/);
  assert.match(html, /class="side-nav"/);
});

test('theme.css parses cleanly and keeps the core layout contracts', async () => {
  const css = await read('public/theme.css');
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  assert.equal(open, close, 'braces are balanced');
  assert.ok(!/\bundefined\b|\bNaN\b/.test(css), 'no failed template values leaked into CSS');
  for (const pattern of [
    /\.icon\s*\{[^}]*width:\s*20px/s,
    /\.app\s*\{[^}]*grid-template-columns:\s*252px/s,
    /#hero-core\s*\{[^}]*max-width:\s*360px/s,
    /\.source-chips\s*\{[^}]*flex-wrap:\s*wrap/s,
    /#pipeline-stages:empty::after/,
    /@media \(max-width: 940px\)/,
    /@media \(prefers-reduced-motion: reduce\)/,
    /\.app > \.sidebar \{ z-index: 60; \}/,
    /\.app > \.sidebar \.side-nav\s*\{[^}]*display:\s*flex/s,
  ]) {
    assert.match(css, pattern, String(pattern));
  }
});

test('icon sizing and the brain viewBox are protected by tests', async () => {
  const css = await read('public/theme.css');
  assert.match(css, /\.icon \{ width: 20px; height: 20px;/);
  assert.match(css, /\.side-nav a \.icon \{ width: 18px; height: 18px;/);
  const core = await read('public/hero-core.mjs');
  assert.match(core, /viewBox="0 0 360 440"/);
  assert.match(core, /class="core-svg"/);
  assert.match(core, /core-brain/);
});
