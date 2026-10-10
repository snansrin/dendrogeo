import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/domain/parks/road-half-width.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const halfWidth=highway=>context.window.DG_PARK_ROAD_WIDTH.halfWidth(highway);

test('road classes retain their established default half-widths',()=>{
  for(const [highway,width] of [
    ['motorway',6],['trunk',5.5],['primary',5],['secondary',4.5],['tertiary',4],
    ['residential',3],['unclassified',3],['living_street',3],['service',2.5],
    ['footway',1.25],['path',1.25],['cycleway',1.5],['pedestrian',2],
    ['steps',1.25],['bridleway',1.25],['track',1.5]
  ])assert.equal(halfWidth(highway),width,highway);
});

test('fallback remains case-insensitive and unknown values retain the three-metre buffer',()=>{
  assert.equal(halfWidth('FoOtWaY'),1.25);
  for(const highway of [undefined,null,'','footway ','unknown'])assert.equal(halfWidth(highway),3,String(highway));
});
