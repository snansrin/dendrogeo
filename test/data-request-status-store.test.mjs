import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/adapters/data-requests/status-store.js',import.meta.url),'utf8');
const window={};vm.runInNewContext(source,{window});

test('request status adapter preserves exact update body, ID filter and response',async()=>{
 for(const status of ['Reddedildi','Tamamlandı']){
  const calls=[],response={error:null},timestamp='2026-10-12T12:00:00.000Z';
  const client={from(table){calls.push(['from',table]);return{update(body){calls.push(['update',JSON.parse(JSON.stringify(body))]);return this;},eq(column,value){calls.push(['eq',column,value]);return Promise.resolve(response);}};}};
  assert.equal(await window.DG_DATA_REQUEST_STATUS_STORE.update(client,7,status,timestamp),response);
  assert.deepEqual(calls,[['from','data_requests'],['update',{status,fulfilled_at:timestamp}],['eq','id',7]]);
 }
});

function app({confirmed=true,error=null}={}){
 const calls=[],window={};class Clock extends Date{constructor(){super('2026-10-12T12:00:00Z');}}
 const ctx=vm.createContext({window,Date:Clock,confirm:()=>{calls.push(['confirm']);return confirmed;},dgCf:s=>s,toast:(...args)=>calls.push(['toast',...args]),sb:{from(table){calls.push(['from',table]);return{update(body){calls.push(['update',JSON.parse(JSON.stringify(body))]);return this;},eq(column,value){calls.push(['eq',column,value]);return Promise.resolve({error});}};}}});
 vm.runInContext(source,ctx);vm.runInContext(readFileSync(new URL('../src/services/data-requests.js',import.meta.url),'utf8'),ctx);
 ctx.refresh=()=>calls.push(['refresh']);vm.runInContext('loadRequests=()=>refresh()',ctx);
 return{calls,run:()=>vm.runInContext('rejectRequest(7)',ctx)};
}

test('request rejection retains confirmation, timestamp and success refresh ordering',async()=>{
 const a=app();await a.run();
 assert.deepEqual(a.calls.slice(0,4),[['confirm'],['from','data_requests'],['update',{status:'Reddedildi',fulfilled_at:'2026-10-12T12:00:00.000Z'}],['eq','id',7]]);
 assert.deepEqual(a.calls.at(-1),['refresh']);assert.equal(a.calls[4][0],'toast');
});

test('request rejection cancellation avoids writes and API errors skip refresh',async()=>{
 const cancelled=app({confirmed:false});await cancelled.run();assert.deepEqual(cancelled.calls,[['confirm']]);
 const failed=app({error:{message:'denied'}});await failed.run();assert.deepEqual(failed.calls.at(-1),['toast','Hata: denied','err']);assert.equal(failed.calls.some(c=>c[0]==='refresh'),false);
});
