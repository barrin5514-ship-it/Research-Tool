import {DatabaseSync,backup} from 'node:sqlite';
import {open,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {repairExportText,repairTextTree} from '../src/export-text.mjs';
const file=resolve('.research-data/library.sqlite');
const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=5000');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');const destination=resolve('.research-data',`before-text-repair-${stamp}.sqlite`);
const guard=await open(destination,'wx');await guard.close();await backup(db,destination);
const changes={titles:0,results:0,collectionNames:0,importNames:0};
try{db.exec('BEGIN IMMEDIATE');
 for(const row of db.prepare('SELECT id,title,result_json FROM videos').all()){
  const title=repairExportText(row.title),result=row.result_json?JSON.stringify(repairTextTree(JSON.parse(row.result_json))):null;
  if(title!==row.title){db.prepare('UPDATE videos SET title=? WHERE id=?').run(title,row.id);changes.titles++;}
  if(row.result_json&&JSON.stringify(JSON.parse(row.result_json))!==result){db.prepare('UPDATE videos SET result_json=? WHERE id=?').run(result,row.id);changes.results++;}
 }
 for(const row of db.prepare('SELECT video_id,name FROM memberships').all()){const name=repairExportText(row.name);if(name!==row.name){db.prepare('INSERT OR IGNORE INTO memberships VALUES(?,?)').run(row.video_id,name);db.prepare('DELETE FROM memberships WHERE video_id=? AND name=?').run(row.video_id,row.name);changes.collectionNames++;}}
 for(const row of db.prepare('SELECT hash,filename FROM imports').all()){const name=repairExportText(row.filename);if(name!==row.filename){db.prepare('UPDATE imports SET filename=? WHERE hash=?').run(name,row.hash);changes.importNames++;}}
 db.exec('COMMIT');
 const checks=db.prepare('PRAGMA integrity_check').get();
 const report={backup:destination,changes,records:db.prepare('SELECT count(*) AS n FROM videos').get().n,integrity:checks.integrity_check};
 await writeFile('.research-data/text-repair-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
