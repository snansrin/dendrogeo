import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const ctx=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/domain/surface/review-geometry.js',import.meta.url),'utf8'),ctx);
const geometry=ctx.window.DG_SURFACE_REVIEW_GEOMETRY;

test('review geometry area subtracts holes and clamps invalid negative totals',()=>{
  assert.equal(geometry.area([[[[0,0],[4,0],[4,4],[0,4]],[[1,1],[3,1],[3,3],[1,3]]]]),12);
  assert.equal(geometry.area([[[[0,0],[2,0],[2,2],[0,2]],[[0,0],[3,0],[3,3],[0,3]]]]),0);
  assert.equal(geometry.area([]),0);
});

test('review geometry bounds span all polygon rings and overlap excludes touching edges',()=>{
  const geom=[[[[1,2],[5,2],[5,7],[1,7]],[[2,3],[3,3],[3,4],[2,4]]]];
  assert.deepEqual(Array.from(geometry.bounds(geom)),[1,2,5,7]);
  assert.equal(geometry.overlap([0,0,2,2],[1,1,3,3]),true);
  assert.equal(geometry.overlap([0,0,1,1],[1,0,2,1]),false);
});
