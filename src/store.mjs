import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const REVIEW_STATES = ['New', 'Under Review', 'Approved', 'Rejected', 'Implemented'];
export class LibraryStore {
  constructor(file) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY, url TEXT NOT NULL, title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
        available_at INTEGER NOT NULL DEFAULT 0, error TEXT, result_json TEXT,
        review_status TEXT NOT NULL DEFAULT 'New', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS memberships (
        video_id TEXT NOT NULL REFERENCES videos(id), name TEXT NOT NULL,
        PRIMARY KEY(video_id,name));
      CREATE TABLE IF NOT EXISTS imports (
        hash TEXT PRIMARY KEY, filename TEXT NOT NULL, imported_at INTEGER NOT NULL,
        added INTEGER NOT NULL, existing INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS export_presence (video_id TEXT PRIMARY KEY REFERENCES videos(id), september INTEGER NOT NULL, october INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY, video_id TEXT, action TEXT NOT NULL, detail TEXT NOT NULL, at INTEGER NOT NULL);
    `);
  }
  setExportPresence(september,october){return this.transaction(()=>{for(const v of this.list())this.db.prepare('INSERT OR REPLACE INTO export_presence VALUES(?,?,?)').run(v.id,Number(september.has(v.id)),Number(october.has(v.id)));});}
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  import(items, { hash, filename = 'export', now = Date.now() } = {}) {
    return this.transaction(() => {
      const previous = hash && this.db.prepare('SELECT * FROM imports WHERE hash=?').get(hash);
      if (previous) return { added: 0, existing: items.length, repeatedExport: true };
      let added = 0, existing = 0;
      for (const item of items) {
        const got = this.db.prepare('INSERT OR IGNORE INTO videos(id,url,title,created_at,updated_at) VALUES(?,?,?,?,?)')
          .run(item.shortcode, item.url, item.title || 'Instagram video', now, now);
        if (got.changes) added++; else existing++;
        for (const name of item.collections || []) {
          this.db.prepare('INSERT OR IGNORE INTO memberships(video_id,name) VALUES(?,?)').run(item.shortcode, name);
        }
      }
      if (hash) this.db.prepare('INSERT INTO imports VALUES(?,?,?,?,?)').run(hash, filename, now, added, existing);
      return { added, existing, repeatedExport: false };
    });
  }
  list() {
    const memberships = this.db.prepare('SELECT video_id,name FROM memberships ORDER BY name').all();
    const grouped = new Map();
    for (const item of memberships) { if (!grouped.has(item.video_id)) grouped.set(item.video_id,[]); grouped.get(item.video_id).push(item.name); }
    return this.db.prepare('SELECT * FROM videos ORDER BY created_at DESC,id').all().map(row => ({
      ...row, septemberOnly: Boolean(this.db.prepare('SELECT 1 FROM export_presence WHERE video_id=? AND september=1 AND october=0').get(row.id)), result: row.result_json ? JSON.parse(row.result_json) : null, result_json: undefined,
      collections: grouped.get(row.id) || []
    }));
  }
  get(id) {
    const row=this.db.prepare('SELECT * FROM videos WHERE id=?').get(id);
    return row && {...row,result:row.result_json?JSON.parse(row.result_json):null,result_json:undefined,
      collections:this.db.prepare('SELECT name FROM memberships WHERE video_id=? ORDER BY name').all(id).map(x=>x.name)};
  }
  claim(now = Date.now(), allowedIds = undefined) {
    return this.transaction(() => {
      const candidates = this.db.prepare("SELECT * FROM videos WHERE status IN ('pending','retry_wait') AND available_at <= ? ORDER BY created_at,id").all(now);
      const row = candidates.find(x => !allowedIds || allowedIds.has(x.id));
      if (!row) return undefined;
      this.db.prepare("UPDATE videos SET status='running',attempts=attempts+1,updated_at=?,error=NULL WHERE id=?").run(now, row.id);
      return this.get(row.id);
    });
  }
  finish(id, { status, result }, now = Date.now()) {
    if (!['needs_analysis', 'completed', 'skipped'].includes(status)) throw new Error('Invalid processing result');
    if (status === 'completed' && (!result?.summary || !result?.provenance)) throw new Error('Completed research requires summary and provenance');
    this.db.prepare("UPDATE videos SET status=?,result_json=?,updated_at=?,error=NULL,review_status='New' WHERE id=?")
      .run(status, JSON.stringify(result), now, id);
  }
  fail(id, error, now = Date.now()) {
    const row = this.get(id);
    const retry = error.retryable === true && row.attempts < 3;
    const delay = Math.max(1000, Math.min(3600000, error.retryAfterMs || 15000 * 2 ** Math.max(0, row.attempts - 1)));
    // Never persist arbitrary exception bodies: they can contain signed URLs or provider responses.
    const code = /^[a-zA-Z0-9_ -]{1,80}$/.test(error.code || '') ? error.code : 'processing_failed';
    this.db.prepare('UPDATE videos SET status=?,error=?,available_at=?,updated_at=? WHERE id=?')
      .run(retry ? 'retry_wait' : 'failed', code, retry ? now + delay : 0, now, id);
  }
  recover(now = Date.now()) {
    // Interrupted jobs get one fresh attempt. Completed research is untouched.
    return this.db.prepare("UPDATE videos SET status='pending',attempts=MAX(0,attempts-1),available_at=0,error='interrupted',updated_at=? WHERE status='running'").run(now).changes;
  }
  interrupt(id, now = Date.now()) {
    this.db.prepare("UPDATE videos SET status='pending',attempts=MAX(0,attempts-1),available_at=0,error='interrupted',updated_at=? WHERE id=? AND status='running'").run(now,id);
  }
  retry(id) {
    const row = this.get(id);
    if (!row || !['failed', 'needs_analysis', 'skipped'].includes(row.status)) throw new Error('Only failed, skipped, or incomplete items can be retried');
    this.db.prepare("UPDATE videos SET status='pending',attempts=0,available_at=0,error=NULL,updated_at=? WHERE id=?").run(Date.now(), id);
  }
  review(id, status) {
    if (!REVIEW_STATES.includes(status)) throw new Error('Invalid review status');
    const row = this.get(id);
    if (!row?.result?.recommendations?.length) throw new Error('This item has no research recommendation to review');
    this.transaction(() => {
      this.db.prepare('UPDATE videos SET review_status=?,updated_at=? WHERE id=?').run(status, Date.now(), id);
      this.db.prepare('INSERT INTO events(video_id,action,detail,at) VALUES(?,?,?,?)').run(id, 'review', status, Date.now());
    });
  }
  hasReady(ids, now = Date.now()) { return [...ids].some(id => this.db.prepare("SELECT 1 FROM videos WHERE id=? AND status IN ('pending','retry_wait') AND available_at<=?").get(id,now)); }
  hasWaiting(ids) { return [...ids].some(id => this.db.prepare("SELECT 1 FROM videos WHERE id=? AND status='retry_wait'").get(id)); }
  close() { this.db.close(); }
}
