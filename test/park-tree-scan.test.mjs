import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function world(){const root={},context=vm.createContext({window:root});for(const path of ['domain/map/web-mercator-coordinates','domain/parks/point-in-polygon','domain/parks/park-containment','domain/trees/tree-detection-results','domain/trees/park-tree-scan-plan','domain/trees/park-tree-scan-results','application/trees/detect-tree-candidates'])vm.runInContext(readFileSync(new URL('../src/'+path+'.js',import.meta.url),'utf8'),context);return root;}
const root=world(),planner=root.DG_PARK_TREE_SCAN_PLAN,results=root.DG_PARK_TREE_SCAN_RESULTS;
const center=planner.pixel(40,32,19),[x,y]=center;
function ring(l,t,r,b){return[[l,t],[r,t],[r,b],[l,b],[l,t]].map(p=>planner.coordinate(...p,19));}
const park={outer:[ring(x-400,y-400,x+400,y+400)],inner:[]};
const raw=predictions=>({modelId:'tree-detection-fuytu/4',image:{width:1024,height:1024},predictions});
const row=(x=500,y=500,confidence=.8)=>({x,y,width:20,height:30,class:'Tree',confidence});
test('park plan retains geometry, bounds windows and never overzooms or silently reduces resolution',()=>{
 const plan=planner.plan(park);assert.equal(plan.chips.length,1);assert.equal(plan.zoom,19);assert.equal(plan.sourceResolutionM,null);assert.equal(plan.chips[0].width,1024);assert.equal(plan.key,JSON.stringify(park));assert.throws(()=>planner.plan(null),/park_required/);assert.throws(()=>planner.plan(park,{zoom:20}),/park_required/);assert.throws(()=>planner.plan({outer:[ring(x-10000,y-10000,x+10000,y+10000)]}),/park_too_large/);
});
test('park result filters holes/outside centers and keeps crown truth fields empty',()=>{
 const plan=planner.plan(park),chip=plan.chips[0];const hole=ring(chip.x+490,chip.y+490,chip.x+510,chip.y+510);plan.park.inner=[hole];
 const candidates=results.collect(raw([row(),row(600,600),row(1000,1000)]),chip);
 const result=results.summarize(candidates,plan,.5,{completed:1,total:1,startedAt:'test'});
 assert.equal(result.candidateCount,1);assert.equal(result.candidates[0].crownWidthM,null);assert.equal(result.candidates[0].crownAreaM2,null);assert.equal(result.crownAreaM2,null);assert.equal(result.confirmedTreeCount,null);assert.equal(result.candidates[0].crownEstimate.validated,false);assert.equal(result.status,'unvalidated-candidates');
 const expected=20*40075016.68557849/(256*2**19)*Math.cos(result.candidates[0].center[0]*Math.PI/180);assert.ok(Math.abs(result.candidates[0].crownEstimate.eastWestM-expected)<.02,'Mercator ground correction, not projected metre width');
});
test('cross-chip overlap is suppressed; confidence filters are reversible without inference',()=>{
 const plan=planner.plan(park),chip=plan.chips[0],other={...chip,id:1,x:chip.x+100};
 const rows=[...results.collect(raw([row()]),chip),...results.collect(raw([row(400,500,.7)]),other)];
 const summarize=threshold=>results.summarize(rows,plan,threshold,{completed:1,total:2});assert.equal(summarize(.5).candidateCount,1);assert.equal(summarize(.9).candidateCount,0);assert.equal(summarize(0).candidateCount,1);assert.equal(summarize(.5).status,'incomplete');assert.throws(()=>summarize(NaN),/invalid_threshold/);
});
test('chip and park-edge candidates do not expose crown extent estimates',()=>{
 const plan=planner.plan(park),chip=plan.chips[0];const candidate=results.collect(raw([row()]),chip)[0];candidate.edge=true;const result=results.summarize([candidate],plan,.5,{completed:1,total:1});assert.equal(result.candidates[0].crownEstimate,null);assert.equal(result.meanCrownWidthEstimateM,null);
});
function app(override={}){let current=park;const states=[],api={calls:0};const ports={getPark:()=>current,plan:planner.plan,readImage:async()=>({}),clearImages(){},infer:async()=>{api.calls++;return raw([row()]);},collect:results.collect,summarize:results.summarize,present:state=>states.push(state),makeAbortController:()=>new AbortController(),clock:()=>new Date().toISOString(),yieldFrame:async()=>{},...override};return{controller:root.DG_DETECT_TREE_CANDIDATES.create(ports),states,api,changePark(value){current=value;}};}
test('park application runs once and slider only filters cached predictions',async()=>{
 const value=app();await value.controller.run();assert.equal(value.states.at(-1).state,'complete');assert.equal(value.api.calls,1);value.controller.setThreshold(.95);assert.equal(value.states.at(-1).result.candidateCount,0);value.controller.setThreshold(.5);assert.equal(value.states.at(-1).result.candidateCount,1);assert.equal(value.api.calls,1);value.changePark(null);value.controller.contextChanged();assert.equal(value.states.at(-1).result,null);
});
test('park application cancels stale responses and prevents a duplicate request',async()=>{
 let finish;const value=app({infer:()=>new Promise(resolve=>finish=resolve)});const pending=value.controller.run();while(!finish)await new Promise(resolve=>setImmediate(resolve));await value.controller.run();value.controller.cancel();finish(raw([row()]));await pending;assert.equal(value.states.at(-1).state,'cancelled');assert.equal(value.states.at(-1).result.status,'incomplete');assert.equal(value.states.at(-1).result.candidateCount,0);
});
test('imagery failure cannot become a complete park count',async()=>{const value=app({readImage:async()=>{throw Error('imagery_unavailable');}});await value.controller.run();assert.equal(value.states.at(-1).error,'imagery_unavailable');assert.equal(value.states.at(-1).result.completed,0);assert.equal(value.states.at(-1).result.status,'incomplete');assert.equal(value.api.calls,0);});
