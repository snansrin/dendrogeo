import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const ctx=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/surface/merge-review-features.js',import.meta.url),'utf8'),ctx);
const create=ctx.window.DG_SURFACE_REVIEW_FEATURES.create;

test('review feature output groups by class and preserves summed area and sorted method labels',()=>{
  const unions=[];
  const output=create({union:geometries=>{unions.push(geometries);return{unionOf:geometries};},unproject:(geometry,epsg)=>({source:geometry,epsg})});
  const parts=[
    {type:'green',geom:['g1'],areaM2:12,method:'visual-cell'},
    {type:'hard',geom:['h1'],areaM2:3,method:'osm-boundary'},
    {type:'green',geom:['g2'],areaM2:5,method:'review-cell'},
    {type:'green',geom:['g3'],areaM2:2,method:'visual-cell'}
  ];
  const features=output.merge(parts,32631);
  assert.deepEqual(Array.from(features,x=>x.properties.class),['green','hard']);
  assert.equal(features[0].properties.area_m2,19);
  assert.equal(features[0].properties.method,'review-cell+visual-cell');
  assert.deepEqual(JSON.parse(JSON.stringify(unions)),[[['g1'],['g2'],['g3']],[['h1']]]);
  assert.deepEqual(JSON.parse(JSON.stringify(features[0].geometry.coordinates)),{source:{unionOf:[['g1'],['g2'],['g3']]},epsg:32631});
});

test('review display reuses prepared exact features and does not smooth or union twice',()=>{
  let unions=0;
  const output=create({union:geometries=>{unions++;return geometries;},unproject:geometry=>geometry});
  const prepared=[{type:'Feature',properties:{class:'green'}}];
  assert.equal(output.display([{type:'green',geom:[],areaM2:1,method:'review-cell'}],32631,[],prepared),prepared);
  assert.equal(unions,0);
  const fallback=output.display([{type:'green',geom:['g'],areaM2:1,method:'review-cell'}],32631,[]);
  assert.equal(fallback[0].properties.area_m2,1);
  assert.equal(unions,1);
});
