import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/domain/surface/build-surface-export-data.js','src/domain/surface/prepare-surface-export-map-frame.js','src/ui/render-surface-export-layer-dialog.js','src/ui/draw-surface-export-map-layers.js','src/ui/render-surface-export-infographic.js'];
function setup(){const window={};const context=vm.createContext({window,Map,Math,Number,String,Object,Array});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('GeoJSON and CSV export payloads retain reviewed fields, view and BOM contract',()=>{
 const api=setup().DG_BUILD_SURFACE_EXPORT_DATA,cell={row:2,col:3,classKey:'trees'},parts=[{cell,type:'green',group:'vegetation',areaM2:125,method:'manual',geom:{coordinates:[]}}],vegetation={tiers:new Map([['2:3','high']])};
 const geo=api.geoJson({parts,vegetation,profile:{'2:3':{ndviMedianYear:.42,ndviObs:4}},fingerprint:'abc',acceptedAt:'now',view:'preview',cellKey:()=> '2:3',unproject:()=>[[[1,2]]],epsg:32636});
 assert.equal(geo.type,'FeatureCollection');assert.deepEqual(JSON.parse(JSON.stringify(geo.features[0].properties)),{row:2,column:3,original_class:'trees',review_class:'green',group:'vegetation',area_m2:125,method:'manual',vegetation_ndvi_relative_class:'high',ndvi_median_season:.42,ndvi_observation_days:4,source_fingerprint:'abc',accepted_at:'now',view:'preview'});assert.deepEqual(JSON.parse(JSON.stringify(geo.features[0].geometry.coordinates)),[[[1,2]]]);
 assert.equal(api.csv({areas:{green:125,water:25},view:'accepted',fingerprint:'abc'}),'\uFEFFclass,area_m2,area_ha,view,source_fingerprint\ngreen,125,0.0125,accepted,abc\nwater,25,0.0025,accepted,abc');
});

test('map frame projects cell, park and holes into a padded canvas extent',()=>{
 const prepare=setup().DG_PREPARE_SURFACE_EXPORT_MAP_FRAME.prepare,frame=prepare({cells:[{quadWgs:[[1,2],[3,4]]}],parkRings:[[[0,0],[4,5]]],epsg:32636,forward:(lat,lon,epsg)=>({x:lon*10,y:lat*10,epsg})});
 assert.deepEqual([frame.minX,frame.minY,frame.maxX,frame.maxY],[0,0,50,40]);assert.deepEqual(Array.from(frame.canvasProject(2,3,{x:40,y:240,width:760,height:1180,margin:20})),[492,830]);
});

test('export selector escapes labels and preserves enabled and disabled choices',()=>{
 const render=setup().DG_RENDER_SURFACE_EXPORT_LAYER_DIALOG.render,html=render({grid:false,waypoints:true,escape:value=>String(value).replaceAll('<','&lt;'),translate:value=>value==='Park alanı'?'Park <alanı>':value});
 assert.match(html,/name="park" checked/);assert.match(html,/name="surface" checked/);assert.match(html,/name="grid" disabled/);assert.match(html,/name="waypoints" checked/);assert.match(html,/Park &lt;alanı>/);assert.match(html,/id="dgExportCancel"/);assert.match(html,/id="dgExportDownload"/);
});

test('map drawing obeys selected layers and paints the expected geometries',()=>{
 const draw=setup().DG_DRAW_SURFACE_EXPORT_MAP_LAYERS.draw,events=[],context=new Proxy({},{get:(target,key)=>target[key]??((...args)=>events.push([key,...args])),set:(target,key,value)=>(target[key]=value,true)});
 const feature={geometry:{coordinates:[[[[2,1],[4,3],[2,1]]]]},properties:{class:'green'}};
 draw({context,layers:{surface:true,park:false,grid:false,waypoints:false},displayFeatures:[feature],project:(lat,lon)=>[lon,lat],parkRings:[],gridCells:[],waypoints:[],colors:{green:'#0f0',other:'#aaa'},ink:'#000'});
 assert.ok(events.some(([key])=>key==='fill'));assert.ok(events.some(([key])=>key==='lineTo'));assert.equal(events.filter(([key])=>key==='stroke').length,0);
});

test('all five export modules load before the locked UI and are precached',()=>{
 const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');for(const path of modules){assert.ok(chain.includes(`"${path}"`),`${path} lazy load`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'),`${path} loads before locked UI`);}for(const name of ['DG_BUILD_SURFACE_EXPORT_DATA','DG_PREPARE_SURFACE_EXPORT_MAP_FRAME','DG_RENDER_SURFACE_EXPORT_LAYER_DIALOG','DG_DRAW_SURFACE_EXPORT_MAP_LAYERS','DG_RENDER_SURFACE_EXPORT_INFOGRAPHIC'])assert.ok(ui.includes(name));
});
