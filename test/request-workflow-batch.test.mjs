import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
for(const file of ['reject-request','load-options','load-own-requests','load-queue'])vm.runInNewContext(readFileSync(new URL('../src/application/data-requests/'+file+'.js',import.meta.url),'utf8'),{window});

test('rejection waits for update and transport failures do not notify or refresh',async()=>{
 const calls=[];let release;const pending=new Promise(resolve=>{release=resolve;});
 const ports={confirm:()=>true,reject:()=>pending,onFailure:()=>calls.push('failure'),onSuccess:()=>calls.push('success'),refresh:()=>calls.push('refresh')};
 const run=window.DG_REJECT_DATA_REQUEST.execute(7,ports);assert.equal(calls.length,0);release({error:null});await run;assert.deepEqual(calls,['success','refresh']);
 calls.length=0;ports.reject=()=>Promise.reject(Error('offline'));await assert.rejects(window.DG_REJECT_DATA_REQUEST.execute(7,ports),/offline/);assert.equal(calls.length,0);
});

test('option loading keeps partial application and silently stops if a later warning fails',async()=>{
 const calls=[];await window.DG_LOAD_DATA_REQUEST_OPTIONS.execute({load:async()=>({measurements:{data:[1]},projects:{data:[2]}}),apply:()=>calls.push('apply'),warn:()=>{calls.push('warn');throw Error('warning');},fillCountries:()=>calls.push('countries'),refreshCities:()=>calls.push('cities')});
 assert.deepEqual(calls,['apply','warn']);
});

test('own-list loading resolves the target after the query and ignores vanished views',async()=>{
 const calls=[];await window.DG_LOAD_OWN_DATA_REQUESTS.execute({id:'qa'},{load:async id=>{calls.push(['load',id]);return{data:[1]};},getTarget:()=>{calls.push('target');return null;},onFailure:()=>assert.fail(),onEmpty:()=>assert.fail(),render:()=>assert.fail()});
 assert.deepEqual(calls,[['load','qa'],'target']);
});

test('queue loading preserves count/pending/closed sequence and stops on failed presentation',async()=>{
 const calls=[],pending=[1],closed=[2];
 const ports={load:async()=>({data:[]}),partition:()=>({pending,closed}),updateCounts:(p,c)=>{assert.equal(p,pending);assert.equal(c,closed);calls.push('counts');},renderPending:()=>calls.push('pending'),renderClosed:()=>calls.push('closed')};
 await window.DG_LOAD_DATA_REQUEST_QUEUE.execute(ports);assert.deepEqual(calls,['counts','pending','closed']);
 calls.length=0;ports.renderPending=()=>{calls.push('pending');throw Error('render');};await assert.rejects(window.DG_LOAD_DATA_REQUEST_QUEUE.execute(ports),/render/);assert.deepEqual(calls,['counts','pending']);
});
