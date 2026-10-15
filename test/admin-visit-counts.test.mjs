import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function app({failAt=-1,counts=[500,12,88],apiError=false}={}){
 const calls=[],updates=[],els=new Map(['aVisitTotal','aVisitToday','aVisit7'].map(id=>[id,{value:'old',set textContent(v){updates.push([id,v]);this.value=v;}}]));
 const now=new Date(2026,9,12,15,30).getTime();
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const ctx=vm.createContext({window:{},Date:Clock,$:id=>els.get(id),sb:{from(table){
  const index=calls.length,call={table};calls.push(call);
  return{select(columns,options){call.columns=columns;call.options=options;return this;},gte(column,value){call.gte=[column,value];return this;},then(resolve,reject){
   call.updatesBefore=updates.length;
   return (index===failAt?Promise.reject(Error('offline')):Promise.resolve({count:counts[index],...(apiError?{error:{message:'denied'}}:{})})).then(resolve,reject);
  }};
 }}});
 for(const file of ['src/adapters/visitors/track-visit.js','src/adapters/visitors/admin-visit-counts-store.js','src/domain/visitors/resolve-admin-visit-windows.js','src/application/visitors/load-admin-visit-statistics.js','src/ui/visitor-admin-counts.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
 const service=readFileSync(new URL('../src/services/visit-stats.js',import.meta.url),'utf8');
 vm.runInContext(service.slice(0,service.indexOf('/* ═══════════')),ctx);
 return{calls,updates,now,run:()=>vm.runInContext('loadVisitStats()',ctx)};
}

test('admin counts preserve sequential requests, local day, rolling week and incremental updates',async()=>{
 const a=app();await a.run();
 const today=new Date(a.now);today.setHours(0,0,0,0);
 assert.deepEqual(JSON.parse(JSON.stringify(a.calls)),[
  {table:'site_visits',columns:'*',options:{count:'exact',head:true},updatesBefore:0},
  {table:'site_visits',columns:'*',options:{count:'exact',head:true},gte:['visited_at',today.toISOString()],updatesBefore:1},
  {table:'site_visits',columns:'*',options:{count:'exact',head:true},gte:['visited_at',new Date(a.now-7*86400000).toISOString()],updatesBefore:2}
 ]);
 assert.deepEqual(a.updates,[['aVisitTotal',500],['aVisitToday',12],['aVisit7',88]]);
});

for(const failAt of [0,1,2])test('admin count failure at '+failAt+' preserves earlier updates and stops later reads',async()=>{
 const a=app({failAt});await a.run();
 assert.equal(a.calls.length,failAt+1);
 assert.deepEqual(a.updates,[...([['aVisitTotal',500],['aVisitToday',12]].slice(0,failAt)),['aVisitTotal','—']]);
});

test('admin counts retain zero fallback and resolved API-error behavior',async()=>{
 const a=app({counts:[null,undefined,0],apiError:true});await a.run();
 assert.deepEqual(a.updates,[['aVisitTotal',0],['aVisitToday',0],['aVisit7',0]]);
});
