import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const ctx=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/adapters/surface/osm-review-objects.js',import.meta.url),'utf8'),ctx);
const convert=ctx.window.DG_SURFACE_OSM_REVIEW_ADAPTER.create({
  projectRing:ring=>ring.map(([lon,lat])=>[lon,lat]),
  unprojectGeometry:geometry=>geometry,
  parkGeometry:(outer,holes)=>[...outer.map(ring=>[ring]),...holes.map(ring=>[ring])],
  clip:(operation,...geometries)=>geometries.flat(),
  gridLineMask:()=>[],
  extractRings:()=>null
});
const ring=[[0,0],[2,0],[2,2],[0,2],[0,0]];

test('OSM review adapter converts tagged closed areas and keeps the established priority order',()=>{
  const features=convert([
    {type:'way',id:1,tags:{building:'yes'},geometry:ring.map(([lon,lat])=>({lon,lat}))},
    {type:'way',id:2,tags:{natural:'water'},geometry:ring.map(([lon,lat])=>({lon,lat}))},
    {type:'way',id:3,tags:{leisure:'swimming_pool'},geometry:ring.map(([lon,lat])=>({lon,lat}))}
  ],32631);
  assert.deepEqual(Array.from(features,x=>x.type),['water','pool','building']);
  assert.deepEqual(Array.from(features,x=>x.osmId),['way/2','way/3','way/1']);
  assert.ok(features.every(x=>x.geometry.type==='MultiPolygon'&&x.method==='osm-boundary'));
});

test('closed linear footways stay lines unless OSM explicitly marks them as areas',()=>{
  const closed={type:'way',id:4,tags:{highway:'footway'},geometry:ring.map(([lon,lat])=>({lon,lat}))};
  assert.equal(convert([closed],32631).length,0);
  assert.equal(convert([{...closed,tags:{...closed.tags,area:'yes'}}],32631).length,1);
});
