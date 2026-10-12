import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/gis-export-verified-layers.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const renderer=context.window.DG_GIS_EXPORT_VERIFIED_LAYERS;

test('verified PNG layers retain clipping and surface, NDVI, grid, waypoint, border order',()=>{
 const events=[];
 const g=new Proxy({}, {set(target,key,value){target[key]=value;events.push(['set',key,value]);return true;},
  get(target,key){if(key in target)return target[key];return(...args)=>events.push([key,...args]);}});
 const result=renderer.draw({context:g,layout:{MX:10,MY:20,MW:700,MH:900,projector:'projection'},
  layers:{surface:true,grid:true,waypoints:true,park:true},sensitivity:{displayPaths:[{poly:'surface'}],opacity:65},
  ndviPolys:['ndvi'],parkRings:['park'],holes:['hole'],classes:{},
  canvasApi:{drawLeaflet(_g,_pr,poly){events.push(['leaflet',poly]);return true;},
   drawRawPatches(){throw Error('display geometry should be used');},
   drawVerifiedGrid(){events.push(['grid']);},drawVerifiedWaypoints(){events.push(['waypoints']);}},
  getLandcover(){throw Error('display geometry should be used');},getGridCells(){return[];},
  readProjectId(){return 7;},getWaypoints(){return[];},getLastWaypoints(){return[];},
  outline(_g,_pr,ring){events.push(['outline',ring]);}
 });
 const index=(name,arg,from=0)=>events.findIndex((e,i)=>i>=from&&e[0]===name&&(arg===undefined||e[1]===arg));
 const clip=index('clip'),surface=index('leaflet','surface'),ndvi=index('leaflet','ndvi');
 const grid=index('grid'),waypoints=index('waypoints'),restore=index('restore');
 const border=index('outline','park',restore+1);
 assert.ok(clip<surface&&surface<ndvi&&ndvi<grid&&grid<waypoints&&waypoints<restore&&restore<border);
 assert.equal(events[clip][1],'evenodd');
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:true});
});

test('verified NDVI map refuses to draw without any reviewed surface geometry',()=>{
 const events=[];
 const g={fillRect:()=>{},strokeRect:()=>{},save:()=>events.push('save'),beginPath:()=>{},clip:()=>{}};
 const result=renderer.draw({context:g,layout:{MX:0,MY:0,MW:1,MH:1,projector:{}},
  layers:{surface:true,grid:false,waypoints:false,park:false},sensitivity:{displayPaths:[]},ndviPolys:[],
  parkRings:[],holes:[],classes:{},canvasApi:{drawRawPatches:()=>0},getLandcover:()=>({}),outline:()=>{}});
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:false,message:'Arazi örtüsü çizilemedi; NDVI katmanı tek başına doğrulanmış harita sayılmaz.'});
 assert.deepEqual(events,['save']);
});

test('verified layer compositor is loaded and precached before its canvas adapter',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(index,/src\/ui\/gis-export-verified-layers\.js\?v=[a-f0-9]{8}/);
 assert.ok(index.indexOf('src/ui/gis-export-verified-layers.js')<index.indexOf('src/ui/gis-export-verified-canvas.js'));
 assert.match(sw,/\/src\/ui\/gis-export-verified-layers\.js/);
});
