import {collectionExcluded,collectionKey,DEMO_DESCRIPTIONS} from '../public/result-view.mjs';
import {randomUUID} from 'node:crypto';
import {PROJECT_CONTEXT} from './research.mjs';
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
      CREATE TABLE IF NOT EXISTS collection_exclusions(name_key TEXT PRIMARY KEY,name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research_overrides(video_id TEXT PRIMARY KEY REFERENCES videos(id));
      CREATE TABLE IF NOT EXISTS reference_history(video_id TEXT PRIMARY KEY REFERENCES videos(id),previous_result_json TEXT,at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS project_details(project_id TEXT PRIMARY KEY,description TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,name_key TEXT NOT NULL UNIQUE,description TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,aliases_json TEXT NOT NULL DEFAULT '[]');
      CREATE TABLE IF NOT EXISTS project_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS project_combinations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,fingerprint TEXT NOT NULL,sources_json TEXT NOT NULL,plans_json TEXT NOT NULL,usage_json TEXT,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS project_rechecks(video_id TEXT NOT NULL REFERENCES videos(id),project_id TEXT NOT NULL,fingerprint TEXT NOT NULL,result_json TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(video_id,project_id,fingerprint));
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY, video_id TEXT, action TEXT NOT NULL, detail TEXT NOT NULL, at INTEGER NOT NULL);
    `);
    this.transaction(()=>{if(!this.db.prepare("SELECT 1 FROM project_settings WHERE key='seeded'").get()){for(const name of ['Pennywise','Personafy','Tech','Dev Squad AI','Sims 4 Upgrades'])this.saveProject({name,description:PROJECT_CONTEXT[name]});this.db.prepare("INSERT INTO project_settings VALUES('seeded','1')").run();}if(!this.db.prepare("SELECT 1 FROM project_settings WHERE key='exclusions_seeded'").get()){this.db.prepare("INSERT OR IGNORE INTO collection_exclusions VALUES('reference','reference')").run();this.db.prepare("INSERT INTO project_settings VALUES('exclusions_seeded','1')").run();}});
    this.migrateDemoDescriptions();
  }
  combinations(){return this.db.prepare('SELECT * FROM project_combinations ORDER BY created_at DESC,rowid DESC').all().map(r=>({id:r.id,projectId:r.project_id,fingerprint:r.fingerprint,sources:JSON.parse(r.sources_json),plans:JSON.parse(r.plans_json),usage:r.usage_json?JSON.parse(r.usage_json):null,createdAt:r.created_at,verification:'NOT VERIFIED'}));}
  saveCombination({projectId,fingerprint,sources,plans,usage}){this.db.prepare('INSERT INTO project_combinations VALUES(?,?,?,?,?,?,?)').run(randomUUID(),projectId,fingerprint,JSON.stringify(sources),JSON.stringify(plans),usage?JSON.stringify(usage):null,Date.now());}
  migrateDemoDescriptions(){this.transaction(()=>{if(this.db.prepare("SELECT 1 FROM project_settings WHERE key='demo_descriptions'").get())return;for(const project of this.projects())if(Object.hasOwn(DEMO_DESCRIPTIONS,project.name)){this.db.prepare('INSERT OR IGNORE INTO project_details VALUES(?,?)').run(project.id,project.description);this.db.prepare('UPDATE projects SET description=? WHERE id=?').run(DEMO_DESCRIPTIONS[project.name],project.id);}this.db.prepare("INSERT INTO project_settings VALUES('demo_descriptions','1')").run();});}
  excludedCollections(){return this.db.prepare('SELECT name FROM collection_exclusions ORDER BY name').all().map(r=>r.name);}
  setCollectionExcluded(name,excluded){if(typeof name!=='string'||!name.trim()||name.length>300||typeof excluded!=='boolean')throw Error('Choose a collection and whether to exclude it.');if(excluded)this.db.prepare('INSERT OR REPLACE INTO collection_exclusions VALUES(?,?)').run(collectionKey(name),name.trim());else this.db.prepare('DELETE FROM collection_exclusions WHERE name_key=?').run(collectionKey(name));if(!excluded)for(const v of this.list())if(v.status==='skipped'&&v.result?.skipReason==='excluded_collection'&&!this.isExcluded(v))this.db.prepare("UPDATE videos SET status='pending',attempts=0,available_at=0,error=NULL WHERE id=?").run(v.id);return this.excludedCollections();}
  isExcluded(video){return collectionExcluded(video,this.excludedCollections());}
  overrideReference(id){const v=this.get(id);if(!v)throw Error('Post not found.');if(v.status==='running')throw Error('Wait for the current video to finish.');this.transaction(()=>{this.db.prepare('INSERT OR IGNORE INTO research_overrides VALUES(?)').run(id);this.db.prepare("UPDATE videos SET status='pending',attempts=0,available_at=0,error=NULL,updated_at=? WHERE id=?").run(Date.now(),id);});}
  projects(){return this.db.prepare('SELECT * FROM projects ORDER BY rowid').all().map(p=>({...p,enabled:Boolean(p.enabled),aliases:JSON.parse(p.aliases_json),technicalDescription:this.db.prepare('SELECT description FROM project_details WHERE project_id=?').get(p.id)?.description||'',aliases_json:undefined}));}
  activeProjects(){return this.projects().filter(p=>p.enabled);}
  saveProject({id,name,description,enabled=true}){
    if(typeof name!=='string'||!name.trim()||name.trim().length>80||name.trim().toLowerCase()==='new ideas'||typeof description!=='string'||!description.trim()||description.trim().length>3000||typeof enabled!=='boolean')throw Error('Enter a project name (up to 80 characters) and description (up to 3000 characters).');
    name=name.trim();description=description.trim();const old=id?this.projects().find(p=>p.id===id):null;if(id&&!old)throw Error('Project not found.');
    if(this.projects().some(p=>p.id!==id&&p.name.toLowerCase()===name.toLowerCase()))throw Error('That project name already exists.');
    const aliases=old?[...new Set([...old.aliases,old.name])]:[];id=id||randomUUID();
    this.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_key=excluded.name_key,description=excluded.description,enabled=excluded.enabled,aliases_json=excluded.aliases_json').run(id,name,name.toLowerCase(),description,Number(enabled),JSON.stringify(aliases));return this.projects().find(p=>p.id===id);
  }
  deleteProject(id,confirmed){if(confirmed!==true)throw Error('Confirm deletion first.');if(!this.db.prepare('DELETE FROM projects WHERE id=?').run(id).changes)throw Error('Project not found.');}
  hasProjectRecheck(videoId,projectId,fingerprint){return Boolean(this.db.prepare('SELECT 1 FROM project_rechecks WHERE video_id=? AND project_id=? AND fingerprint=?').get(videoId,projectId,fingerprint));}
  saveProjectRecheck(videoId,project,fingerprint,analysis){return this.transaction(()=>{const video=this.get(videoId);if(!video?.result)throw Error('Saved result is unavailable.');const recs=(video.result.recommendations||[]).filter(r=>r.projectId!==project.id&&!( !r.projectId&&[project.name,...project.aliases].includes(r.project)));const replacements=analysis.recommendations.filter(r=>r.project===project.name).map(r=>({...r,projectId:project.id}));video.result.recommendations=[...recs,...replacements];this.db.prepare("UPDATE videos SET result_json=?,review_status='New' WHERE id=?").run(JSON.stringify(video.result),videoId);this.db.prepare('INSERT INTO project_rechecks VALUES(?,?,?,?,?)').run(videoId,project.id,fingerprint,JSON.stringify(analysis),Date.now());});}
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
      ...row, researchOverride:Boolean(this.db.prepare('SELECT 1 FROM research_overrides WHERE video_id=?').get(row.id)), septemberOnly: Boolean(this.db.prepare('SELECT 1 FROM export_presence WHERE video_id=? AND september=1 AND october=0').get(row.id)), result: row.result_json ? JSON.parse(row.result_json) : null, result_json: undefined,
      collections: grouped.get(row.id) || []
    }));
  }
  get(id) {
    const row=this.db.prepare('SELECT * FROM videos WHERE id=?').get(id);
    return row && {...row,researchOverride:Boolean(this.db.prepare('SELECT 1 FROM research_overrides WHERE video_id=?').get(row.id)),result:row.result_json?JSON.parse(row.result_json):null,result_json:undefined,
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
    if(result?.skipReason==='visual_reference')this.db.prepare('INSERT OR IGNORE INTO reference_history VALUES(?,?,?)').run(id,this.db.prepare('SELECT result_json FROM videos WHERE id=?').get(id)?.result_json||null,now);
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
