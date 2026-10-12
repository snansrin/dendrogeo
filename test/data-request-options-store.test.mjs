import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function app({rejectTable=null,measurements={data:[{country:'TR',city:'Ankara'}],count:6000},projects={data:[{id:7,name:'Park'}]}}={}){
 const window={},calls=[],elements={reqCountry:{value:'TR'},reqCity:{value:'Ankara'},reqProject:{value:''}};
 const ctx=vm.createContext({window,REQ_ROWS:['old'],REQ_PROJECTS:['old'],$:id=>elements[id],dgWarnIfTruncated:(...args)=>calls.push(['warn',...args]),listCountries:(rows,projs)=>{calls.push(['countries',rows,projs]);return ['TR'];},listCities:(...args)=>{calls.push(['cities',...args]);return ['Ankara'];},listProjects:(...args)=>{calls.push(['projects',...args]);return ['Park'];},fillSelect:(el,values)=>calls.push(['fill',el,values]),sb:{from(table){calls.push(['from',table]);const q={select(columns,options){calls.push(['select',table,columns,options&&JSON.parse(JSON.stringify(options))]);return q;},eq(column,value){calls.push(['eq',column,value]);return q;},limit(n){calls.push(['limit',n]);return q;},order(column){calls.push(['order',column]);return q;},then(resolve,reject){calls.push(['await',table]);return (table===rejectTable?Promise.reject(Error('offline')):Promise.resolve(table==='measurements'?measurements:projects)).then(resolve,reject);}};return q;}}});
 for(const file of ['src/adapters/data-requests/options-store.js','src/services/data-requests.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
 return{ctx,calls,elements,run:()=>vm.runInContext('loadRequestOptions()',ctx)};
}

test('request options preserve both query contracts and downstream warning/select order',async()=>{
 const a=app();await a.run();
 assert.deepEqual(a.calls.slice(0,6),[['from','measurements'],['select','measurements','country,city',{count:'exact'}],['eq','status','Onaylı'],['limit',5000],['from','projects'],['select','projects','id,name,country,city',undefined]]);
 assert.deepEqual(a.calls[6],['order','name']);
 const warning=a.calls.find(c=>c[0]==='warn');assert.equal(warning[2],5000);assert.equal(warning[3],'Talep formu seçenekleri');assert.equal(warning[4],6000);
 assert.equal(a.ctx.REQ_ROWS.length,1);assert.equal(a.ctx.REQ_PROJECTS[0].id,7);
 assert.deepEqual(a.calls.filter(c=>['warn','countries','cities','projects'].includes(c[0])).map(c=>c[0]),['warn','countries','cities','projects']);
 assert.equal(a.calls.filter(c=>c[0]==='fill').length,3);
});

test('request option query rejection preserves old state and skips warning/UI work',async()=>{
 for(const rejectTable of ['measurements','projects']){
  const a=app({rejectTable});await a.run();assert.equal(a.ctx.REQ_ROWS[0],'old');assert.equal(a.ctx.REQ_PROJECTS[0],'old');
  assert.equal(a.calls.filter(c=>c[0]==='await').length,2);assert.equal(a.calls.some(c=>c[0]==='fill'||c[0]==='warn'),false);
 }
});

test('resolved API errors with null data preserve the existing empty-option fallback',async()=>{
 const a=app({measurements:{data:null,count:null,error:{message:'denied'}},projects:{data:null,error:{message:'denied'}}});await a.run();
 assert.equal(a.ctx.REQ_ROWS.length,0);assert.equal(a.ctx.REQ_PROJECTS.length,0);assert.equal(a.calls.filter(c=>c[0]==='fill').length,3);
});
