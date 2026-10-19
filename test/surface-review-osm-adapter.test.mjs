import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const ctx=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/domain/surface/osm-road-policy.js',import.meta.url),'utf8'),ctx);
vm.runInContext(readFileSync(new URL('../src/adapters/surface/osm-review-objects.js',import.meta.url),'utf8'),ctx);
const roadHalfWidths=[];
let emitRoadMask=false;
const convert=ctx.window.DG_SURFACE_OSM_REVIEW_ADAPTER.create({
  projectRing:ring=>ring.map(([lon,lat])=>[lon,lat]),
  unprojectGeometry:geometry=>geometry,
  parkGeometry:(outer,holes)=>[...outer.map(ring=>[ring]),...holes.map(ring=>[ring])],
  clip:(operation,...geometries)=>geometries.flat(),
  gridLineMask:(line)=>{roadHalfWidths.push(line.w);return emitRoadMask?[[[[0,0],[1,0],[1,1],[0,1],[0,0]]]]:[];},
  extractRings:()=>null
});
const ring=[[0,0],[2,0],[2,2],[0,2],[0,0]];

test('OSM review adapter converts tagged closed areas and keeps the established priority order',()=>{
  const features=convert([
    {type:'way',id:1,tags:{building:'yes'},geometry:ring.map(([lon,lat])=>({lon,lat}))},
    {type:'way',id:2,tags:{natural:'water'},geometry:ring.map(([lon,lat])=>({lon,lat}))},
    {type:'way',id:3,tags:{leisure:'swimming_pool'},geometry:ring.map(([lon,lat])=>({lon,lat}))}
  ],32631);
  assert.deepEqual(Array.from(features,x=>x.type),['water','water','building']);
  assert.deepEqual(Array.from(features,x=>x.osmId),['way/2','way/3','way/1']);
  assert.ok(features.every(x=>x.geometry.type==='MultiPolygon'&&x.method==='osm-boundary'));
});

test('closed linear footways stay lines unless OSM explicitly marks them as areas',()=>{
  const closed={type:'way',id:4,tags:{highway:'footway'},geometry:ring.map(([lon,lat])=>({lon,lat}))};
  assert.equal(convert([closed],32631).length,0);
  assert.equal(convert([{...closed,tags:{...closed.tags,area:'yes'}}],32631).length,1);
});

test('surface road geometry uses shared OSM width metadata and the same metric buffer width',()=>{
  roadHalfWidths.length=0;emitRoadMask=true;
  const line=(id,tags)=>({type:'way',id,tags:{highway:'primary',...tags},geometry:[[0,0],[0.01,0.01]].map(([lon,lat])=>({lon,lat}))});
  const features=convert([
    line(5,{width:'16 m'}),
    line(6,{'width:carriageway':'7.5'}),
    line(7,{est_width:'6'}),
    line(8,{lanes:'4'}),
    line(9,{highway:'footway'})
  ],32631);
  assert.deepEqual(Array.from(roadHalfWidths),[8,3.75,3,6,2.5]);
  assert.deepEqual(Array.from(features,feature=>[feature.roadWidthM,feature.widthSource]),[
    [16,'osm-width'],[7.5,'osm-width'],[6,'osm-estimated-width'],[12,'lane-count-estimate'],[5,'highway-class-estimate']
  ]);
  emitRoadMask=false;
});

test('surface worker loads the shared width policy before converting OSM review objects',()=>{
  const worker=readFileSync(new URL('../src/workers/surface-worker.js',import.meta.url),'utf8');
  assert.ok(worker.indexOf("'../domain/surface/osm-road-policy.js'")<worker.indexOf("'../adapters/surface/osm-review-objects.js'"));
});
