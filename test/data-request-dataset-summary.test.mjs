import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
vm.runInNewContext(readFileSync(new URL('../src/domain/data-requests/summarize-dataset.js',import.meta.url),'utf8'),{window,Set});
vm.runInNewContext(readFileSync(new URL('../src/adapters/data-requests/fulfillment-store.js',import.meta.url),'utf8'),{window});
vm.runInNewContext(readFileSync(new URL('../src/adapters/data-requests/status-store.js',import.meta.url),'utf8'),{window});
vm.runInNewContext(readFileSync(new URL('../src/adapters/data-requests/reply-window.js',import.meta.url),'utf8'),{window,encodeURIComponent});
vm.runInNewContext(readFileSync(new URL('../src/ui/data-request-reply-content.js',import.meta.url),'utf8'),{window,Date,encodeURIComponent});
vm.runInNewContext(readFileSync(new URL('../src/application/data-requests/fulfill-request.js',import.meta.url),'utf8'),{window});
const summarize=window.DG_DATA_REQUEST_DATASET_SUMMARY.summarize;

test('request summary preserves count, carbon precision and distinct country/city values',()=>{
 const rows=[{carbon_kg:418.419108,country:'TR',city:'Ankara'},{carbon_kg:12.345678,country:'TR',city:'Ankara'},{carbon_kg:7.891234,country:'DE',city:'Berlin'}];
 const before=JSON.stringify(rows),result=summarize(rows);
 assert.equal(result.count,3);assert.equal(result.totalCarbon,rows.reduce((a,r)=>a+r.carbon_kg,0));
 assert.deepEqual([...result.countries],['TR','DE']);assert.deepEqual([...result.cities],['Ankara','Berlin']);
 assert.equal(JSON.stringify(rows),before);
});

test('request summary retains empty/falsy fallbacks and exact distinct-value semantics',()=>{
 const empty=summarize([]);assert.equal(empty.count,0);assert.equal(empty.totalCarbon,0);assert.equal(empty.countries.size,0);assert.equal(empty.cities.size,0);
 const result=summarize([{carbon_kg:null,country:' TR ',city:'Ankara'},{country:'TR',city:'ankara'},{carbon_kg:0,country:'',city:null},{carbon_kg:-2.5,country:undefined,city:' '}]);
 assert.equal(result.count,4);assert.equal(result.totalCarbon,-2.5);
 assert.deepEqual([...result.countries],[' TR ','TR']);assert.deepEqual([...result.cities],['Ankara','ankara',' ']);
});

test('request fulfillment keeps approved filters, CSV, reply totals and completion ordering',async()=>{
 const calls=[],data=[{carbon_kg:1000,country:'TR',city:'Ankara'},{carbon_kg:500,country:'TR',city:'Ankara'}];
 const req={email:'qa@example.test',country:'TR',city:'Ankara',project_name:'Park',profiles:{full_name:'Ada'}};
 const ctx=vm.createContext({window:{...window,open(url,target){calls.push(['mail',url,target]);}},Date,Set,USER:{id:'qa'},toast:()=>calls.push(['toast']),dl:(csv,name)=>calls.push(['csv',csv,name]),fullCSV:rows=>{assert.equal(rows,data);return 'CSV';},confirm:()=>true,dgCf:s=>s,sb:{from(table){
  const q={select(columns){calls.push(['select',table,columns]);return q;},eq(column,value){calls.push(['eq',table,column,value]);return q;},ilike(column,value){calls.push(['ilike',column,value]);return q;},in(column,values){calls.push(['in',column,Array.from(values)]);return q;},single(){return Promise.resolve({data:req});},update(body){calls.push(['update',table,body.status]);return q;},then(resolve,reject){return Promise.resolve({data:table==='projects'?[{id:7}]:data}).then(resolve,reject);}};return q;
 }}});
 vm.runInContext(readFileSync(new URL('../src/services/data-requests.js',import.meta.url),'utf8'),ctx);
 vm.runInContext('loadRequests=()=>{}',ctx);await vm.runInContext('fulfillRequest(9)',ctx);
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='measurements'&&c[2]==='status'&&c[3]==='Onaylı'));
 assert.deepEqual(calls.find(c=>c[0]==='in'),['in','project_id',[7]]);
 assert.equal(calls.find(c=>c[0]==='csv')[2],'dendrogeo_talep_9.csv');
 const mail=calls.find(c=>c[0]==='mail');assert.match(decodeURIComponent(mail[1]),/2 kayıt, 1\.50 t C/);assert.match(decodeURIComponent(mail[1]),/Kapsanan ülke\s+: 1/);
 assert.ok(calls.findIndex(c=>c[0]==='csv')<calls.findIndex(c=>c[0]==='mail'));
 assert.ok(calls.findIndex(c=>c[0]==='mail')<calls.findIndex(c=>c[0]==='update'));
});
