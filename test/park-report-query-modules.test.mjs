import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/domain/parks/resolve-park-report-target.js','src/domain/parks/build-park-report-request.js',
 'src/domain/parks/build-legacy-park-report-request.js','src/adapters/parks/park-report-store.js',
 'src/application/world/load-park-report.js'
];
function app(){const window={},context=vm.createContext({window});for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});return window;}

test('park report target preserves park identity and the proj: fallback selection',()=>{
 const w=app(),parks=[{park_id:7,park_name:'Göksu Parkı'}];
 const park= w.DG_RESOLVE_PARK_REPORT_TARGET.resolve('7',parks);assert.equal(park.row,parks[0]);assert.equal(park.isPark,true);assert.equal(park.name,'Göksu Parkı');
 const legacy=w.DG_RESOLVE_PARK_REPORT_TARGET.resolve('proj:Old Park',parks);assert.equal(legacy.row,undefined);assert.equal(legacy.isPark,false);assert.equal(legacy.name,'Old Park');
 assert.equal(w.DG_RESOLVE_PARK_REPORT_TARGET.resolve('',parks),null);
});

test('park and legacy requests keep strict embedded and project-name filters',()=>{
 const w=app();
 const primary=w.DG_BUILD_PARK_REPORT_REQUEST.build({isPark:true,row:{park_id:7},name:'Göksu'});
 const legacy=w.DG_BUILD_LEGACY_PARK_REPORT_REQUEST.build('Old Park');
 assert.match(primary.select,/projects!inner\(/);assert.deepEqual(JSON.parse(JSON.stringify(primary.filters)),[{column:'projects.park_id',value:7}]);
 assert.match(legacy.select,/projects\(name,city\)/);assert.deepEqual(JSON.parse(JSON.stringify(legacy.filters)),[{column:'projects.name',value:'Old Park'}]);
});

test('park report store runs the strict request first and falls back to the legacy query only after error',async()=>{
 const w=app(),calls=[];
 const sb={from(table){return{select(columns){calls.push(['select',table,columns]);const filters=[];const chain={eq(column,value){filters.push([column,value]);return chain;},limit(n){calls.push(['run',n,filters.slice()]);const primary=calls.filter(x=>x[0]==='run').length===1;return Promise.resolve(primary?{data:null,count:null,error:{message:'old schema'}}:{data:[{id:1}],count:1,error:null});}};return chain;}};}};
 const result=await w.DG_PARK_REPORT_STORE.load(sb,{select:'strict',filters:[{column:'projects.park_id',value:7}]},{select:'legacy',filters:[{column:'projects.name',value:'Göksu'}]});
 assert.equal(result.usedLegacy,true);assert.equal(result.data[0].id,1);assert.deepEqual(calls.map(call=>call[0]==='select'?call.slice(0,3):call.slice(0,2)),[['select','measurements','strict'],['run',5000],['select','measurements','legacy'],['run',5000]]);
});

test('park report application handles empty selection, legacy render and final errors',async()=>{
 const w=app(),calls=[];
 const args={key:'proj:Old Park',parkRows:[],load:async(primary,legacy)=>{calls.push([primary,legacy]);return{data:[{id:1}],count:1,error:null,usedLegacy:true};},warnIfTruncated:()=>calls.push('warn'),render:(...values)=>calls.push(['render',...values]),onNoSelection:()=>calls.push('empty'),onError:error=>calls.push(['error',error.message])};
 await w.DG_LOAD_PARK_REPORT.run({...args,key:''});assert.equal(calls[0],'empty');
 await w.DG_LOAD_PARK_REPORT.run(args);assert.deepEqual(calls[2].slice(0,4),['render','Old Park',[{id:1}],1]);assert.equal(calls[2][4],null);assert.equal(calls.includes('warn'),false);
 await w.DG_LOAD_PARK_REPORT.run({...args,load:async()=>({error:{message:'denied'}})});assert.deepEqual(calls.at(-1),['error','denied']);
});
