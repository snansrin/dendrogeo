import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/waypoint-map-viewport.js',import.meta.url),'utf8');

function fixture(){
 const window={};
 vm.runInNewContext(source,{window});
 const viewport=window.DG_WAYPOINT_MAP_VIEWPORT;
 const calls=[];
 const map={
  invalidateSize:()=>calls.push(['invalidate']),
  fitBounds:(points,options)=>calls.push(['fit',Array.from(points),options]),
  setView:(point,zoom)=>calls.push(['set',Array.from(point),zoom])
 };
 const panel={open:false};
 const p=(parkId,projectId,readPark,extra={})=>viewport.autoProject({
  map,panel,projectId,parkId,waypoints:[],readPark,isSelected:id=>id===selected,...extra
 });
 let selected=7;
 return {viewport,calls,map,panel,p,select:id=>{selected=id;}};
}

test('selected project park polygon is framed when the collapsed map is opened',async()=>{
 const f=fixture();
 const readPark=async()=>({geom_json:{outer:[[39.98,32.65],[39.98,32.66],[39.99,32.66]]}});
 assert.equal(await f.p(25,7,readPark),false,'closed details should defer map operations');
 assert.equal(f.calls.length,0);
 f.panel.open=true;
 assert.equal(f.viewport.applyProject({map:f.map,panel:f.panel,projectId:7}),true);
 assert.equal(f.calls[1][0],'fit');
 assert.equal(f.calls[1][1].length,3);
 assert.equal(f.calls[1][2].maxZoom,17);
 assert.equal(f.viewport.applyProject({map:f.map,panel:f.panel,projectId:7}),false,'pending frame is consumed once');
});

test('switch from Göksu to another park ignores the older asynchronous response',async()=>{
 const f=fixture();f.panel.open=true;
 let finishOld;
 const old=f.p(501,7,()=>new Promise(resolve=>{finishOld=resolve;}));
 await Promise.resolve();
 f.select(8);
 const current=await f.p(502,8,async()=>({geom_json:{outer:[[40.1,33.1],[40.2,33.2],[40.1,33.3]]}}));
 assert.equal(current,true);
 finishOld({geom_json:{outer:[[39.9,32.5],[40,32.6]]}});
 assert.equal(await old,false);
 const fits=f.calls.filter(entry=>entry[0]==='fit');
 assert.equal(fits.length,1);
 assert.equal(fits[0][1][0][0],40.1,'only the new park is shown');
});

test('park centroid frames even before a project imports any waypoint rows',async()=>{
 const f=fixture();f.panel.open=true;
 const ok=await f.p(301,7,async()=>({geom_json:null,centroid_lat:40.2,centroid_lon:32.2,area_m2:800000}));
 assert.equal(ok,true);
 assert.deepEqual(f.calls.filter(x=>x[0]==='set')[0].slice(1),[[40.2,32.2],14]);
});

test('reopening a project reads current park geometry instead of a stale cached park',async()=>{
 const f=fixture();f.panel.open=true;
 let reads=0;
 const readPark=async()=>{reads++;return {geom_json:{outer:[[40+reads,32.1],[40+reads,32.2],[40+reads+0.1,32.2]]}};};
 assert.equal(await f.p(310,7,readPark),true);
 assert.equal(await f.p(310,7,readPark),true);
 assert.equal(reads,2);
 assert.equal(f.calls.filter(x=>x[0]==='fit')[1][1][0][0],42);
});

test('missing geometry falls back only to waypoints belonging to the selected project',async()=>{
 const f=fixture();f.panel.open=true;
 const waypoints=[{lat:39.98,lon:32.6,project_id:7},{lat:40.01,lon:32.7,project_id:7},{lat:0,lon:0,project_id:7},{lat:41.4,lon:29,project_id:9}];
 const ok=await f.p(303,7,async()=>null,{waypoints});
 assert.equal(ok,true);
 const coordinates=f.calls.find(x=>x[0]==='fit')[1];
 assert.equal(coordinates.length,2);
 assert.equal(coordinates[1][1],32.7);
});

test('manual target focusing cancels delayed automatic park framing',async()=>{
 const f=fixture();f.panel.open=true;
 let finish;
 const pending=f.p(602,7,()=>new Promise(resolve=>{finish=resolve;}));
 await Promise.resolve();
 f.viewport.focus({map:f.map,target:{lat:40.5,lon:33.5},gps:null,showMap:false});
 finish({geom_json:{outer:[[39.98,32.6],[40.01,32.7]]}});
 assert.equal(await pending,false);
 assert.deepEqual(f.calls.filter(x=>x[0]==='set')[0].slice(1),[[40.5,33.5],18]);
 assert.equal(f.calls.filter(x=>x[0]==='fit').length,0);
});

test('navigation shell listens to project selection and map-panel opening',()=>{
 const shell=readFileSync(new URL('../src/ui/shell.js',import.meta.url),'utf8');
 assert.match(shell,/event\.target\?\.id==="nProject"\)dgFocusSelectedWaypointPark\(\)/);
 assert.match(shell,/event\.target\?\.id!=="wpMapPanel"/);
 assert.match(shell,/refreshNavigation:\(\)=>\{navMap&&navMap\.invalidateSize\(\);dgFocusSelectedWaypointPark\(\);\}/);
});

test('navigation shell resolves only the chosen project park through its existing read adapter',async()=>{
 const shell=readFileSync(new URL('../src/ui/shell.js',import.meta.url),'utf8');
 const helper=shell.slice(shell.indexOf('function dgFocusSelectedWaypointPark(){'),shell.indexOf('function go(v){'));
 const calls=[];
 const selects={nProject:{value:'83'},wpMapPanel:{open:true}};
 const client={};
 const window={
  DG_WAYPOINT_MAP_VIEWPORT:{autoProject:input=>{calls.push(input);return Promise.resolve(true);}},
  DG_FETCH_MEASUREMENT_PARK:{fetch:args=>{calls.push(args);return Promise.resolve({geom_json:{outer:[]}});}}
 };
 const ctx=vm.createContext({window,$:id=>selects[id],navMap:{},PROJ_LIST:[{id:7,park_id:25},{id:83,park_id:304}],WP:[],sb:client});
 vm.runInContext(helper,ctx);
 vm.runInContext('dgFocusSelectedWaypointPark()',ctx);
 assert.equal(calls[0].projectId,83);
 assert.equal(calls[0].parkId,304);
 await calls[0].readPark(304);
 assert.equal(calls[1].client,client);
 assert.equal(calls[1].id,304);
 selects.nProject.value='7';
 assert.equal(calls[0].isSelected(83),false,'older results must not move the new project view');
});
