import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fixture(){
 const node=id=>({id,dataset:{dgView:id},style:{},hidden:false,scrollTop:500,classList:{active:false,toggle(_name,on){this.active=on;}}});
 const nodes=Object.fromEntries(['dgStartupScreen','main','landing','shell','v-dash','v-measure','v-map'].map(id=>[id,node(id)]));
 const items=[node('dash'),node('map')],saved=new Map([['dg_last_view','map'],['dg_scroll_dash','800'],['dg_scrollw_dash','1200'],['park-draft','keep']]);
 const window={history:{},scrollTo:options=>{window.scroll=options;}};
 const document={getElementById:id=>nodes[id],querySelectorAll:selector=>selector==='.view'?[nodes['v-dash'],nodes['v-measure'],nodes['v-map']]:items};
 const context=vm.createContext({window,document,localStorage:{getItem:key=>saved.get(key)||null,removeItem:key=>saved.delete(key),setItem:(key,value)=>saved.set(key,value)},console});
 vm.runInContext(read('src/ui/startup-screen.js'),context);
 return{window,context,nodes,items,saved};
}
test('startup restores the saved map and leaves saved scroll and park drafts intact',()=>{
 const f=fixture();let view;
 f.window.DG_STARTUP_SCREEN.dashboard({view:'map',setView:value=>{view=value;}});
 assert.equal(view,'map');assert.equal(f.saved.get('dg_last_view'),'map');
 assert.equal(f.nodes['v-dash'].classList.active,false);assert.equal(f.nodes['v-map'].classList.active,true);
 assert.equal(f.nodes.main.scrollTop,500);assert.equal(f.window.scroll,undefined);
 assert.equal(f.saved.get('dg_scroll_dash'),'800');assert.equal(f.saved.get('dg_scrollw_dash'),'1200');assert.equal(f.saved.get('park-draft'),'keep');
 assert.equal(f.nodes.dgStartupScreen.hidden,true);
});
test('shell restores the saved map before loading finishes and activates it through normal navigation',async()=>{
 const f=fixture(),events=[];let release;
 const pending=new Promise(resolve=>{release=resolve;});
 Object.assign(f.context,{$:id=>f.nodes[id],PROFILE:null,dgApplyShellProfile(){},initMaps:()=>events.push('maps'),setTimeout:()=>0,loadProjects:()=>pending,loadWaypoints(){},loadDash(){},loadRecords(){},loadWorld(){},loadMyRequests(){},loadRequestOptions(){},autoFillPointId(){},go:view=>{events.push('go:'+view);if(['map','nav','world'].includes(view))f.context.initMaps();}});
 Object.assign(f.window,{_dgScrollHooked:true,_dgScrollWinHooked:true});
 vm.runInContext(read('src/application/dashboard/load-shell-view-data.js'),f.context);
 const shell=read('src/ui/shell.js');
 vm.runInContext(shell.slice(shell.indexOf('async function startShell(){'),shell.indexOf('function go(v){')),f.context);
 const starting=vm.runInContext('startShell()',f.context);
 assert.equal(f.nodes.shell.style.display,'block');assert.equal(vm.runInContext('DG_CUR_VIEW',f.context),'map');assert.equal(f.nodes['v-map'].classList.active,true);assert.deepEqual(events,[]);
 release();await starting;assert.deepEqual(events,['go:map','maps']);
});
