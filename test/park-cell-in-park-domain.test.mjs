import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
for(const path of [
  '../src/domain/parks/point-in-polygon.js',
  '../src/domain/parks/bounds.js',
  '../src/domain/parks/segment-intersection.js',
  '../src/domain/parks/rect-intersection.js',
  '../src/domain/parks/park-containment.js',
  '../src/domain/parks/cell-in-park.js'
]) vm.runInContext(readFileSync(new URL(path,import.meta.url),'utf8'),context);
const cellInsidePark=context.window.DG_PARK_CELL_CONTAINMENT.cellInsidePark;
const outer=[[39,32],[39,32.01],[39.01,32.01],[39.01,32],[39,32]];
const park=[outer];
const hole=[[39.004,32.004],[39.004,32.006],[39.006,32.006],[39.006,32.004],[39.004,32.004]];

test('cell containment keeps center/corner checks and conservative park edge rule',()=>{
  assert.equal(cellInsidePark(39.001,39.002,32.001,32.002,park,[]),true);
  assert.equal(cellInsidePark(39.001,39.002,31.999,32.002,park,[]),false);
  assert.equal(cellInsidePark(39,39.002,32.001,32.002,park,[]),false);
});

test('hole-contained and hole-crossing cells remain invalid',()=>{
  assert.equal(cellInsidePark(39.0045,39.0055,32.0045,32.0055,park,[hole]),false);
  assert.equal(cellInsidePark(39.0035,39.0045,32.0035,32.0045,park,[hole]),false);
  assert.equal(cellInsidePark(39.001,39.002,32.001,32.002,park,[hole]),true);
});
