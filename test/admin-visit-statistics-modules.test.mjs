import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/adapters/visitors/track-visit.js','src/adapters/visitors/admin-visit-counts-store.js',
 'src/domain/visitors/resolve-admin-visit-windows.js','src/application/visitors/load-admin-visit-statistics.js','src/ui/visitor-admin-counts.js'];

test('admin visit windows preserve local midnight and rolling seven days',()=>{
 const window={};vm.runInNewContext(read('src/domain/visitors/resolve-admin-visit-windows.js'),{window});
 const now=new Date(2026,9,12,15,30).getTime(),expectedToday=new Date(now);expectedToday.setHours(0,0,0,0);
 const actual=window.DG_RESOLVE_ADMIN_VISIT_WINDOWS.resolve(now);
 assert.equal(actual.today,expectedToday.toISOString());
 assert.equal(actual.sevenDays,new Date(now-7*86400000).toISOString());
});

test('admin visit-statistics use case reads sequentially and keeps earlier field updates',async()=>{
 const events=[];
 const window={};vm.runInNewContext(read('src/application/visitors/load-admin-visit-statistics.js'),{window});
 const run=window.DG_LOAD_ADMIN_VISIT_STATISTICS.create({
  loadTotal:async()=>{events.push('total');return{count:500};},
  resolveWindows:()=>{events.push('windows');return{today:'today',sevenDays:'week'};},
  loadSince:async date=>{events.push(date);if(date==='week')throw Error('offline');return{count:12};},
  setTotal:value=>events.push(['total-ui',value]),setToday:value=>events.push(['today-ui',value]),
  setSevenDays:value=>events.push(['week-ui',value]),fail:()=>events.push('failed')
 });
 await run();
 assert.deepEqual(events,['total',['total-ui',500],'windows','today',['today-ui',12],'week','failed']);
});

test('admin visit-statistics service composes the modules before its compatibility facade',async()=>{
 const calls=[],updates=[],elements=new Map(['aVisitTotal','aVisitToday','aVisit7'].map(id=>[id,{set textContent(value){updates.push([id,value]);}}]));
 const now=new Date(2026,9,12,15,30).getTime();
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const window={};
 const context=vm.createContext({window,Date:Clock,$:id=>elements.get(id),sb:{from(table){
  const call={table};calls.push(call);
  return{select(columns,options){call.columns=columns;call.options=options;return this;},gte(column,value){call.gte=[column,value];return this;},then(resolve){return Promise.resolve({count:[500,12,88][calls.length-1]}).then(resolve);}};
 }}});
 for(const path of modules)vm.runInContext(read(path),context);
 const service=read('src/services/visit-stats.js');
 vm.runInContext(service.slice(0,service.indexOf('/* ═══════════')),context);
 await vm.runInContext('loadVisitStats()',context);
 const today=new Date(now);today.setHours(0,0,0,0);
 assert.deepEqual(calls.map(call=>call.gte?.[1]||'total'),['total',today.toISOString(),new Date(now-7*86400000).toISOString()]);
 assert.deepEqual(updates,[['aVisitTotal',500],['aVisitToday',12],['aVisit7',88]]);
 const head=read('partials/head.html'),precache=read('sw.js');
 for(const path of ['src/adapters/visitors/admin-visit-counts-store.js','src/domain/visitors/resolve-admin-visit-windows.js','src/application/visitors/load-admin-visit-statistics.js','src/ui/visitor-admin-counts.js']){
  assert.ok(head.indexOf(path)<head.indexOf('src/services/visit-stats.js'));assert.ok(precache.includes('/'+path));
 }
});
