import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function setup(){
 const window={},ctx=vm.createContext({window});
 for(const p of ['src/application/trees/measurement-project-state.js','src/application/trees/load-measurement-project-directory.js','src/adapters/trees/fetch-owned-measurement-projects.js','src/adapters/trees/fetch-shared-measurement-projects.js'])vm.runInContext(read(p),ctx);
 return window;
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const ports=(rows,extra={})=>({scope:'member',fetchOwned:async()=>[],fetchShared:async()=>rows,merge:(a,b)=>[...a,...b],render(){},afterRender(){},...extra});
test('late successful and failed requests cannot replace newer directory results',async()=>{
 for(const fail of [false,true]){
  const w=setup(),pending=deferred(),entered=deferred(),renders=[];
  const old=w.DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY.load(ports([],{fetchShared:()=>{entered.resolve();return pending.promise;},render:rows=>renders.push(rows)}));
  await entered.promise;
  await w.DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY.load(ports([{id:33,shared:true}]));
  if(fail)pending.reject(Error('old offline'));else pending.resolve([]);
  assert.equal(await old,null);assert.deepEqual(renders,[]);
  assert.equal(w.DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.getState().projects[0].id,33);
  assert.equal(w.DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.getState().error,null);
 }
});
test('temporary failures retain known rows and surface the error; a later retry recovers',async()=>{
 const w=setup(),load=w.DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY.load;
 await load(ports([{id:30,is_locked:true}]));
 const notified=[];
 await assert.rejects(load(ports([],{fetchShared:async()=>{throw Error('session refreshing');},onError:e=>notified.push(e.message)})),/session refreshing/);
 assert.equal(w.DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.getState().projects[0].id,30);
 assert.deepEqual(notified,['session refreshing']);
 await load(ports([{id:33,is_locked:true}]));
 assert.equal(w.DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.getState().error,null);
 assert.equal(w.DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.getState().projects[0].is_locked,true);
});
test('an account switch rejects the old result and clears the previous account facade',async()=>{
 const w=setup(),pending=deferred();let active='a';
 const old=w.DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY.load(ports([],{scope:'a',isCurrent:()=>active==='a',fetchOwned:()=>pending.promise,render(){throw Error('stale render');}}));
 active='b';const seen=[];
 await w.DG_LOAD_MEASUREMENT_PROJECT_DIRECTORY.load(ports([{id:2}],{scope:'b',onState:s=>seen.push(s.projects.length)}));
 pending.resolve([{id:1}]);assert.equal(await old,null);assert.equal(seen[0],0);
 assert.equal(w.DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.getState().projects[0].id,2);
});
test('owned fallback and every failed sharing read reject instead of claiming an empty directory',async()=>{
 const w=setup(),error={message:'offline'};
 const broken={from(){return{select(){return this;},eq:async()=>({error})};}};
 await assert.rejects(w.DG_OWNED_MEASUREMENT_PROJECTS.fetch({client:broken,userId:'u',onRelationError(){}}),e=>e===error);
 const fixtures={v_my_parks:[{id:25,role:'collaborator'}],park_collaborators:[{park_id:25,added_at:'2026-11-01'}],park_invites:[{park_id:25,invited_by:'owner',responded_at:'2026-11-01'}],projects:[{id:30,park_id:25,owner:'owner',is_locked:true}]};
 for(const failing of ['v_my_parks','auth','park_collaborators','park_invites','projects']){
  const client={auth:{getUser:async()=>failing==='auth'?{error}:{data:{user:{id:'u',email:'member@example.test',email_confirmed_at:'2026-10-01'}}}},from(table){return{select(){return this;},eq(){return this;},in(){return this;},then(resolve){resolve(failing===table?{error}:{data:fixtures[table]});}};}};
  await assert.rejects(w.DG_SHARED_MEASUREMENT_PROJECTS.fetch({client,userId:'u',ownedProjects:[]}),e=>e===error);
 }
});
