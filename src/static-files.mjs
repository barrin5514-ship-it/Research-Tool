// Safe static-file resolver for the local dashboard.
// New styles, modules, icons and fonts under public/ no longer need a hand-edited
// allowlist entry in server.mjs. Dotfiles, traversal and unknown types are refused.
import { extname, resolve, sep } from 'node:path';
import { lstat } from 'node:fs/promises';

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.ttf', 'font/ttf'],
]);

export function createStaticResolver({ root }) {
  const base = resolve(root);
  return async function resolveStatic(urlPath) {
    if (typeof urlPath !== 'string' || !urlPath.startsWith('/')) return null;
    let pathname;
    try {
      pathname = decodeURIComponent(urlPath);
    } catch {
      return null;
    }
    // Windows separators, null bytes and traversal attempts never reach the filesystem.
    if (pathname.includes('\\') || pathname.includes('\0')) return null;
    if (pathname === '/') pathname = '/index.html';
    const segments = pathname.replace(/^\/+/, '').split('/');
    if (!segments.length || segments.some((segment) => !segment || segment.startsWith('.'))) return null;
    const type = TYPES.get(extname(pathname).toLowerCase());
    if (!type) return null;
    const file = resolve(base, ...segments);
    if (!file.startsWith(base + sep)) return null;
    try {
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink()) return null;
    } catch {
      return null;
    }
    return { path: file, type };
  };
}

export function staticContentType(path) {
  return TYPES.get(extname(String(path)).toLowerCase()) || 'application/octet-stream';
}
