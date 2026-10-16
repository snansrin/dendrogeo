import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
function app({role='owner',failTable=null}={}){
 const events=[],store={};let backup;const now='2026-10-12T12:00:00.000Z';class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return Date.parse(now);}}
 const ctx={PROFILE:{role,full_name:'Ada'},Date:Clock,toast:(...args)=>events.push(['toast',...args]),dgCf:s=>s,dgTfs:(s,args)=>s.replace('{f}',args.f).replace('{n}',String(args.n)),localStorage:{getItem:key=>store[key],setItem(key,value){events.push('remember');store[key]=value;}},Blob:class{constructor(parts,options){assert.equal(options.type,'application/json');backup=JSON.parse(parts[0]);}},URL:{createObjectURL:()=> 'blob:qa',revokeObjectURL(){}},document:{createElement:()=>({click(){events.push('download');},remove(){}}),body:{appendChild(){}}},setTimeout(){},sb:{from(table){events.push(['query',table]);return{select(){return this;},order(){return this;},range(){return Promise.resolve(table===failTable?{error:{message:'denied'}}:{data:[{id:1,table}]});}};}}};ctx.window=ctx;vm.createContext(ctx);
 for(const file of ['src/adapters/backup/paged-store.js','src/domain/backup/build-snapshot.js','src/adapters/backup/json-download.js','src/application/backup/create-full-backup.js','src/domain/backup/reminder-state.js','src/services/backup.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
 return{ctx,events,store,backup:()=>backup};
}
test('full backup service composes all modules with original schema and download/storage order',async()=>{
 const a=app();await a.ctx.fullBackup();assert.deepEqual(a.events.filter(e=>Array.isArray(e)&&e[0]==='query').map(e=>e[1]),['measurements','projects','waypoints','data_requests','parks','surface_reviews']);assert.equal(a.backup().exported_by,'Ada');assert.equal(a.backup().exported_at,'2026-10-12T12:00:00.000Z');assert.equal(a.backup().counts.measurements,1);assert.equal(a.store.dg_lastBackup,'2026-10-12T12:00:00.000Z');assert.ok(a.events.indexOf('download')<a.events.indexOf('remember'));
});
test('full backup service keeps unauthorized/required-query failures and failure on every required dataset',async()=>{
 const denied=app({role:'user'});await denied.ctx.fullBackup();assert.equal(denied.backup(),undefined);assert.equal(denied.events.length,1);
 const failed=app({failTable:'projects'});await failed.ctx.fullBackup();assert.equal(failed.backup(),undefined);assert.equal(failed.events.at(-1)[2],'err');
 const optional=app({failTable:'data_requests'});await optional.ctx.fullBackup();assert.equal(optional.backup(),undefined);assert.equal(optional.events.at(-1)[2],'err');
});
test('backup reminder service preserves missing-backup warning and newly backed-up quiet state',async()=>{
 const a=app();a.ctx.checkBackupReminder();assert.match(a.events.at(-1)[1],/999 gün/);await a.ctx.fullBackup();const count=a.events.length;a.ctx.checkBackupReminder();assert.equal(a.events.length,count);
});
