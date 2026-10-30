import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/application/admin/load-admin-tree.js',
 'src/application/admin/update-admin-tree-filter.js',
 'src/application/admin/set-admin-tree-node-open.js',
 'src/ui/navigate-admin-tree-pending-scan.js',
 'src/ui/delete-admin-tree-project.js'
];
function load(){
 const window={},context=vm.createContext({window,Promise,Number,Set,Array,Object,String});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 return window;
}

test('tree load skips unauthorized users and retains the existing tree while refreshing',async()=>{
 const api=load().DG_LOAD_ADMIN_TREE,events=[],box={innerHTML:'existing',querySelector:()=>({})};
 await api.execute({authorized:()=>false,getBox(){throw Error('must not read DOM');}});
 const result={rows:[{id:1}],error:'embed fallback',mode:'join'};
 const rows=[],errors=[];
 const returned=await api.execute({authorized:()=>true,getBox:()=>box,hasTree:()=>true,showLoading:()=>events.push('loading'),keepScroll:()=>17,
  restoreScroll:value=>events.push(['restore',value]),fetch:async()=>result,setRows:value=>rows.push(value),setError:value=>errors.push(value),
  queryError:String,warnFallback:error=>events.push(['warn',error]),draw:()=>events.push('draw'),renderError:String,showRenderError(){}});
 assert.equal(returned,result);assert.equal(box.innerHTML,'existing');assert.deepEqual(rows,[result.rows]);assert.deepEqual(errors,[null]);
 assert.deepEqual(events,[['warn','embed fallback'],'draw',['restore',17]]);
});

test('tree load exposes thrown query and drawing failures and restores scroll',async()=>{
 const api=load().DG_LOAD_ADMIN_TREE,events=[],errors=[],rows=[];
 await api.execute({authorized:()=>true,getBox:()=>({}),hasTree:()=>false,showLoading:()=>events.push('loading'),keepScroll:()=>9,
  restoreScroll:value=>events.push(['restore',value]),fetch:async()=>{throw Error('offline');},setRows:value=>rows.push(value),
  setError:value=>errors.push(value),queryError:error=>'query: '+error.message,draw:()=>events.push('draw'),renderError:String,showRenderError(){}});
 assert.equal(JSON.stringify(rows),JSON.stringify([[]]));assert.equal(errors[0],'query: offline');assert.deepEqual(events,['loading','draw',['restore',9]]);
 const box={innerHTML:''};
 await api.execute({authorized:()=>true,getBox:()=>box,hasTree:()=>true,showLoading(){},keepScroll:()=>3,restoreScroll:value=>events.push(['restore-render',value]),
  fetch:async()=>({rows:[],error:null,mode:'embed'}),setRows(){},setError:value=>errors.push(value),draw:()=>{throw Error('view');},
  renderError:error=>'render: '+error.message,showRenderError:(target,message)=>{target.innerHTML=message;}});
 assert.equal(box.innerHTML,'render: view');assert.equal(errors.at(-1),'render: view');assert.deepEqual(events.at(-1),['restore-render',3]);
});

test('tree filters update their service state and redraw once per action',()=>{
 const api=load().DG_UPDATE_ADMIN_TREE_FILTER,events=[],state={status:'',query:''};
 const ports={setStatus:value=>{state.status=value;},setQuery:value=>{state.query=value;},updateStatusControl:value=>events.push(['select',value]),draw:()=>events.push('draw')};
 api.setStatus(state,'Red',ports);api.setQuery(state,'çam',ports);api.onlyPending(state,ports);
 assert.deepEqual(state,{status:'Beklemede',query:'çam'});assert.deepEqual(events,[['select','Red'],'draw','draw',['select','Beklemede'],'draw']);
});

test('tree node state and pending scan preserve event and navigation behavior',()=>{
 const window=load(),keys=new Set(),events=[];
 assert.equal(window.DG_SET_ADMIN_TREE_NODE_OPEN.set(keys,'park-1',true),true);
 assert.equal(window.DG_SET_ADMIN_TREE_NODE_OPEN.set(keys,'park-1',false),false);
 const event={preventDefault:()=>events.push('prevent'),stopPropagation:()=>events.push('stop')};
 window.DG_NAVIGATE_ADMIN_TREE_PENDING_SCAN.navigate(event,options=>events.push(options));
 assert.equal(JSON.stringify(events),JSON.stringify(['prevent','stop',{returnTo:'admin'}]));
});

test('project deletion confirms, handles server errors, and refreshes only after success',async()=>{
 const api=load().DG_DELETE_ADMIN_TREE_PROJECT,events=[];
 const ports={confirmation:'confirm',confirm:value=>{events.push(['confirm',value]);return true;},deleteProject:id=>{events.push(['delete',id]);return Promise.resolve({error:null});},
  markLiveDirty:()=>events.push('dirty'),success:()=>events.push('success'),failure:error=>events.push(['failure',error.message]),redraw:()=>events.push('draw'),refresh:()=>events.push('refresh')};
 const event={preventDefault:()=>events.push('prevent'),stopPropagation:()=>events.push('stop')};
 assert.equal((await api.execute(event,4,ports)).status,'deleted');
 assert.deepEqual(events,['prevent','stop',['confirm','confirm'],['delete',4],'dirty','success','draw','refresh']);
 const denied=await api.execute(null,5,{...ports,deleteProject:async()=>({error:Error('RLS')}),failure:error=>events.push(['failure',error.message])});
 assert.equal(denied.status,'failed');assert.equal(events.at(-1)[0],'failure');
 const before=events.length;
 assert.equal((await api.execute(null,6,{...ports,confirm:()=>false})).status,'cancelled');assert.equal(events.length,before);
});

test('admin project deletion cannot race ahead of typed confirmation',async()=>{
  const api=load().DG_DELETE_ADMIN_TREE_PROJECT,events=[];let decide;
  const result=api.execute(null,23,{confirmation:'project 23',confirm:()=>new Promise(resolve=>{decide=resolve;}),deleteProject:async()=>{events.push('delete');return{error:null};},markLiveDirty(){},success(){},failure(){}});
  assert.deepEqual(events,[]);decide(false);
  assert.equal((await result).status,'cancelled');assert.deepEqual(events,[]);
});

test('admin tree service delegates the extracted controller workflows',()=>{
 const source=readFileSync(new URL('../src/services/admin-tree.js',import.meta.url),'utf8');
 for(const api of ['DG_LOAD_ADMIN_TREE','DG_UPDATE_ADMIN_TREE_FILTER','DG_SET_ADMIN_TREE_NODE_OPEN','DG_NAVIGATE_ADMIN_TREE_PENDING_SCAN','DG_DELETE_ADMIN_TREE_PROJECT'])assert.ok(source.includes('window.'+api));
 for(const entry of ['function loadAdminTree','function dgTreeSetStatus','function dgTreeSetQuery','function dgTreeToggle','function dgTreePendingScan','function dgTreeDeleteProject'])assert.ok(source.includes(entry));
});
