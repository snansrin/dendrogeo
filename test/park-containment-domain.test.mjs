import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
for(const path of ['../src/domain/parks/point-in-polygon.js','../src/domain/parks/park-containment.js']){
  vm.runInContext(readFileSync(new URL(path,import.meta.url),'utf8'),context);
}
const pointInPark=context.window.DG_PARK_CONTAINMENT.pointInPark;
const outer=[[39,32],[39,33],[40,33],[40,32]];
const hole=[[39.4,32.4],[39.4,32.6],[39.6,32.6],[39.6,32.4]];

test('park containment handles outside, outer rings, holes, and multiple rings',()=>{
  assert.equal(pointInPark(39.2,32.2,[outer]),true);
  assert.equal(pointInPark(38.9,32.2,[outer]),false);
  assert.equal(pointInPark(39.5,32.5,{outer:[outer],inner:[hole]}),false);
  assert.equal(pointInPark(39.2,32.2,{outer:[outer],inner:[hole]}),true);
  assert.equal(pointInPark(39.2,32.2,[[[39,32],[39,31],[40,31],[40,32]],outer]),true);
  assert.equal(pointInPark(39.5,32.5,[outer],[hole]),false);
  assert.equal(pointInPark(39.2,32.2,null),false);
  assert.equal(pointInPark(39.2,32.2,[]),false);
});
