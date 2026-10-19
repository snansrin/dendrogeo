import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function store(){
 const window={};
 vm.runInNewContext(readFileSync(new URL('../src/adapters/visitors/aggregate-metrics-store.js',import.meta.url),'utf8'),{window});
 return window.DG_AGGREGATE_METRICS_STORE;
}
test('metrics reader forwards the RPC range and returns its payload unchanged',async()=>{
 const api=store(),calls=[],data={totals:{page_views:3}};
 for(const days of [1,7,30])assert.equal(await api.load({rpc:async(...args)=>{calls.push(args);return{data,error:null};}},days),data);
 assert.equal(JSON.stringify(calls),JSON.stringify([1,7,30].map(p_days=>['get_site_metrics_v1',{p_days}])));
 assert.ok(Object.isFrozen(api));assert.deepEqual(Object.keys(api),['load']);
});
test('metrics reader does not swallow RPC authorization or transport failures',async()=>{
 const api=store(),error=Error('Owner access required');
 await assert.rejects(api.load({rpc:async()=>({data:null,error})},7),value=>value===error);
 await assert.rejects(api.load({rpc:async()=>{throw error;}},30),value=>value===error);
 assert.equal(await api.load({rpc:async()=>({data:null,error:null})},1),null);
});
