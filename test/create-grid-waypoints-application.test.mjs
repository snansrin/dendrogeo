import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/parks/create-grid-waypoints.js',import.meta.url),'utf8'),context);
const create=context.window.DG_GRID_WAYPOINT_CREATE_APPLICATION.create;
function setup(overrides={}){
 const calls=[],rows=[{wp_id:7},{wp_id:8}];
 const run=create({confirmBatch:n=>{calls.push(['confirm',n]);return true;},fetchLatest:async pid=>{calls.push(['latest',pid]);return{data:[{wp_id:6}]};},isCurrent:()=>true,getUserId:()=> 'user',prepareBatch:()=>({rows,firstWpId:7}),setLastRows:r=>calls.push(['last',r]),insert:async r=>{calls.push(['insert',r]);return{error:null};},...overrides});
 return{run,calls,rows};
}
const input={source:'signature',park:[],projectId:3,targetCells:[{}]};
test('stale context after latest lookup prevents preparing and writing waypoints',async()=>{
 const x=setup({isCurrent:()=>false,prepareBatch:()=>assert.fail('stale batch'),insert:()=>assert.fail('stale write')});const result=await x.run(input);assert.equal(result.status,'stale');assert.deepEqual(x.calls,[['latest',3]]);
});
test('cancelled large batch stops before fetching or writing',async()=>{
 const x=setup({confirmBatch:()=>false});assert.equal((await x.run({...input,targetCells:Array(501).fill({})})).status,'cancelled');assert.deepEqual(x.calls,[]);
});
test('successful batch retains row identity and ID range and skips confirmation at 500',async()=>{
 const x=setup({confirmBatch:()=>assert.fail('500 must not prompt')});const r=await x.run({...input,targetCells:Array(500).fill({})});assert.equal(r.status,'created');assert.strictEqual(r.rows,x.rows);assert.equal(r.first,7);assert.equal(r.next,9);assert.deepEqual(x.calls,[['latest',3],['last',x.rows],['insert',x.rows]]);
});
test('failed insert reports its error and preserves attempted rows for existing export state',async()=>{
 const error={message:'write rejected'},x=setup({insert:async()=>({error})});const r=await x.run(input);assert.equal(r.status,'write-failed');assert.strictEqual(r.error,error);assert.deepEqual(x.calls,[['latest',3],['last',x.rows]]);
});
