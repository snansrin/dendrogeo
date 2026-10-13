import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/domain/backup/sql-value.js',
 'src/domain/backup/build-restore-sql.js',
 'src/ui/restore-backup-prompt.js',
 'src/adapters/backup/download-restore-sql.js',
 'src/application/backup/restore-backup.js'
];
function runtime(extra={}){
 const window={...extra};
 vm.runInNewContext(files.map(file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')).join('\n'),{window});
 return window;
}

test('backup SQL values preserve null, finite number, boolean and quote escaping',()=>{
 const w=runtime(),serialize=w.DG_BACKUP_SQL_VALUE.serialize;
 assert.deepEqual([serialize(null),serialize(undefined),serialize(3.5),serialize(Infinity),serialize(true),serialize(false),serialize("O'Name")],['NULL','NULL','3.5','NULL','true','false',"'O''Name'"]);
});

test('restore SQL keeps table order, escapes identifiers and metadata, and skips invalid rows',()=>{
 const w=runtime(),backup={exported_at:'2026-10-04\r\nSELECT 1;',exported_by:'Field\nCOMMIT;\n-- injected',
  projects:[{id:1,name:"Park O'Name",'x") VALUES (1); DROP TABLE public.parks; --':2}],measurements:[null,{}],waypoints:[],data_requests:[{id:4}]};
 const result=w.DG_BUILD_RESTORE_SQL.build(backup,w.DG_BACKUP_SQL_VALUE.serialize);
 assert.equal(result.count,2);
 assert.ok(result.sql.indexOf('-- projects')<result.sql.indexOf('-- measurements'));
 assert.ok(result.sql.indexOf('-- measurements')<result.sql.indexOf('-- data_requests'));
 assert.ok(result.sql.includes("'Park O''Name'"));
 assert.ok(result.sql.includes('"x"") VALUES (1); DROP TABLE public.parks; --"'));
 assert.ok(result.sql.includes('-- Yedek tarihi: 2026-10-04  SELECT 1; · disa aktaran: Field COMMIT; -- injected'));
 assert.equal(result.sql.split('\n').filter(line=>line==='COMMIT;').length,1);
});

test('restore prompt keeps all existing counts and export date',()=>{
 const w=runtime(),format=(template,args)=>template.replace(/\{(\w+)\}/g,(_,key)=>args[key]);
 const prompt=w.DG_RESTORE_BACKUP_PROMPT.build({counts:{measurements:2,projects:3,waypoints:4,data_requests:5},exported_at:'2026-10-12T14:00:00Z'},format);
 assert.match(prompt,/2 ölçüm · 3 proje · 4 waypoint · 5 talep/);
 assert.match(prompt,/2026-10-12/);
});

test('restore SQL download appends, clicks, removes and revokes its object URL after five seconds',()=>{
 const events=[],anchor={click(){events.push('click');},remove(){events.push('remove');}};
 const browser={document:{createElement:()=>anchor,body:{appendChild(){events.push('append');}}},
  URL:{createObjectURL(blob){events.push(['url',blob.type]);return'blob:restore';},revokeObjectURL(url){events.push(['revoke',url]);}},
  Blob:class{constructor(parts,options){this.type=options.type;assert.equal(JSON.stringify(parts),'["sql"]');}},
  setTimeout(fn,delay){events.push(['timeout',delay]);fn();}};
 runtime().DG_BACKUP_RESTORE_SQL_DOWNLOAD.download(browser,'sql','restore.sql');
 assert.equal(anchor.href,'blob:restore');assert.equal(anchor.download,'restore.sql');
 assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['url','append','click','remove','timeout','revoke']);
 assert.deepEqual(events.at(-2),['timeout',5000]);assert.deepEqual(events.at(-1),['revoke','blob:restore']);
});

test('restore application preserves cancellation, empty-backup, success and failure outcomes',()=>{
 const w=runtime(),events=[];
 const ports={confirm:()=>false,prompt:()=>{events.push('prompt');return'confirm';},build:()=>{events.push('build');return{sql:'sql',count:1};},filename:()=> 'restore.sql',download:()=>events.push('download'),onInvalid:()=>events.push('invalid'),onSuccess:()=>events.push('success'),onFailure:()=>events.push('failure')};
 assert.equal(w.DG_RESTORE_BACKUP_APPLICATION.execute({},ports).status,'cancelled');assert.deepEqual(events,['prompt']);
 ports.confirm=()=>true;ports.build=()=>({sql:'',count:0});assert.equal(w.DG_RESTORE_BACKUP_APPLICATION.execute({},ports).status,'invalid');
 ports.build=()=>({sql:'sql',count:1});assert.equal(w.DG_RESTORE_BACKUP_APPLICATION.execute({},ports).status,'downloaded');
 ports.download=()=>{throw new Error('download failed');};assert.equal(w.DG_RESTORE_BACKUP_APPLICATION.execute({},ports).status,'failed');
 assert.deepEqual(events,['prompt','prompt','invalid','prompt','download','success','prompt','failure']);
});

test('backup service delegates restore prompts, SQL building and downloads to the new modules',()=>{
 const events=[];let output;
 const context={window:null,confirm:message=>{events.push(['confirm',message]);return true;},dgTfs:(template,args)=>template.replace(/\{(\w+)\}/g,(_,key)=>args[key]),dgCf:s=>s,
  toast:(...args)=>events.push(['toast',...args]),Blob:class{constructor(parts){output=parts.join('');}},
  URL:{createObjectURL:()=> 'blob:restore',revokeObjectURL(){}},setTimeout(){},
  document:{createElement:()=>({click(){events.push('click');},remove(){events.push('remove');}}),body:{appendChild(){events.push('append');}}}};
 context.window=context;vm.createContext(context);
 for(const file of [...files,'src/services/backup.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 context.dgRestoreSQL({counts:{projects:1},exported_at:'2026-10-12T12:00:00Z',projects:[{id:1}]});
 assert.match(events[0][1],/1 proje/);assert.match(output,/INSERT INTO public\.projects/);
 assert.deepEqual(events.slice(-4),['append','click','remove',['toast',"✓ Geri yükleme SQL'i indirildi — Supabase → SQL Editor'da çalıştırın. Satırlar korunur, çakışanlar atlanır.",'ok','📥']]);
});
