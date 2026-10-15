import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/park-invites-actions.js',import.meta.url),'utf8');

test('park invitation controls keep their refresh and load callbacks',()=>{
 const listeners=new Map(),calls=[],window={};
 for(const name of ['dgCollabRefresh','dgCollabLoad','dgInviteSend','dgInviteRespond','dgInviteRevoke'])window[name]=function(...args){calls.push([name,this===window,args]);};
 const document={addEventListener:(name,handler)=>listeners.set(name,handler)};
 vm.runInContext(source,vm.createContext({window,document}));
 for(const [type,action] of [['change','refresh'],['click','load']]){
  const element={dataset:{dgParkInvitesAction:action}};
  listeners.get(type)({target:{closest:()=>element}});
 }
 for(const dataset of [
  {dgParkInvitesAction:'send'},
  {dgParkInvitesAction:'respond',inviteId:'i1',accept:'true'},
  {dgParkInvitesAction:'revoke',target:'u2',kind:'collab'}
 ]){
  const element={dataset};
  listeners.get('click')({target:{closest:()=>element}});
 }
 assert.deepEqual(calls.map(([name])=>name),['dgCollabRefresh','dgCollabLoad','dgInviteSend','dgInviteRespond','dgInviteRevoke']);
 assert.ok(calls.every(([,receiver])=>receiver));
 assert.deepEqual(calls[3][2],['i1',true]);assert.deepEqual(calls[4][2],['u2','collab']);
});

test('park invitation controls are declarative and offline-loaded',()=>{
 const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
 const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('../src/ui/park-collaboration-panel.js',import.meta.url),'utf8');
 const inbox=readFileSync(new URL('../src/ui/park-invite-inbox.js',import.meta.url),'utf8');
 const service=readFileSync(new URL('../src/services/park-invites.js',import.meta.url),'utf8');
 const view=shell.slice(shell.indexOf('dgInvPark'),shell.indexOf('id="v-export"'));
 assert.doesNotMatch(view,/\bon(?:click|change|input|submit)\s*=/i);
 assert.match(view,/data-dg-park-invites-action="refresh"/);
 assert.match(view,/data-dg-park-invites-action="load"/);
 assert.match(boot,/src\/ui\/park-invites-actions\.js/);
 assert.match(sw,/\/src\/ui\/park-invites-actions\.js/);
 for(const source of [renderer,inbox,service])assert.doesNotMatch(source,/\bonclick\s*=/i);
});
