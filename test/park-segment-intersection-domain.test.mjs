import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/domain/parks/segment-intersection.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const {orientation,onSegment,segmentsIntersect}=context.window.DG_PARK_SEGMENTS;

test('orientation preserves the legacy 1e-9 collinearity tolerance and values',()=>{
  assert.equal(orientation({x:0,y:0},{x:1,y:0},{x:1,y:1}),1);
  assert.equal(orientation({x:0,y:0},{x:1,y:0},{x:1,y:-1}),2);
  assert.equal(orientation({x:0,y:0},{x:1,y:1},{x:2,y:2}),0);
  assert.equal(orientation({x:0,y:0},{x:1,y:0},{x:0.5,y:1e-10}),0);
});

test('point-on-segment and intersection retain endpoint and collinear behavior',()=>{
  assert.equal(onSegment({x:0,y:0},{x:2,y:0},{x:1,y:0}),true);
  assert.equal(segmentsIntersect({x:0,y:0},{x:2,y:2},{x:0,y:2},{x:2,y:0}),true);
  assert.equal(segmentsIntersect({x:0,y:0},{x:2,y:0},{x:0,y:1},{x:2,y:1}),false);
  assert.equal(segmentsIntersect({x:0,y:0},{x:1,y:1},{x:5,y:5},{x:6,y:6}),false);
  assert.equal(segmentsIntersect({x:0,y:0},{x:1,y:1},{x:1,y:1},{x:2,y:0}),true);
});
