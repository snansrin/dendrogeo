import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/application/park-invites/load-owned-parks.js',
 'src/application/park-invites/load-recipient-invites.js',
 'src/ui/load-owner-collaborations.js',
 'src/ui/refresh-collaborations.js',
 'src/ui/owner-park-options.js'
];
function load(){
 const window={},context=vm.createContext({window,Promise,Number,String,Object,Array});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
 return window;
}

test('owned-park loader reuses cached data and marks only missing-schema errors',async()=>{
 const api=load(),state={mine:[{id:1}]};let loads=0,warnings=0;
 assert.equal(await api.DG_LOAD_OWNED_INVITE_PARKS.execute(state,false,{hasClient:()=>true,load:async()=>{loads++;return{data:[],error:null};},onMissingSchema:()=>warnings++}),state.mine);
 await api.DG_LOAD_OWNED_INVITE_PARKS.execute(state,true,{hasClient:()=>true,load:async()=>{loads++;return{data:null,error:{message:'relation v_my_parks does not exist'}};},onMissingSchema:()=>warnings++});
 assert.equal(loads,1);assert.equal(warnings,1);assert.deepEqual(state.mine,[{id:1}]);
});

test('recipient inbox filters case-insensitively and treats unavailable tables as empty',async()=>{
 const api=load();
 const rows=await api.DG_LOAD_RECIPIENT_PARK_INVITES.execute('ada@example.test',async()=>({data:[{email:'Ada@example.test'},{email:'other@example.test'}],error:null}));
 assert.equal(rows.length,1);assert.equal(rows[0].email,'Ada@example.test');
 assert.equal((await api.DG_LOAD_RECIPIENT_PARK_INVITES.execute('a@example.test',async()=>({data:null,error:new Error('missing')}))).length,0);
});

test('owner park selector hides guests and preserves a still-valid escaped selection',async()=>{
 const api=load(),events=[],select={value:'6',innerHTML:''};
 await api.DG_LOAD_OWNER_PARK_COLLABORATIONS.execute({
  getSelect:()=>select,isAuthenticated:()=>true,hideCard:()=>events.push('hide'),showCard:()=>events.push('show'),
  loadParks:async force=>{assert.equal(force,true);return[{id:5,role:'owner',name:'<Park>'},{id:6,role:'owner',name:'Second',city:'<City>'},{id:9,role:'collaborator'}];},
  owned:rows=>rows.filter(x=>x.role==='owner'),shared:rows=>rows.filter(x=>x.role==='collaborator'),
  updateOwnedCount:n=>events.push(['owned',n]),updateSharedCount:n=>events.push(['shared',n]),
  clearCollaborations:()=>events.push('clear'),render:()=>events.push('render'),
  renderOptions:(parks,selected)=>api.DG_OWNER_PARK_OPTIONS_UI.render(parks,selected,v=>String(v).replaceAll('<','&lt;').replaceAll('>','&gt;')),
  refresh:()=>events.push('refresh')
 });
 assert.match(select.innerHTML,/&lt;Park&gt;/);assert.match(select.innerHTML,/&lt;City&gt;/);
 assert.equal(select.value,'6');assert.ok(!select.innerHTML.includes('value="9"'));assert.deepEqual(events,[['owned',2],['shared',1],'show','refresh']);
});

test('collaboration park selection clears state when no owner parks remain',async()=>{
 const api=load(),events=[],select={value:'',innerHTML:''};
 await api.DG_LOAD_OWNER_PARK_COLLABORATIONS.execute({getSelect:()=>select,isAuthenticated:()=>true,hideCard:()=>events.push('hide'),showCard:()=>events.push('show'),loadParks:async()=>[],owned:()=>[],shared:()=>[],updateOwnedCount:n=>events.push(['owned',n]),updateSharedCount:n=>events.push(['shared',n]),clearCollaborations:()=>events.push('clear'),render:()=>events.push('render'),renderOptions:()=>({html:'',selected:null}),refresh:()=>events.push('refresh')});
 assert.match(select.innerHTML,/Sahibi olduğun proje yok/);assert.deepEqual(events,[['owned',0],['shared',0],'hide','clear','render']);
});

