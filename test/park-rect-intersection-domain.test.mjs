import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
for(const path of [
  '../src/domain/parks/point-in-polygon.js',
  '../src/domain/parks/bounds.js',
  '../src/domain/parks/segment-intersection.js',
  '../src/domain/parks/rect-intersection.js'
]) vm.runInContext(readFileSync(new URL(path,import.meta.url),'utf8'),context);
const {segmentIntersectsRect,geometryIntersectsRect,geometryLineIntersectsRect}=context.window.DG_PARK_RECT_INTERSECTION;
const rect={minX:100,minY:100,maxX:200,maxY:200};
const at=(x,y)=>[y/110540,x/111320];
const plain=value=>JSON.parse(JSON.stringify(value));

test('segments intersect rectangle edges and retain endpoint-inside behavior',()=>{
  assert.equal(segmentIntersectsRect({x:0,y:150},{x:250,y:150},rect),true);
  assert.equal(segmentIntersectsRect({x:120,y:120},{x:130,y:130},rect),true);
  assert.equal(segmentIntersectsRect({x:0,y:0},{x:50,y:50},rect),false);
});

test('polygon and line intersection keep bbox rejection, crossing, and buffer behavior',()=>{
  const crossingRing=[at(50,50),at(250,50),at(250,250),at(50,250)];
  const crossingLine=[at(0,150),at(300,150)];
  assert.equal(geometryIntersectsRect(crossingRing,rect,0),true);
  assert.equal(geometryIntersectsRect([at(400,400),at(450,400),at(450,450)],rect,0),false);
  assert.equal(geometryLineIntersectsRect(crossingLine,rect,0),true);
  assert.equal(geometryLineIntersectsRect([at(0,0),at(50,50)],rect,0),false);
  assert.equal(geometryLineIntersectsRect([at(0,90),at(300,90)],rect,0,10),true);
  assert.deepEqual(plain([geometryIntersectsRect([],rect,0),geometryLineIntersectsRect(null,rect,0)]),[false,false]);
});
