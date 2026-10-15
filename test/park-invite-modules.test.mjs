import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/domain/park-invites/access-policy.js',
 'src/adapters/park-invites/store.js',
 'src/application/park-invites/park-invite-state.js',
 'src/application/park-invites/load-owned-parks.js',
 'src/application/park-invites/load-recipient-invites.js',
 'src/ui/park-invite-inbox.js',
 'src/ui/park-collaboration-panel.js',
 'src/ui/owner-park-options.js',
 'src/ui/load-owner-collaborations.js',
 'src/ui/refresh-collaborations.js',
 'src/application/park-invites/manage-invites.js'
];
function load(extra={}){
 const window={...extra};
 const context=vm.createContext({window,Date,String,Number,Object,Promise});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 return{window,context};
}

test('park invite policy separates owner/shared parks and gates management by owned ID',()=>{
 const{window}=load(),rows=[{id:5,role:'owner'},{id:6,role:'collaborator'},{id:7,role:'admin'}];
 assert.deepEqual(Array.from(window.DG_PARK_INVITE_ACCESS.owned(rows),park=>park.id),[5]);
 assert.deepEqual(Array.from(window.DG_PARK_INVITE_ACCESS.shared(rows),park=>park.id),[6]);
 assert.equal(window.DG_PARK_INVITE_ACCESS.canManage('5',rows),true);
 assert.equal(window.DG_PARK_INVITE_ACCESS.canManage(6,rows),false);
});

test('park invite store preserves view, inbox, collaboration and RPC request contracts',async()=>{
 const calls=[],q={select(value){calls.push(['select',value]);return this;},eq(key,value){calls.push(['eq',key,value]);return this;},order(key,value){calls.push(['order',key,value]);return this;},limit(value){calls.push(['limit',value]);return this;},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}};
 const client={from(table){calls.push(['from',table]);return q;},rpc(name,args){calls.push(['rpc',name,args]);return Promise.resolve({data:null,error:null});}};
 const{window}=load(),store=window.DG_PARK_INVITE_STORE.create(()=>client);
 await store.myParks();await store.inbox();await store.collaborations(25);await store.respond('invite-1',true);await store.send(25,'a@example.test',null);await store.revoke(25,'invite-1','invite');
 assert.deepEqual(calls.filter(call=>call[0]==='from').map(call=>call[1]),['v_my_parks','park_invites','park_invites','park_collaborators']);
 assert.deepEqual(JSON.parse(JSON.stringify(calls.filter(call=>call[0]==='rpc').map(call=>call.slice(1)))),[
  ['dg_invite_respond',{p_invite:'invite-1',p_accept:true}],
  ['dg_invite_send',{p_park:25,p_email:'a@example.test',p_note:null}],
  ['dg_invite_revoke',{p_park:25,p_target:'invite-1',p_kind:'invite'}]
 ]);
 assert.ok(calls.some(call=>call[0]==='order'&&call[1]==='created_at'&&call[2].ascending===false));
 assert.equal(calls.filter(call=>call[0]==='limit').length,2);
});

test('park invite views escape untrusted labels and preserve existing inbox and owner-panel actions',()=>{
 const{window}=load(),escape=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const banner=window.DG_PARK_INVITE_INBOX_UI.sharedBanner([{name:'<Park>',city:'<City>'}],escape);
 const inbox=window.DG_PARK_INVITE_INBOX_UI.invites([{id:'i1',park_id:5,created_at:'2026-10-12',parks:{name:'<Park>',city:'<City>'},note:'<note>'}],escape);
 assert.match(banner,/&lt;Park&gt;/);assert.match(banner,/&lt;City&gt;/);
 assert.match(inbox,/&lt;note&gt;/);assert.match(inbox,/data-dg-park-invites-action="respond" data-invite-id="i1" data-accept="true"/);
 const panel=window.DG_PARK_COLLABORATION_PANEL_UI.render({selected:true,canManage:true,escape,invites:[{id:'i1',email:'<mail>',status:'Beklemede',note:'<note>',created_at:'2026-10-12'}],collabs:[{user_id:'u1',added_at:'2026-10-12',profiles:{full_name:'<Ada>',email:'a@example.test'}}]});
 assert.match(panel,/&lt;mail&gt;/);assert.match(panel,/&lt;Ada&gt;/);assert.match(panel,/data-dg-park-invites-action="revoke" data-target="u1" data-kind="collab"/);assert.match(panel,/data-dg-park-invites-action="revoke" data-target="i1" data-kind="invite"/);
 assert.match(window.DG_PARK_COLLABORATION_PANEL_UI.render({selected:true,canManage:false,invites:[],collabs:[],escape}),/proje sahibine özeldir/);
});

