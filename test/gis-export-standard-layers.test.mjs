import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/gis-export-standard-layers.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const renderer=context.window.DG_GIS_EXPORT_STANDARD_LAYERS;

test('standard PNG layers stay clipped and render in surface, NDVI, grid, waypoint, border order',()=>{
 const events=[];
 const ctx=new Proxy({}, {set(target,key,value){target[key]=value;events.push(['set',key,value]);return true;},
  get(target,key){if(key in target)return target[key];return(...args)=>events.push([key,...args]);}});
 let grids=0,waypoints=0;
 const result=renderer.draw({context:ctx,layout:{projection:{id:'projection'}},
  options:{cover:true,grid:true,wp:true},sensitivity:{displayPaths:[{poly:'surface'}],opacity:65},
  ndvi:true,ndviPolys:['ndvi'],parkRings:['park'],holes:['hole'],classMap:{green:'#22c55e'},
  canvasApi:{drawLeaflet(_ctx,_pr,poly){events.push(['leaflet',poly]);return true;},
   drawGrid(){events.push(['grid']);},drawWaypoints(){events.push(['waypoints']);}},
  getLandcover(){throw Error('display geometry should be used');},getGridCells(){grids++;return[];},
  getWaypoints(){waypoints++;return[];},outline(_ctx,_pr,ring){events.push(['outline',ring]);}
 });
 const clip=events.findIndex(e=>e[0]==='clip');
 const surface=events.findIndex(e=>e[0]==='leaflet'&&e[1]==='surface');
 const ndvi=events.findIndex(e=>e[0]==='leaflet'&&e[1]==='ndvi');
 const grid=events.findIndex(e=>e[0]==='grid'),wp=events.findIndex(e=>e[0]==='waypoints');
 const restore=events.findIndex(e=>e[0]==='restore');
 const border=events.findIndex((e,i)=>i>restore&&e[0]==='outline'&&e[1]==='park');
 assert.ok(clip<surface&&surface<ndvi&&ndvi<grid&&grid<wp&&wp<restore&&restore<border);
 assert.equal(events[clip][1],'evenodd');
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{count:1});
 assert.equal(grids,1);assert.equal(waypoints,1);
});

test('standard PNG layer compositor is loaded and precached before its canvas adapter',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(index,/src\/ui\/gis-export-standard-layers\.js\?v=[a-f0-9]{8}/);
 assert.ok(index.indexOf('src/ui/gis-export-standard-layers.js')<index.indexOf('src/ui/gis-export-standard-canvas.js'));
 assert.match(sw,/\/src\/ui\/gis-export-standard-layers\.js/);
});