test('collaboration refresh refuses non-owned parks and applies store results for owned parks',async()=>{
 const api=load(),state={invites:['old'],collabs:['old']},select={value:'6'},events=[];
 await api.DG_REFRESH_PARK_COLLABORATIONS.execute(state,{getSelect:()=>select,canManage:id=>id===5,load:async()=>{events.push('load');return[];},onMissingSchema:()=>events.push('schema'),render:()=>events.push('render')});
 assert.equal(select.value,'');assert.equal(JSON.stringify(state),'{"invites":[],"collabs":[]}');assert.deepEqual(events,['render']);
 select.value='5';
 await api.DG_REFRESH_PARK_COLLABORATIONS.execute(state,{getSelect:()=>select,canManage:id=>id===5,load:async()=>[{data:[{id:'i'}],error:null},{data:[{user_id:'u'}],error:null}],onMissingSchema:()=>events.push('schema'),render:()=>events.push('render')});
 assert.deepEqual(state,{invites:[{id:'i'}],collabs:[{user_id:'u'}]});assert.deepEqual(events,['render','render']);
});

test('park invite service delegates inbox and owner collaboration flows to the loaded modules',async()=>{
 const elements=new Map(),element=id=>{
  if(!elements.has(id))elements.set(id,{id,value:'',innerHTML:'',textContent:'',style:{},options:[]});
  return elements.get(id);
 };
 const select=element('dgInvPark');let selectHtml='';
 Object.defineProperty(select,'innerHTML',{get:()=>selectHtml,set:value=>{selectHtml=String(value);const first=/<option value="([^"]*)"/.exec(selectHtml);if(!selectHtml.includes(`value="${select.value}"`))select.value=first?first[1]:'';}});
 const context=vm.createContext({console,Promise,Number,String,Object,Array,Date,USER:{id:'u1',email:'ada@example.test'},PROFILE:{email:'ada@example.test'},$:element,esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),toast(){},dgCf:value=>value,sb:{from(table){const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},then(resolve){const data=table==='v_my_parks'?[{id:5,role:'owner',name:'<Owned Park>',city:'Ankara'}]:table==='park_collaborators'?[{user_id:'u2',added_at:'2026-10-12',profiles:{full_name:'Ada'}}]:[{id:'i1',email:'ada@example.test',park_id:5,status:'Beklemede',created_at:'2026-10-12',parks:{name:'Owned Park',city:'Ankara'}}];return Promise.resolve({data,error:null}).then(resolve);}};return q;},rpc:async()=>({data:null,error:null})}});
 context.window=context;
 const serviceFiles=[
  'src/domain/park-invites/access-policy.js','src/adapters/park-invites/store.js',
  'src/ui/park-invite-inbox.js','src/ui/park-collaboration-panel.js','src/application/park-invites/manage-invites.js',
  'src/application/park-invites/load-owned-parks.js','src/application/park-invites/load-recipient-invites.js',
  'src/ui/load-owner-collaborations.js','src/ui/refresh-collaborations.js',
  'src/ui/owner-park-options.js','src/services/park-invites.js'
 ];
 for(const file of serviceFiles)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
 await vm.runInContext('dgInvitesLoadMine()',context);
 assert.equal(element('projInviteCount').textContent,'1');assert.match(element('dgInvBox').innerHTML,/dgInviteRespond\('i1',true\)/);
 await vm.runInContext('dgCollabLoad()',context);
 assert.match(select.innerHTML,/&lt;Owned Park&gt;/);assert.match(element('dgInvList').innerHTML,/dgInviteRevoke\('u2','collab'\)/);
});
