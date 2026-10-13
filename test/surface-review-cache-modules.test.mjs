import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadApp } from '../scripts/test-harness.mjs';
const run=(context,source)=>vm.runInContext(source,context);

test('surface review cache matches only the same geometry, park, CRS, cells and feature identities',()=>{
  const app=loadApp(),park=[],cell={},feature={},cells=[cell],features=[feature];
  const cached={park,epsg:32631,cellCount:1,cellFirst:cell,features};
  Object.assign(app,{cached,park,cell,cells,features});
  assert.equal(run(app,'window.DG_IS_SURFACE_REVIEW_CACHE_CURRENT.matches(cached,{park,epsg:32631,cells,features})'),true);
  assert.equal(run(app,'window.DG_IS_SURFACE_REVIEW_CACHE_CURRENT.matches(cached,{park:[],epsg:32631,cells,features})'),false);
  assert.equal(run(app,'window.DG_IS_SURFACE_REVIEW_CACHE_CURRENT.matches(cached,{park,epsg:32632,cells,features})'),false);
  assert.equal(run(app,'window.DG_IS_SURFACE_REVIEW_CACHE_CURRENT.matches(cached,{park,epsg:32631,cells:[{}],features})'),false);
  assert.equal(run(app,'window.DG_IS_SURFACE_REVIEW_CACHE_CURRENT.matches(cached,{park,epsg:32631,cells,features:[{}]})'),false);
});

test('cached raster parts are retyped while explicit review boundaries retain identity',()=>{
  const app=loadApp();
  const parts=[{method:'review-cell',cell:{id:1}},{method:'visual-boundary',type:'water'}];
  Object.assign(app,{parts});
  const result=run(app,'window.DG_RETYPE_CACHED_SURFACE_REVIEW_PARTS.retype(parts,()=>"building",{building:{group:"hard"}})');
  assert.equal(result[0].type,'building');
  assert.equal(result[0].group,'hard');
  assert.equal(result[1],parts[1]);
});

test('surface review cache seeds part metadata and WGS conversion by object identity',()=>{
  const app=loadApp(),geom={},cell={},features=[],park={},partGeom={},wgs=[];
  const cache=run(app,'window.DG_SURFACE_REVIEW_CACHE_FACTORY.create()');
  Object.assign(app,{cache,geometries:geom,features,park,partGeom,wgs,cell});
  run(app,'cache.seed(geometries,features,32631,park,[{geom:partGeom,wgs}], [cell])');
  assert.equal(cache.parts.get(geom).cellFirst,cell);
  assert.equal(cache.wgs.get(partGeom).wgs,wgs);
  assert.equal(cache.masks instanceof WeakMap,true);
});

test('feature geometry adapter projects multipolygons and valid legacy rings',()=>{
  const app=loadApp();
  const projectRing=(ring,epsg)=>ring.map(([x,y])=>[x+epsg,y]);
  const multi={geometry:{type:'MultiPolygon',coordinates:[[[[1,2],[3,4]]]]}};
  const ring={ring:[[5,6],[7,8],[9,10],[5,6]]};
  app.projectRing=projectRing;
  app.isValidRing=value=>value.length>=4;
  app.multi=multi;app.ring=ring;
  assert.equal(JSON.stringify(run(app,'window.DG_PROJECT_SURFACE_REVIEW_FEATURE_GEOMETRY.project(multi,10,{projectRing,isValidRing})')),'[[[[11,2],[13,4]]]]');
  assert.equal(JSON.stringify(run(app,'window.DG_PROJECT_SURFACE_REVIEW_FEATURE_GEOMETRY.project(ring,10,{projectRing,isValidRing})')),'[[[[15,6],[17,8],[19,10],[15,6]]]]');
  assert.equal(JSON.stringify(run(app,'window.DG_PROJECT_SURFACE_REVIEW_FEATURE_GEOMETRY.project({ring:[[1,2]]},10,{projectRing,isValidRing})')),'[]');
});

test('review summary application composes resolved parts and area reconciliation',()=>{
  const app=loadApp(),calls=[];
  const inputs={base:{green:2},cells:[],classFor:()=>{},geometries:{},features:[],epsg:32631,park:[]};
  app.inputs=inputs;
  app.resolveParts=(...args)=>{calls.push(['resolve',args]);return['part'];};
  app.summarizeParts=(base,parts)=>{calls.push(['summarize',base,parts]);return{green:2,building:3};};
  const result=run(app,'window.DG_BUILD_SURFACE_REVIEW_SUMMARY.build(inputs,{resolveParts,summarizeParts})');
  assert.deepEqual(Object.keys(result).sort(),['building','green']);
  assert.equal(result.building,3);
  assert.equal(calls.length,2);
  assert.equal(calls[1][2][0],'part');
});
