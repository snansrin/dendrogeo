import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function runtime(){
 const window={};
 for(const file of ['src/adapters/offline/persist-queued-measurement.js','src/application/offline/sync-queued-measurement.js','src/domain/offline/prepare-measurement-sync-payload.js','src/domain/trees/build-offline-measurement-record.js','src/domain/backup/sql-value.js','src/domain/backup/build-restore-sql.js'])vm.runInNewContext(read(file),{window});
 return window;
}

test('offline edits compare their original server snapshot atomically and preserve conflicting rows',async()=>{
 const w=runtime(),db=new PGlite();
 try{
  await db.exec("create table measurements(id bigint primary key,owner text,height_m double precision,photo_url text,status text);insert into measurements values(7,'u1',10,null,'Beklemede');");
  const baseline=(await db.query('select * from measurements')).rows[0];
  // Real PostgreSQL executes the adapter predicates together, not a separate read-then-write.
  const client={from(table){assert.equal(table,'measurements');let payload;const predicates=[];return{
   update(value){payload=value;return this;},eq(key,value){predicates.push([key,value]);return this;},is(key,value){assert.equal(value,null);predicates.push([key,null]);return this;},
   async select(){const values=[];const param=value=>{values.push(value);return '$'+values.length;};const setters=Object.entries(payload).map(([key,value])=>'"'+key+'"='+param(value));const where=predicates.map(([key,value])=>'"'+key+'"'+(value===null?' is null':'='+param(value)));return{data:(await db.query('update measurements set '+setters.join(',')+' where '+where.join(' and ')+' returning id',values)).rows};}
  };}};
  const queued=w.DG_BUILD_OFFLINE_MEASUREMENT_RECORD.build({record:{owner:'u1',height_m:12},editId:7,clientId:'queue',baseline});
  assert.notEqual(queued._editBaseline,baseline);
  await db.query('update measurements set height_m=11 where id=7');
  const result=await w.DG_PERSIST_QUEUED_MEASUREMENT.save({client,payload:{height_m:12},editId:7,owner:'u1',baseline:queued._editBaseline});
  assert.equal(result.data.length,0);assert.equal((await db.query('select height_m from measurements')).rows[0].height_m,11);
  const fresh=(await db.query('select * from measurements')).rows[0];
  assert.equal((await w.DG_PERSIST_QUEUED_MEASUREMENT.save({client,payload:{height_m:12},editId:7,owner:'u1',baseline:fresh})).data.length,1);
  assert.equal((await db.query('select height_m from measurements')).rows[0].height_m,12);
 }finally{await db.close();}
});

test('legacy or cross-owner offline edits stay queued before photo upload or persistence',async()=>{
 const w=runtime();let writes=0;
 for(const baseline of [null,{id:7,owner:'other'},{id:8,owner:'u1'}]){
  await assert.rejects(w.DG_SYNC_QUEUED_MEASUREMENT.run({record:{data:{_editId:7,_editBaseline:baseline,photoBlob:{}}},owner:'u1',uploadPhoto:()=>writes++,persist:()=>writes++}),/başlangıç kaydı yok/);
 }
 assert.equal(writes,0);
 const baseline={id:7,owner:'u1'};
 await assert.rejects(w.DG_SYNC_QUEUED_MEASUREMENT.run({record:{data:{_editId:7,_editBaseline:baseline}},owner:'u1',isCurrent:()=>true,preparePayload:()=>({}),persist:async()=>({data:[]})}),/kuyrukta korundu/);
 const payload=w.DG_PREPARE_MEASUREMENT_SYNC_PAYLOAD.build({_editId:7,_editBaseline:baseline,owner:'u1'});
 assert.deepEqual(JSON.parse(JSON.stringify(payload)),{owner:'u1'});
});

test('backup SQL preserves nested park and accepted surface JSON and foreign-key order',async()=>{
 const w=runtime(),db=new PGlite(),geometry={type:'Polygon',coordinates:[[[32,40],[33,40],[32,41],[32,40]]]},payload={accepted:{name:"Göksu's geometry",geometry},revision:26};
 try{
  await db.exec('create table parks(id bigint primary key,geom_json jsonb);create table projects(id bigint primary key,park_id bigint references parks);create table surface_reviews(owner text,park_id bigint references parks,payload jsonb,primary key(owner,park_id));');
  const backup={parks:[{id:25,geom_json:geometry}],projects:[{id:1,park_id:25}],surface_reviews:[{owner:'u1',park_id:25,payload}]};
  const result=w.DG_BUILD_RESTORE_SQL.build(backup,w.DG_BACKUP_SQL_VALUE.serialize);
  assert.equal(result.count,3);await db.exec(result.sql);await db.exec(result.sql);
  assert.deepEqual((await db.query('select payload from surface_reviews')).rows[0].payload,payload);
  assert.deepEqual((await db.query('select geom_json from parks')).rows[0].geom_json,geometry);
  assert.equal((await db.query('select * from projects')).rows.length,1);
 }finally{await db.close();}
});

test('CI covers modular surface paths on pull requests and main and keeps WebKit checks',()=>{
 const workflow=read('.github/workflows/gis-three-park-qa.yml');
 for(const path of ['src/application/surface/**','src/domain/surface/**','src/adapters/surface/**'])assert.equal(workflow.split("'"+path+"'").length-1,2);
 assert.match(workflow,/push:\s+branches: \[main\]/);
 const mobile=read('.github/workflows/mobile-smoke.yml');
 for(const value of ['install --with-deps webkit','DG_UI_BROWSER: webkit','node scripts/profile-smoke.mjs','node scripts/ui-consistency-smoke.mjs'])assert.ok(mobile.includes(value));
 assert.equal(read('scripts/check-accessibility.mjs').split("'wcag22aa'").length-1,3);
 assert.match(read('docs/report-production-standard.md'),/Akademik künye alanlarının tamamı isteğe bağlıdır/);
});
