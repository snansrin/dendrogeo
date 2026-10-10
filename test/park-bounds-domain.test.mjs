import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
for(const path of ['../src/domain/parks/point-in-polygon.js','../src/domain/parks/bounds.js']){
  vm.runInContext(readFileSync(new URL(path,import.meta.url),'utf8'),context);
}
const {ringBBox,expandBBox,bboxesOverlap,rectCorners}=context.window.DG_PARK_BOUNDS;

test('ring bounds preserve local projection and [LAT,LON] order',()=>{
  const bounds=ringBBox([[40,31],[40,32],[41,32],[41,31]],40);
  assert.deepEqual(JSON.parse(JSON.stringify(bounds)),{
    minX:31*111320*Math.cos(40*Math.PI/180),
    minY:40*110540,
    maxX:32*111320*Math.cos(40*Math.PI/180),
    maxY:41*110540
  });
});

test('bounds expansion, overlap edges, and rectangle corner order stay stable',()=>{
  const expanded=expandBBox({minX:1,minY:2,maxX:3,maxY:4},5);
  assert.deepEqual(JSON.parse(JSON.stringify(expanded)),{minX:-4,minY:-3,maxX:8,maxY:9});
  assert.equal(bboxesOverlap(expanded,{minX:8,minY:0,maxX:9,maxY:1}),true);
  assert.equal(bboxesOverlap(expanded,{minX:8.1,minY:0,maxX:9,maxY:1}),false);
  assert.deepEqual(JSON.parse(JSON.stringify(rectCorners({minX:1,minY:2,maxX:3,maxY:4}))),[
    {x:1,y:2},{x:3,y:2},{x:3,y:4},{x:1,y:4}
  ]);
});
