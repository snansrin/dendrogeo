import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/map/select-restored-waypoint-target.js',
  'src/adapters/map/fetch-project-waypoints.js',
  'src/application/map/reset-waypoint-load-state.js',
  'src/ui/show-waypoint-load-error.js',
  'src/application/map/load-project-waypoints.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('restored target selection requires the same ID and an unvisited row',()=>{
  const select=setup().DG_SELECT_RESTORED_WAYPOINT_TARGET.select,rows=[{id:1,visited:false},{id:2,visited:true}];
  assert.equal(select(rows,{id:1}),rows[0]);assert.equal(select(rows,{id:2}),null);assert.equal(select(rows,{id:3}),null);assert.equal(select([],null),null);
});

test('project waypoint adapter preserves query, project filter, order, and response identity',async()=>{
  const fetch=setup().DG_FETCH_PROJECT_WAYPOINTS.fetch,events=[],response={data:[{wp_id:2}],error:null};
  const client={from:table=>({select:columns=>{events.push(['select',table,columns]);return{eq:(...args)=>{events.push(['eq',...args]);return{order:async(...orderArgs)=>{events.push(['order',...orderArgs]);return response;}};}};}})};
  assert.equal(await fetch({client,projectId:7}),response);
  assert.deepEqual(JSON.parse(JSON.stringify(events)),[['select','waypoints','*'],['eq','project_id',7],['order','wp_id',{ascending:true}]]);
});

test('reset clears the old list and performs the legacy second render without a project',()=>{
  const reset=setup().DG_RESET_WAYPOINT_LOAD_STATE.reset,events=[];
  reset({clear:()=>events.push('clear-and-draw'),hasProject:false,renderEmpty:()=>events.push('render-empty')});
  assert.deepEqual(events,['clear-and-draw','render-empty']);
  events.length=0;reset({clear:()=>events.push('clear-and-draw'),hasProject:true,renderEmpty:()=>events.push('render-empty')});assert.deepEqual(events,['clear-and-draw']);
});

test('waypoint load error preserves translated message and error toast type',()=>{
  const show=setup().DG_SHOW_WAYPOINT_LOAD_ERROR.show,events=[];
  show({error:new Error('offline'),notify:(...args)=>events.push(args),translate:value=>`EN:${value}`});
  assert.deepEqual(events,[['EN:Waypoint listesi alınamadı: offline','err']]);
});

test('project load resets first, commits only for the current project and restores its pending target',async()=>{
  const load=setup().DG_LOAD_PROJECT_WAYPOINTS.load,events=[],rows=[{id:8,wp_id:4,visited:false}];let current=3,stored=[],target=null;
  await load({projectId:3,getProjectId:()=>current,previousTarget:{id:8},reset:()=>events.push('reset'),readProject:async pid=>{events.push(['fetch',pid]);return{data:rows,error:null};},selectTarget:(data,previous)=>data.find(row=>row.id===previous.id),setWaypoints:value=>{stored=value;events.push('state');},setTarget:value=>{target=value;events.push('target');},draw:()=>events.push('draw'),showError:error=>events.push(['error',error.message])});
  assert.equal(stored,rows);assert.equal(target,rows[0]);assert.deepEqual(JSON.parse(JSON.stringify(events)),['reset',['fetch',3],'state','target','draw']);
  events.length=0;current=4;
  await load({projectId:3,getProjectId:()=>current,previousTarget:null,reset:()=>events.push('reset'),readProject:async()=>({data:rows,error:new Error('stale failure')}),selectTarget(){},setWaypoints(){events.push('state');},setTarget(){},draw(){},showError:error=>events.push(['error',error.message])});
  assert.deepEqual(events,['reset']);
});

test('current-project query errors are shown, empty project does not query, and loader is wired before the service',async()=>{
  const window=setup(),events=[],load=window.DG_LOAD_PROJECT_WAYPOINTS.load;
  await load({projectId:5,getProjectId:()=>5,previousTarget:null,reset:()=>events.push('reset'),readProject:async()=>({data:null,error:{message:'denied'}}),selectTarget(){},setWaypoints(){},setTarget(){},draw(){},showError:error=>events.push(['error',error.message])});
  assert.deepEqual(events,['reset',['error','denied']]);events.length=0;
  await load({projectId:0,getProjectId:()=>0,previousTarget:null,reset:()=>events.push('reset'),readProject:async()=>{events.push('fetch');},selectTarget(){},setWaypoints(){},setTarget(){},draw(){},showError(){}});
  assert.deepEqual(events,['reset']);
  const head=read('partials/head.html'),sw=read('sw.js'),service=read('src/services/map.js');
  for(const path of modules){assert.ok(head.includes(`src="${path}?v=`));assert.ok(sw.includes(`'/${path}'`));assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/services/map.js?'));}
  assert.match(service,/DG_LOAD_PROJECT_WAYPOINTS/);assert.match(service,/DG_FETCH_PROJECT_WAYPOINTS/);
});
