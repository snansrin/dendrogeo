import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/map/select-waypoint-arrival-target.js',
  'src/ui/confirm-waypoint-arrival-distance.js',
  'src/adapters/map/mark-waypoint-visited.js',
  'src/application/map/complete-waypoint-arrival.js',
  'src/application/map/arrive-at-waypoint.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('arrival target keeps an active point and otherwise chooses the nearest pending point',()=>{
  const select=setup().DG_SELECT_WAYPOINT_ARRIVAL_TARGET.select,waypoints=[{id:1,wp_id:1,lat:2,lon:1},{id:2,wp_id:2,lat:0,lon:1},{id:3,wp_id:3,lat:1,lon:1,visited:true}],gps={latitude:1,longitude:1},distance=(_a,_b,lat)=>Math.abs(lat-1);
  assert.equal(select({target:waypoints[1],waypoints,gps,distance}),waypoints[1]);
  assert.equal(select({target:null,waypoints,gps,distance}),waypoints[0]);
  assert.equal(select({target:null,waypoints,gps:null,distance}),null);
  assert.equal(select({target:waypoints[2],waypoints,gps:null,distance}),waypoints[2]);
});

test('distance confirmation keeps the strict 50 m threshold and rounded translated prompt',()=>{
  const confirmDistance=setup().DG_CONFIRM_WAYPOINT_ARRIVAL_DISTANCE.confirm,calls=[],target={lat:0,lon:0},gps={latitude:0,longitude:0};
  const port={target,gps,distance:()=>50,confirm:message=>{calls.push(message);return false;},format:(text,values)=>text.replace('{d}',values.d)};
  assert.equal(confirmDistance(port),true);assert.equal(calls.length,0);
  assert.equal(confirmDistance({...port,distance:()=>50.01}),false);assert.deepEqual(calls, ["Hedeften 50 m uzaktasın.\nYine de 'vardım' işaretlensin mi?"]);
  assert.equal(confirmDistance({...port,gps:null}),true);
});

test('visited adapter preserves the exact Supabase update filter and response',async()=>{
  const mark=setup().DG_MARK_WAYPOINT_VISITED.mark,events=[],response={error:{message:'denied'}};
  const client={from:table=>({update:values=>{events.push(['update',table,values]);return{eq:async(...args)=>{events.push(['eq',...args]);return response;}};}})};
  assert.equal(await mark({client,id:17}),response);assert.deepEqual(JSON.parse(JSON.stringify(events)),[['update','waypoints',{visited:true}],['eq','id',17]]);
});

test('successful completion preserves local state and navigation side-effect order',()=>{
  const complete=setup().DG_COMPLETE_WAYPOINT_ARRIVAL.complete,events=[],waypoint={id:3,wp_id:8,project_id:12,visited:false};
  complete({waypoint,isManual:()=>false,setPoint:value=>events.push(['point',value]),setTarget:value=>events.push(['target',value]),draw:()=>events.push('draw'),refresh:()=>events.push('refresh'),hasProjectField:()=>true,setProject:value=>events.push(['project',value]),notify:(...args)=>events.push(['notify',...args]),format:(text,values)=>text.replace('{id}',values.id),go:(...args)=>events.push(['go',...args])});
  assert.equal(waypoint.visited,true);assert.deepEqual(JSON.parse(JSON.stringify(events)),[['target',null],['point',8],'draw','refresh',['project','12'],['notify','✓ Vardın: P8 → ölçüme geç','ok','🎯'],['go','measure']]);
});

test('arrival use case exits safely for no target, cancellation and write failure, then completes once',async()=>{
  const arrive=setup().DG_ARRIVE_AT_WAYPOINT.arrive,events=[],waypoint={id:1};
  const base={target:null,waypoints:[],gps:null,distance(){},selectTarget:()=>waypoint,confirmDistance:()=>true,persist:async id=>{events.push(['persist',id]);return{error:null};},complete:value=>events.push(['complete',value]),notify:(...args)=>events.push(['notify',...args])};
  await arrive({...base,selectTarget:()=>null});assert.deepEqual(JSON.parse(JSON.stringify(events)),[['notify','Aktif waypoint yok','warn','🎯']]);events.length=0;
  await arrive({...base,confirmDistance:()=>false});assert.deepEqual(events,[]);
  await arrive({...base,persist:async id=>{events.push(['persist',id]);return{error:{message:'RLS'}};}});assert.deepEqual(JSON.parse(JSON.stringify(events)),[['persist',1],['notify','Hata: RLS','err','🎯']]);events.length=0;
  await arrive(base);assert.deepEqual(JSON.parse(JSON.stringify(events)),[['persist',1],['complete',{id:1}]]);
});

test('arrival modules load before the locked map service and are cached offline',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=read('src/services/map.js');
  for(const path of modules){assert.ok(head.includes(`src="${path}?v=`));assert.ok(sw.includes(`'/${path}'`));assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/services/map.js?'));}
  assert.match(service,/DG_ARRIVE_AT_WAYPOINT/);assert.match(service,/DG_MARK_WAYPOINT_VISITED\.mark\(\{client:sb,id:w\.id\}\)/);
});