test('park invite application preserves response, send, revoke and error callback order',async()=>{
 const{window}=load(),events=[],store={
  respond:async(id,accept)=>{events.push(['respond',id,accept]);return{error:null};},
  send:async(...args)=>{events.push(['send',...args]);return{data:{id:'i2'},error:null};},
  revoke:async(...args)=>{events.push(['revoke',...args]);return{error:null};}
 },ports={authenticated:()=>true,store,onSuccess:(...args)=>events.push(['success',...args]),onAccepted:()=>events.push('accepted'),onComplete:()=>events.push('complete'),onFailure:error=>events.push(['failure',error.message])};
 await window.DG_MANAGE_PARK_INVITES.respond('i1',true,ports);
 await window.DG_MANAGE_PARK_INVITES.send({parkId:25,email:'a@example.test',note:'field'},ports);
 await window.DG_MANAGE_PARK_INVITES.revoke({parkId:25,target:'u1',kind:'collab'},ports);
 assert.deepEqual(events,[['respond','i1',true],['success',true],'accepted','complete',['send',25,'a@example.test','field'],['success',{id:'i2'}],['revoke',25,'u1','collab'],['success','collab'],'complete']);
 const failed=[];await window.DG_MANAGE_PARK_INVITES.send({}, {...ports,store:{send:async()=>({error:new Error('denied')})},onFailure:error=>failed.push(error.message)});assert.deepEqual(failed,['denied']);
});

test('park invite service uses the extracted policy and collaboration view when modules are loaded',()=>{
 const{context,window}=load(),elements=new Map([['dgInvPark',{value:'5'}],['dgInvList',{innerHTML:''}],['dgInvBox',{innerHTML:'',style:{}}],['dgSharedBox',{innerHTML:'',style:{}}],['projInviteCount',{textContent:''}],['projSharedCount',{textContent:''}]]);
 Object.assign(context,{$:id=>elements.get(id)||null,esc:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;')});
 context.USER={id:'u1',email:'guest@example.test'};context.PROFILE={email:'guest@example.test'};
 context.sb={from(table){const q={select(){return q;},eq(){return q;},then(resolve){const data=table==='v_my_parks'?[{id:6,name:'Shared Park',city:'Ankara',role:'collaborator'}]:[{id:'invite',email:'guest@example.test',park_id:6,created_at:'2026-10-12',parks:{name:'Shared Park',city:'Ankara'}}];return Promise.resolve({data,error:null}).then(resolve);}};return q;}};
 vm.runInContext(readFileSync(new URL('../src/services/park-invites.js',import.meta.url),'utf8'),context);
 return vm.runInContext('dgInvitesLoadMine()',context).then(()=>{
  assert.equal(elements.get('projInviteCount').textContent,'1');assert.equal(elements.get('projSharedCount').textContent,'1');
  assert.equal((elements.get('dgSharedBox').innerHTML.match(/Ortak çalışma erişimin var/g)||[]).length,1);
  assert.equal((elements.get('dgInvBox').innerHTML.match(/Sana gelen davetler/g)||[]).length,1);
  vm.runInContext(`DG_INV.mine=[{id:5,role:'owner'},{id:6,role:'collaborator'}];DG_INV.invites=[{id:'i1',email:'<guest>',status:'Beklemede',created_at:'2026-10-12'}];DG_INV.collabs=[{user_id:'u1',added_at:'2026-10-12',profiles:{full_name:'Ada'}}];`,context);
  assert.equal(vm.runInContext('dgCanManagePark(5)',context),true);assert.equal(vm.runInContext('dgCanManagePark(6)',context),false);vm.runInContext('dgCollabRender()',context);
  assert.match(elements.get('dgInvList').innerHTML,/&lt;guest&gt;/);assert.match(elements.get('dgInvList').innerHTML,/data-dg-park-invites-action="revoke" data-target="u1" data-kind="collab"/);
  assert.equal(vm.runInContext('!!DG_PARK_INVITE_MODULE_STORE',context),true);
 });
});
