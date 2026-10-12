import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../src/application/backup/create-full-backup.js',import.meta.url),'utf8'),{window});const execute=window.DG_CREATE_FULL_BACKUP.execute;
function ports(fail=null){const calls=[];return{calls,api:{load:async(table,order)=>{calls.push([table,order]);if(table===fail)throw Error(table);return[{table}];},build:data=>{calls.push(['build',data.requests.length]);return data;},name:()=>{calls.push('name');return 'backup.json';},download:(data,name)=>calls.push(['download',name]),remember:()=>calls.push('remember'),onDenied:()=>{calls.push('denied');return 'denied-result';},onStart:()=>calls.push('start'),onSuccess:(name,count)=>calls.push(['success',name,count]),onFailure:error=>calls.push(['failure',error.message])}};}
test('full backup preserves authorization, sequential reads and download/storage/success order',async()=>{
 const denied=ports();assert.equal(await execute({role:'user'},denied.api),'denied-result');assert.deepEqual(denied.calls,['denied']);
 const a=ports();await execute({role:'owner'},a.api);assert.deepEqual(a.calls,['start',['measurements','created_at'],['projects','id'],['waypoints','id'],['data_requests','created_at'],['build',1],'name',['download','backup.json'],'remember',['success','backup.json',1]]);
});
test('full backup fails on required datasets but tolerates unavailable requests',async()=>{
 const a=ports('projects');await execute({role:'admin'},a.api);assert.deepEqual(a.calls,['start',['measurements','created_at'],['projects','id'],['failure','projects']]);
 const b=ports('data_requests');await execute({role:'admin'},b.api);assert.ok(b.calls.some(c=>Array.isArray(c)&&c[0]==='build'&&c[1]===0));assert.equal(b.calls.at(-1)[0],'success');
});
test('full backup keeps storage failures inside final error boundary',async()=>{
 const a=ports();a.api.remember=()=>{a.calls.push('remember');throw Error('storage');};await execute({role:'owner'},a.api);assert.deepEqual(a.calls.at(-1),['failure','storage']);assert.equal(a.calls.some(c=>Array.isArray(c)&&c[0]==='success'),false);
});
