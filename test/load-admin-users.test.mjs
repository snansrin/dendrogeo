import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../src/application/users/load-admin-users.js',import.meta.url),'utf8'),{window});
const execute=window.DG_LOAD_ADMIN_USERS.execute;
function ports({data=[{id:'qa'}],error=null}={}){const calls=[];return{calls,api:{load:async()=>{calls.push('load');return{data,error};},onFailure:e=>calls.push(['error',e]),apply:users=>calls.push(['cache',users]),summarize:users=>{calls.push('summary');return{total:users.length};},updateCounts:counts=>calls.push(['counts',counts.total]),render:(users,owner)=>calls.push(['render',users,owner]),filter:()=>calls.push('filter')}};}
test('admin list use case gates reads and preserves cache/count/render/filter ordering',async()=>{
 for(const profile of [null,{role:'user'}]){const a=ports();await execute(profile,a.api);assert.equal(a.calls.length,0);}
 const a=ports();await execute({role:'owner'},a.api);assert.deepEqual(a.calls.map(c=>Array.isArray(c)?c[0]:c),['load','cache','summary','counts','render','filter']);assert.equal(a.calls[4][2],true);
 const b=ports({data:null});await execute({role:'admin'},b.api);assert.equal(b.calls[1][1].length,0);assert.equal(b.calls[4][2],false);
});
test('admin list use case keeps API and transport failures from applying results',async()=>{
 const a=ports({error:{message:'denied'}});await execute({role:'owner'},a.api);assert.deepEqual(a.calls.map(c=>Array.isArray(c)?c[0]:c),['load','error']);
 const b=ports();b.api.load=()=>Promise.reject(Error('offline'));await assert.rejects(execute({role:'owner'},b.api),/offline/);assert.equal(b.calls.length,0);
});
test('admin list owner presentation is captured before asynchronous load',async()=>{
 const a=ports(),profile={role:'owner'};let release;const pending=new Promise(resolve=>{release=resolve;});a.api.load=()=>pending;
 const run=execute(profile,a.api);profile.role='admin';release({data:[{id:'qa'}],error:null});await run;assert.equal(a.calls.find(c=>c[0]==='render')[2],true);
});
