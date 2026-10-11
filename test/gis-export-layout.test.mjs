import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/gis-export-layout.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const layout=context.window.DG_GIS_EXPORT_LAYOUT;

test('standard export layout keeps park bounds, projection padding, and canvas fit',()=>{
 let projectionInput;
 const result=layout.compute({rings:[[[10,30],[20,30],[20,40],[10,40],[NaN,35]]],ndvi:true,
  project:input=>(projectionInput=input,{x:'projected'})});
 assert.deepEqual({...result.bounds},{minLat:10,maxLat:20,minLon:30,maxLon:40});
 assert.equal(result.PAD,76);assert.equal(result.TOP,110);assert.equal(result.LEGEND,206);
 assert.ok(result.W>=940);assert.ok(result.H>result.TOP+result.PAD+result.LEGEND);
 assert.equal(result.projection.x,'projected');
 assert.equal(projectionInput.width,result.W);assert.equal(projectionInput.heightTop,110);
 assert.ok(Math.abs(projectionInput.minLat-(10-15/110540))<1e-12);
 assert.ok(Math.abs(projectionInput.maxLat-(20+15/110540))<1e-12);
 assert.equal(projectionInput.minLon,30);assert.equal(projectionInput.maxLon,40);
});

test('NDVI-off layout retains standard legend height and ignores invalid coordinates',()=>{
 const result=layout.compute({rings:[[[39.9,32.5],[40.1,32.5],[40.1,32.7],[39.9,32.7],[null,NaN]]],ndvi:false,project:()=>({})});
 assert.equal(result.LEGEND,146);
 assert.ok(Number.isFinite(result.scale));
 assert.ok(result.bounds.minLat===39.9&&result.bounds.maxLon===32.7);
});

test('zero-area or unbounded park rings do not produce a PNG layout',()=>{
 const project=()=>{throw Error('must not project invalid bounds');};
 assert.equal(layout.compute({rings:[[[10,20],[10,20]]],ndvi:false,project}),null);
 assert.equal(layout.compute({rings:[[[NaN,Infinity]]],ndvi:false,project}),null);
});

test('verified layout keeps its 1240 by 1560 map frame and local metric projection',()=>{
 const result=layout.computeVerified({rings:[[[10,30],[20,30],[20,40],[10,40],[NaN,35],null]]});
 assert.deepEqual({...result.bounds},{minLat:10,maxLat:20,minLon:30,maxLon:40});
 assert.deepEqual([result.CW,result.CH,result.MX,result.MY,result.MW,result.MH],[1240,1560,40,240,760,1180]);
 assert.ok(Number.isFinite(result.scale));
 assert.ok(Math.abs(result.projector.x(30)-result.ox)<1e-9);
 assert.ok(Math.abs(result.projector.y(20)-result.oy)<1e-9);
 assert.ok(Math.abs(result.projector.x(40)-(result.ox+result.width*result.scale))<1e-9);
});

test('verified layout rejects a missing or zero-area park ring',()=>{
 assert.equal(layout.computeVerified({rings:[[],null,[[1,2],[1,2]]]}),null);
});
