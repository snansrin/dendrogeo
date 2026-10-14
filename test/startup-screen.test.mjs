import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fixture(){
 const node=id=>({id,style:{},hidden:false,scrollTop:500,classList:{active:false,toggle(_name,on){this.active=on;}}});
 const nodes=Object.fromEntries(['dgStartupScreen','main','landing','shell','v-dash','v-measure','v-map'].map(id=>[id,node(id)]));
 const items=[node('dash'),node('map')],saved=new Map([['dg_last_view','map'],['dg_scroll_dash','800'],['dg_scrollw_dash','1200'],['park-draft','keep']]);
 const window={history:{},scrollTo:options=>{window.scroll=options;}};
 const document={getElementById:id=>nodes[id],querySelectorAll:selector=>selector==='.view'?[nodes['v-dash'],nodes['v-measure'],nodes['v-map']]:items};
 const context=vm.createContext({window,document,localStorage:{removeItem:key=>saved.delete(key),setItem:(key,value)=>saved.set(key,value)},console});
 vm.runInContext(read('src/ui/startup-screen.js'),context);
 return{window,context,nodes,items,saved};
}
test('fresh dashboard ignores the saved map and scroll without deleting park drafts',()=>{
 const f=fixture();let view;
 f.window.DG_STARTUP_SCREEN.dashboard({setView:value=>{view=value;},saveView:value=>f.saved.set('dg_last_view',value)});
 assert.equal(view,'dash');assert.equal(f.saved.get('dg_last_view'),'dash');
 assert.equal(f.nodes['v-dash'].classList.active,true);assert.equal(f.nodes['v-map'].classList.active,false);
 assert.equal(f.nodes.main.scrollTop,0);assert.equal(f.window.scroll.top,0);
 assert.equal(f.saved.has('dg_scroll_dash'),false);assert.equal(f.saved.get('park-draft'),'keep');
 assert.equal(f.nodes.dgStartupScreen.hidden,true);
});
test('shell shows the dashboard before slow project loading and never initializes hidden maps',async()=>{
 const f=fixture(),events=[];let release;
 const pending=new Promise(resolve=>{release=resolve;});
 Object.assign(f.context,{$:id=>f.nodes[id],DG_CUR_VIEW:'map',PROFILE:null,dgApplyShellProfile(){},dgSaveView:v=>f.saved.set('dg_last_view',v),initMaps:()=>events.push('maps'),setTimeout:()=>0,loadProjects:()=>pending,loadWaypoints(){},loadDash(){},loadRecords(){},loadWorld(){},loadMyRequests(){},loadRequestOptions(){},autoFillPointId(){},go:()=>events.push('resume')});
 Object.assign(f.window,{_dgScrollHooked:true,_dgScrollWinHooked:true});
 vm.runInContext(read('src/application/dashboard/load-shell-view-data.js'),f.context);
 const shell=read('src/ui/shell.js');
 vm.runInContext(shell.slice(shell.indexOf('async function startShell(){'),shell.indexOf('let DG_CUR_VIEW=')),f.context);
 const starting=vm.runInContext('startShell()',f.context);
 assert.equal(f.nodes.shell.style.display,'block');assert.equal(f.context.DG_CUR_VIEW,'dash');assert.deepEqual(events,[]);
 release();await starting;assert.deepEqual(events,[]);
});
