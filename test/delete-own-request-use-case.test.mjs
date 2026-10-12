import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};vm.runInNewContext(readFileSync(new URL('../src/application/data-requests/delete-own-request.js',import.meta.url),'utf8'),{window});
const execute=window.DG_DELETE_OWN_DATA_REQUEST_APPLICATION.execute;
function ports({confirmed=true,data=[{id:7}],error=null}={}){
 const calls=[];return{calls,api:{confirm:()=>{calls.push('confirm');return confirmed;},remove:async(id,userId)=>{calls.push(['remove',id,userId]);return{data,error};},onFailure:e=>calls.push(['failure',e]),onSuccess:()=>calls.push('success'),refresh:()=>calls.push('refresh')}};
}

test('own deletion use case enforces session, finite ID and confirmation before removing',async()=>{
 for(const [user,id] of [[null,7],[{id:'qa'},'bad'],[{id:'qa'},Infinity]]){const a=ports();await execute(user,id,a.api);assert.equal(a.calls.length,0);}
 const a=ports({confirmed:false});await execute({id:'qa'},7,a.api);assert.deepEqual(a.calls,['confirm']);
 const b=ports();await execute({id:'qa'},'7',b.api);assert.deepEqual(b.calls,['confirm',['remove',7,'qa'],'success','refresh']);
});

test('own deletion use case reports API and zero-row errors without success or refresh',async()=>{
 for(const options of [{data:null,error:{message:'denied'}},{data:[]},{data:null}]){
  const a=ports(options);await execute({id:'qa'},7,a.api);assert.equal(a.calls.at(-1)[0],'failure');assert.equal(a.calls.includes('success'),false);assert.equal(a.calls.includes('refresh'),false);
 }
});

test('own deletion use case waits for removal and propagates transport failures',async()=>{
 const a=ports();let release;const pending=new Promise(resolve=>{release=resolve;});a.api.remove=()=>{a.calls.push('remove');return pending;};
 const run=execute({id:'qa'},7,a.api);await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(a.calls,['confirm','remove']);release({data:[{id:7}],error:null});await run;assert.deepEqual(a.calls.slice(-2),['success','refresh']);
 const b=ports();b.api.remove=()=>Promise.reject(Error('offline'));await assert.rejects(execute({id:'qa'},7,b.api),/offline/);assert.deepEqual(b.calls,['confirm']);
});
