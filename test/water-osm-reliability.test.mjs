import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const BBOX={minLat:39.98,minLon:32.61,maxLat:40.01,maxLon:32.69};
const RING=[[32.635,39.986],[32.657,39.986],[32.657,40.001],[32.635,40.001],[32.635,39.986]];
const valid={osm_type:'way',osm_id:423602740,type:'water',name:'Susuz Gölü',geojson:{type:'Polygon',coordinates:[RING]}};

function env(options={}){
 let requests=[];
 const ctx={window:{DG_SURFACE_OSM:null,DG_SURFACE_OSM_PENDING:{boundary:'null',promise:Promise.resolve(false)}},
  fetch:async url=>{requests.push(String(url));return{ok:true,json:async()=>[options.record||valid]};},
  AbortController,AbortSignal,setTimeout,clearTimeout,Date,Math,JSON,Number,Array,String,Promise,console,
  overpassRequest:async()=>null};
 ctx.window.window=ctx.window;
 vm.createContext(ctx);
 vm.runInContext(load('src/services/osm-water-backup.js'),ctx,{filename:'osm-water-backup.js'});
 vm.runInContext(load('src/services/lc-osm.js'),ctx,{filename:'lc-osm.js'});
 return {ctx,requests};
}

test('Known OSM water way yields its REAL closed polygon, not a raster rectangle',async()=>{
 const {ctx,requests}=env();
 const data=await vm.runInContext('dgLcOsmData('+JSON.stringify(BBOX)+')',ctx);
 assert.equal(data.elements.length,1);
 assert.equal(data.elements[0].id,423602740);
 assert.equal(data.elements[0].tags.natural,'water');
 assert.equal(data.elements[0].geometry.length,5);
 assert.equal(data.elements[0].geometry[0].lon,32.635);
 assert.equal(data.source,'nominatim-osm-way');
 assert.equal(ctx.window.DG_SURFACE_OSM.elements[0].id,423602740);
 assert.equal(requests.length,1);
 assert.ok(requests[0].includes('polygon_geojson=1'));
});

test('A failed detailed Overpass query must NOT block independent water recovery',async()=>{
 const {ctx}=env();
 const data=await vm.runInContext('dgLcOsmData('+JSON.stringify(BBOX)+')',ctx);
 assert.equal(data.elements[0].tags.natural,'water');
});

test('Out-of-area parks must not receive the Göksu water polygon',async()=>{
 const {ctx,requests}=env();
 const bbox={minLat:39.92,minLon:32.82,maxLat:39.94,maxLon:32.86};
 const data=await vm.runInContext('dgLcOsmData('+JSON.stringify(bbox)+')',ctx);
 assert.equal(data,null);
 assert.equal(requests.length,0);
});

test('Incorrect water tag or malformed geometry is rejected',async()=>{
 const bad=[{...valid,type:'park'},{...valid,geojson:{type:'Polygon',coordinates:[[[32.635,39.986],[32.657,39.986],[32.635,39.986]]]}}];
 for(const record of bad){
  const {ctx}=env({record});
  const data=await vm.runInContext('dgLcOsmData('+JSON.stringify(BBOX)+')',ctx);
  assert.equal(data,null);
 }
});

test('Previously verified water remains available during a failed refresh',async()=>{
 const {ctx,requests}=env();
 const previous={elements:[{type:'way',id:17,tags:{natural:'water'},geometry:[]}],bbox:BBOX,boundary:'null',fetchedAt:new Date().toISOString()};
 ctx.window.DG_SURFACE_OSM=previous;
 const data=await vm.runInContext('dgLcOsmData('+JSON.stringify(BBOX)+')',ctx);
 assert.equal(data.elements[0].id,17);
 assert.equal(requests.length,0);
});

test('Initial surface analysis requests water automatically and preserves raw cells',()=>{
 const ui=load('src/ui/lc-sens.js'),park=load('src/services/park-query.js'),coverage=load('src/application/parks/fetch-detailed-coverage.js'),baseline=load('src/services/landcover.js'),application=load('src/application/surface/run-analysis.js');
 assert.match(ui,/dgSensAutoWaterOnMount\(rec,epoch\)/);
 assert.match(ui,/async function dgSensAutoWaterOnScan/);
 assert.match(ui,/dgSurfaceObjects\(data\.elements,DG_SENS\.epsg\)/);
 assert.match(park,/if\(window\.DG_SURFACE_OSM\?\.boundary!==boundary\)/);
 assert.match(coverage,/if \(boundary !== JSON\.stringify\(getParkPolygon\(\)\)\)/);
 assert.match(baseline,/DG_RUN_SURFACE_ANALYSIS\.run\(params\)/);
 assert.match(application,/const patches=detectPatches\(result\.cells\),cross=null,crossErr=null,waterRefined=0,roadRefined=0/);
 assert.doesNotMatch(ui,/dgLcRefineWater\(/);
});

test('The verified water fallback is ordered and precached for offline map loads',()=>{
 const h=load('partials/head.html'),sw=load('sw.js');
 assert.match(h,/src\/services\/osm-water-backup\.js/);
 assert.ok(h.indexOf('osm-water-backup.js')<h.indexOf('src/utils/lazylibs.js?v'));
 assert.match(sw,/\/src\/services\/osm-water-backup\.js/);
});
