import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function app({user={id:'qa'},data=[],error=null,reject=false}={}){
 const window={},calls=[],box={innerHTML:'old'};
 const ctx=vm.createContext({window,USER:user,Date,esc:value=>value==null?'':String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),$:id=>id==='myRequests'?box:null,dgScrollKeep:()=>{calls.push(['keep']);return 42;},dgScrollRestore:y=>calls.push(['restore',y]),sb:{from(table){calls.push(['from',table]);const q={select(columns){calls.push(['select',columns]);return q;},eq(column,value){calls.push(['eq',column,value]);return q;},order(column,options){calls.push(['order',column,JSON.parse(JSON.stringify(options))]);return q;},then(resolve,rejectFn){return (reject?Promise.reject(Error('offline')):Promise.resolve({data,error})).then(resolve,rejectFn);}};return q;}}});
 for(const file of ['src/adapters/data-requests/my-requests-store.js','src/ui/my-data-requests.js','src/services/data-requests.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
 return{calls,box,run:()=>vm.runInContext('loadMyRequests()',ctx)};
}

test('my request list preserves user-scoped newest-first query and escaped disclosure output',async()=>{
 const a=app({data:[{id:7,country:'TR',city:'Ankara',project_name:'<Park>',note:'<note>',status:'Tamamlandı',created_at:'2026-10-12T12:00:00Z'}]});await a.run();
 assert.deepEqual(a.calls,[['keep'],['from','data_requests'],['select','*'],['eq','user_id','qa'],['order','created_at',{ascending:false}],['restore',42]]);
 assert.match(a.box.innerHTML,/class="export-my-requests"/);assert.match(a.box.innerHTML,/&lt;Park&gt;/);assert.match(a.box.innerHTML,/&lt;note&gt;/);assert.match(a.box.innerHTML,/badge on/);assert.match(a.box.innerHTML,/deleteMyRequest\(7\)/);
});

test('my request list retains signed-out gate, empty state and API error message',async()=>{
 const signedOut=app({user:null});await signedOut.run();assert.deepEqual(signedOut.calls,[['keep'],['restore',42]]);assert.equal(signedOut.box.innerHTML,'old');
 const empty=app({data:null});await empty.run();assert.equal(empty.box.innerHTML,'');
 const failed=app({error:{message:'denied'}});await failed.run();assert.equal(failed.box.innerHTML,'<div class="alert err">Talepler yüklenemedi.</div>');assert.deepEqual(failed.calls.at(-1),['restore',42]);
});

test('my request list restores scroll even when transport rejects',async()=>{
 const a=app({reject:true});await assert.rejects(a.run(),/offline/);assert.equal(a.box.innerHTML,'old');assert.deepEqual(a.calls.at(-1),['restore',42]);
});
