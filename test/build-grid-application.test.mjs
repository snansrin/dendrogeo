import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const c=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('../src/application/parks/build-grid.js',import.meta.url),'utf8'),c);
const create=c.window.DG_GRID_BUILD_APPLICATION.create;
function setup(overrides={}){
 const calls=[],result={cells:[{}],areaM2:100},review={editing:true};
 const run=create({ensureSurface:async()=>calls.push('ensure'),isCurrent:()=>true,getGreenOnly:()=>true,getLastCells:()=>[{}],getReview:()=>review,getSignature:()=> 'sig',resolveEpsg:()=>32636,prepareParts:async()=>{calls.push('parts');return[];},buildRequest:()=>({type:'grid'}),runWorker:async()=>{calls.push('worker');return result;},runGrid:async()=>{calls.push('fallback');return result;},resolveBounds:()=>({}),fetchMeasurements:async()=>{calls.push('fetch');return{data:[{}],count:1};},warnTruncated:()=>calls.push('warn'),countMeasurements:()=>calls.push('count'),...overrides});return{run,calls,result,review};
}
const input={park:[[[39,32]]],epoch:1,size:20,clearance:5};
test('successful grid preserves result identity and counts measurements before acceptance',async()=>{const x=setup(),r=await x.run(input);assert.equal(r.status,'ready');assert.strictEqual(r.result,x.result);assert.strictEqual(r.review,x.review);assert.equal(r.signature,'sig');assert.deepEqual(x.calls,['ensure','parts','worker','fetch','warn','count']);});
test('cleared grid or changed park stops at each asynchronous context gate',async()=>{for(const gate of [1,2,3]){let check=0;const x=setup({isCurrent:()=>++check!==gate});assert.equal((await x.run(input)).status,'stale');assert.ok(!x.calls.includes('count'));assert.equal(x.calls.includes('fetch'),gate===3);}});
test('changed surface signature rejects worker results before measurement access',async()=>{let i=0;const x=setup({getSignature:()=>i++?'new':'old'});await assert.rejects(x.run(input),/Yüzey değişti/);assert.ok(!x.calls.includes('fetch'));});
test('surface change during measurement counting prevents accepting the grid',async()=>{let signature='old';const x=setup({getSignature:()=>signature,countMeasurements:()=>{signature='new';}});await assert.rejects(x.run(input),/Yüzey değişti/);});
test('worker no-result uses fallback once; rejected worker does not silently fall back',async()=>{const x=setup({runWorker:async()=>null});assert.equal((await x.run(input)).status,'ready');assert.equal(x.calls.filter(v=>v==='fallback').length,1);const failed=setup({runWorker:async()=>{throw Error('worker failed');}});await assert.rejects(failed.run(input),/worker failed/);assert.ok(!failed.calls.includes('fallback'));});
test('missing green coverage, busy review and query error stop acceptance',async()=>{for(const override of [{getLastCells:()=>null},{getReview:()=>({saving:true})},{fetchMeasurements:async()=>({error:Error('query failed')})}]){const x=setup(override);await assert.rejects(x.run(input));assert.ok(!x.calls.includes('count'));}});
