import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};vm.runInNewContext(readFileSync(new URL('../src/application/data-requests/fulfill-request.js',import.meta.url),'utf8'),{window});
const execute=window.DG_FULFILL_DATA_REQUEST.execute;
function ports({dataset={request:{id:7},rows:[{id:1}]},approved=true,failAt=null}={}){
 const calls=[],summary={count:dataset?.rows.length||0},reply={subject:'subject',body:'body'};
 const call=(name,...args)=>{calls.push(name);if(failAt===name)throw Error(name);return args;};
 const api={load:async id=>{assert.equal(id,7);call('load');return dataset;},summarize:rows=>{assert.equal(rows,dataset.rows);call('summary');return summary;},confirmEmpty:()=>{call('confirm');return approved;},download:(rows,id)=>{assert.equal(rows,dataset.rows);assert.equal(id,7);call('download');},buildReply:(req,total)=>{assert.equal(req,dataset.request);assert.equal(total,summary);call('build');return reply;},openReply:(req,result)=>{assert.equal(req,dataset.request);assert.equal(result,reply);call('open');},complete:async id=>{assert.equal(id,7);call('complete');return {error:{message:'existing resolved error behavior'}};},notify:()=>call('notify'),refresh:()=>call('refresh')};
 return{api,calls};
}

test('fulfillment use case preserves successful sequence and resolved completion-error behavior',async()=>{
 const a=ports();await execute(7,a.api);assert.deepEqual(a.calls,['load','summary','download','build','open','complete','notify','refresh']);
});

test('fulfillment use case keeps missing request and declined empty-data early exits',async()=>{
 const missing=ports({dataset:null});await execute(7,missing.api);assert.deepEqual(missing.calls,['load']);
 const declined=ports({dataset:{request:{id:7},rows:[]},approved:false});await execute(7,declined.api);assert.deepEqual(declined.calls,['load','summary','confirm']);
 const accepted=ports({dataset:{request:{id:7},rows:[]}});await execute(7,accepted.api);assert.deepEqual(accepted.calls,['load','summary','confirm','build','open','complete','notify','refresh']);
});

test('fulfillment use case stops on failed ports and waits for completion before notifying',async()=>{
 for(const failAt of ['load','download','build','open','complete']){
  const a=ports({failAt});await assert.rejects(execute(7,a.api),new RegExp(failAt));assert.equal(a.calls.at(-1),failAt);
 }
 const a=ports();let release;const pending=new Promise(resolve=>{release=resolve;});a.api.complete=()=>{a.calls.push('complete');return pending;};
 const run=execute(7,a.api);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(a.calls.at(-1),'complete');release();await run;assert.deepEqual(a.calls.slice(-2),['notify','refresh']);
});
