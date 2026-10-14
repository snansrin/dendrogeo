import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import vm from 'node:vm';
import {checkArchitecture} from '../scripts/check-architecture.mjs';
import {checkDependencyRules} from '../scripts/lib/dependency-rules.mjs';

function fixture(run){
 const directory=mkdtempSync(join(tmpdir(),'dg-architecture-completion-'));
 const write=(layer,name,source)=>{const target=join(directory,'src',layer);mkdirSync(target,{recursive:true});writeFileSync(join(target,name),source);};
 try{return run(directory,write);}finally{assert.ok(resolve(directory).startsWith(resolve(tmpdir())+'\\')||resolve(directory).startsWith(resolve(tmpdir())+'/'));rmSync(directory,{recursive:true,force:true});}
}
test('completion gates reject DOM, map, event and hidden clock/random transport in inward layers',()=>fixture((root,write)=>{
 write('application','dom.js','function run(element){element.innerHTML="x";}');
 write('application','map.js','function run(map){map.fitBounds([]);}');
 write('application','event.js','function run(event){event.preventDefault();}');
 write('domain','clock.js','function run(){return Date.now()+Math.random();}');
 write('domain','transport.js','function run(){return new AbortController();}');
 write('ui','network.js','function run(){return fetch("/");}');
 const result=checkArchitecture(root);
 for(const name of ['dom','map','event','clock','transport','network'])assert.ok(result.errors.some(e=>e.includes('/'+name+'.js:')),name);
}));
test('injected operations and UI presentation remain permitted',()=>fixture((root,write)=>{
 write('domain','clock-input.js','window.DG_CLOCK_RULE={run(now){return new Date(now).toISOString();}};');
 write('application','ports.js','window.DG_USE_CASE={run(ports){return ports.load().then(ports.render);}};');
 write('ui','view.js','window.DG_VIEW={run(element){element.textContent="x";}};');
 assert.deepEqual(checkArchitecture(root).errors,[]);
}));
test('bare globals and adapter-to-UI dependencies cannot bypass direction gates',()=>fixture((root,write)=>{
 write('ui','view.js','window.DG_VIEW={render(){}};');
 write('domain','bad.js','window.DG_DOMAIN={run(){DG_VIEW.render();}};');
 write('application','bad.js','window.DG_APP={run(){DG_VIEW.render();}};');
 write('adapters','bad.js','window.DG_ADAPTER={run(){DG_VIEW.render();}};');
 const result=checkDependencyRules(root);
 assert.equal(result.errors.length,3);
 for(const layer of ['domain','application','adapters'])assert.ok(result.errors.some(e=>e.startsWith('src/'+layer+'/bad.js:')));
}));
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function rules(){
 const root={};const FakeDate=class extends Date{constructor(...args){if(!args.length)throw Error('Hidden clock');super(...args);}static now(){throw Error('Hidden clock');}};
 const context=vm.createContext({window:root,globalThis:root,Date:FakeDate,Math:Object.assign(Object.create(Math),{random(){throw Error('Hidden randomness');}})});
 for(const p of ['domain/backup/reminder-state','domain/parks/stamp-geofence-decision','domain/surface/sentinel-temporal-windows','domain/surface/create-selected-object-boundary','domain/surface/create-surface-cell-decision','domain/reports/normalize-report-orcid','domain/reports/clean-report-context','domain/reports/validate-report-context','domain/reports/decode-report-context','domain/reports/report-context'])vm.runInContext(read('src/'+p+'.js'),context);
 return root;
}
test('scientific date windows and saved provenance depend only on explicit clock inputs',()=>{
 const root=rules(),now=Date.parse('2026-10-14T12:00:00Z');
 assert.equal(root.DG_SENTINEL_TEMPORAL_WINDOWS.seasonRange(2021,'ytd',now).end,new Date(now-1).toISOString());
 assert.equal(root.DG_SENTINEL_TEMPORAL_WINDOWS.seasonRange(2021,'ref',now).start,'2021-06-01T00:00:00Z');
 assert.ok(root.DG_SENTINEL_TEMPORAL_WINDOWS.waterWindows(2021,'ytd',now).every(w=>Date.parse(w.end)<=now));
 assert.equal(root.DG_BACKUP_REMINDER_STATE.evaluate('2026-10-01T12:00:00Z',now).elapsedDays,13);
 const payload={};root.DG_GEOFENCE_AUDIT_STAMP.stamp(payload,{fix:{},verified:true,acc:4.6,distM:12},{now:()=>new Date(now)});assert.equal(payload.geo_verified_at,new Date(now).toISOString());assert.equal(payload.geo_acc_m,5);
 assert.equal(root.DG_SELECTED_OBJECT_BOUNDARY.create({type:'water',geometry:{},timestamp:'explicit'}).ts,'explicit');
 assert.equal(root.DG_SURFACE_CELL_DECISION.create({cell:{classKey:'green'},toClass:'water',types:{water:{}},timestamp:'explicit',cellKey:()=> 'key'}).decision.ts,'explicit');
});
test('report future-date validation remains enforced through the explicit today boundary',()=>{
 const root=rules(),study={author_name:'Araştırmacı',project_name:'Park',title:'Envanter',purpose:'Park envanterindeki ağaçların bilimsel ölçümleri.',start_date:'2026-01-01',end_date:'2026-10-15'};
 assert.equal(root.DG_VALIDATE_REPORT_CONTEXT.validate(study,'2026-10-14').valid,false);
 assert.equal(root.DG_VALIDATE_REPORT_CONTEXT.validate(study,'2026-10-15').valid,true);
 assert.throws(()=>root.DG_VALIDATE_REPORT_CONTEXT.validate(study),/today/);
 assert.throws(()=>root.DG_DECODE_REPORT_CONTEXT.decode({schema:'dendrogeo-report-context/1',study,publication_consent:true},'2026-10-14'),/geçersiz/);
});
