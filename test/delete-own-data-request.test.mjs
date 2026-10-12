import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function app({user={id:'qa'},confirmed=true,data=[{id:7}],error=null}={}){
 const window={},calls=[],ctx=vm.createContext({window,USER:user,confirm:()=>{calls.push(['confirm']);return confirmed;},toast:(...args)=>calls.push(['toast',...args]),sb:{from(table){calls.push(['from',table]);return{delete(){calls.push(['delete']);return this;},eq(column,value){calls.push(['eq',column,value]);return this;},select(columns){calls.push(['select',columns]);return Promise.resolve({data,error});}};}}});
 for(const file of ['src/adapters/data-requests/delete-own-request.js','src/application/data-requests/delete-own-request.js','src/services/data-requests.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
 ctx.refresh=()=>calls.push(['refresh']);vm.runInContext('loadMyRequests=()=>refresh()',ctx);
 return{calls,run:id=>vm.runInContext('deleteMyRequest('+JSON.stringify(id)+')',ctx)};
}

test('own request deletion preserves numeric ID, user scope, returning ID and refresh',async()=>{
 const a=app();await a.run('7');assert.deepEqual(a.calls.slice(0,6),[['confirm'],['from','data_requests'],['delete'],['eq','id',7],['eq','user_id','qa'],['select','id']]);
 assert.deepEqual(a.calls.at(-1),['refresh']);assert.equal(a.calls[6][0],'toast');
});

test('own request deletion retains signed-out, invalid-ID and confirmation guards',async()=>{
 const signedOut=app({user:null});await signedOut.run(7);assert.equal(signedOut.calls.length,0);
 const invalid=app();await invalid.run('bad');assert.equal(invalid.calls.length,0);
 const cancelled=app({confirmed:false});await cancelled.run(7);assert.deepEqual(cancelled.calls,[['confirm']]);
});

test('own request deletion keeps API/zero-row failure notifications without refresh',async()=>{
 for(const options of [{error:{message:'denied'},data:null},{data:[]}]){
  const a=app(options);await a.run(7);assert.equal(a.calls.at(-1)[0],'toast');assert.match(a.calls.at(-1)[1],/Talep silinemedi/);assert.equal(a.calls.some(c=>c[0]==='refresh'),false);
 }
});
