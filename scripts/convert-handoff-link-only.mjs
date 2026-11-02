// One-time converter: move old hand-off media into a backup folder and rewrite
// every hand-off index as link-only. Nothing is deleted from the hand-off folder.
import { readFile, readdir, rename, mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LibraryStore } from '../src/store.mjs';
import { HANDOFF_ROOT } from '../src/reference-media.mjs';

const root = HANDOFF_ROOT;
const store = new LibraryStore('.research-data/library.sqlite');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = join(root, `_media-backup-${stamp}`);
const rows = store.db.prepare('SELECT code,record_json FROM reference_handoffs').all();
let movedFiles = 0, converted = 0;
try {
  for (const row of rows) {
    let record = JSON.parse(row.record_json);
    const previous = Array.isArray(record.files) ? record.files : [];
    const folder = join(root, row.code);
    let moved = false;
    for (const file of previous) {
      if (!file?.name) continue;
      const source = join(folder, file.name);
      try {
        await stat(source);
      } catch { continue; }
      const destination = join(backup, row.code, file.name);
      await mkdir(join(backup, row.code), { recursive: true });
      await rename(source, destination);
      movedFiles += 1;
      moved = true;
    }
    const hasVideo = previous.some((file) => file.kind === 'video');
    const postType = record.postType || (hasVideo ? 'video' : previous.length > 1 ? 'carousel' : previous.length ? 'photo' : null);
    const next = {
      ...record,
      files: [],
      method: 'link_only',
      postType,
      complete: record.status === 'Done',
      reason: record.status === 'Done' ? null : record.reason || null,
    };
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'index.json'), JSON.stringify({
      schemaVersion: 2,
      postCode: next.code,
      sourceUrl: next.url,
      status: next.status,
      caption: next.caption || '',
      postedAt: next.postedAt || null,
      postType: next.postType,
    }, null, 2));
    store.db.prepare('UPDATE reference_handoffs SET record_json=? WHERE code=?').run(JSON.stringify(next), row.code);
    converted += 1;
    if (!moved && previous.length === 0) continue;
  }
  // Rewrite the global list from the updated records.
  const updated = rows.map((row) => JSON.parse(store.db.prepare('SELECT record_json FROM reference_handoffs WHERE code=?').get(row.code).record_json));
  await writeFile(join(root, 'index.json'), JSON.stringify({
    schemaVersion: 2,
    kind: 'personafy-reference-handoff',
    updatedAt: new Date().toISOString(),
    posts: updated.map((record) => ({
      postCode: record.code,
      sourceUrl: record.url,
      status: record.status,
      reason: record.reason || null,
      caption: record.caption || '',
      postedAt: record.postedAt || null,
      postType: record.postType || null,
      index: record.code + '/index.json',
      savedAt: record.savedAt || null,
    })),
  }, null, 2));
  console.log(JSON.stringify({ converted, movedFiles, backup, total: rows.length }, null, 2));
} finally {
  store.close();
}
