import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const window={};vm.runInNewContext(load('src/ui/gis-export-sources.js'),{window});
function fixture(){
 const state={};const api=window.DG_GIS_EXPORT_SOURCES.create({getLandcover:()=>state.landcover,getGridSession:()=>state.grid,
  hasWaypoints:()=>Object.hasOwn(state,'waypoints'),getWaypoints:()=>state.waypoints,getLastWaypoints:()=>state.last||[],
  getParkAreaFunction:()=>state.area,getSurfaceTypes:()=>state.types,readProjectId:()=>state.project});
 return {state,api};
}
test('standard sources retain absent optional readers and read current session data',()=>{
 const {state,api}=fixture();assert.equal(api.standard().getGridCells,null);assert.equal(api.standard().getWaypoints,null);
 const cells=[{id:1}],waypoints=[{id:2}];state.grid={getCells:()=>cells};state.waypoints=waypoints;
 const readers=api.standard();assert.equal(readers.getGridCells(),cells);assert.equal(readers.getWaypoints(),waypoints);
 const next=[{id:3}];state.grid={getCells:()=>next};state.waypoints=next;state.landcover={patches:[]};
 assert.equal(readers.getGridCells(),next);assert.equal(readers.getWaypoints(),next);assert.equal(readers.getLandcover(),state.landcover);
});
test('verified sources keep null grid, empty waypoint and empty-session distinctions',()=>{
 const {state,api}=fixture(),readers=api.verified();assert.equal(readers.getGridCells(),null);assert.equal(readers.getWaypoints().length,0);
 state.grid={getCells:()=>null};assert.equal(readers.getGridCells().length,0);assert.equal(api.standard().getGridCells(),null);
 state.waypoints=null;assert.equal(readers.getWaypoints(),null);assert.equal(api.standard().getWaypoints(),null);
});
test('verified metadata readers remain lazy and return original references without mutation',()=>{
 const {state,api}=fixture(),readers=api.verified();assert.equal(readers.hasParkAreaHa(),false);
 state.area=()=>12.345;state.types={water:'Water'};state.last=[{id:1}];state.project=7;
 assert.equal(readers.hasParkAreaHa(),true);assert.equal(readers.getParkAreaHa(),12.345);
 assert.equal(readers.getSurfaceTypes(),state.types);assert.equal(readers.getLastWaypoints(),state.last);assert.equal(readers.readProjectId(),7);
 assert.deepEqual(state.last,[{id:1}]);
});
test('source adapter is loaded before the exporter and included offline',()=>{
 const html=load('index.html');assert.ok(html.indexOf('src/ui/gis-export-sources.js')<html.indexOf('src/ui/gis-export.js'));
 assert.match(html,/src\/ui\/gis-export-sources\.js\?v=[a-f0-9]{8}/);assert.match(load('sw.js'),/\/src\/ui\/gis-export-sources\.js/);
});
