import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/domain/parks/area.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const {ringGeodesicArea,polyArea}=context.window.DG_PARK_AREA;

test('domain area retains the 6378137 m spherical ring formula and coordinate order',()=>{
  const ring=[[32,39],[33,39],[33,40],[32,40]];
  const area=ringGeodesicArea(ring);
  assert.ok(area>10.4e9&&area<10.5e9,`unexpected one-degree park area: ${area}`);
  assert.equal(ringGeodesicArea([[0,0],[1,1]]),0);
});

test('polygon area sums rings or subtracts holes and clamps negative results',()=>{
  const outer=[[32,39],[33,39],[33,40],[32,40]];
  const hole=[[32.2,39.2],[32.8,39.2],[32.8,39.8],[32.2,39.8]];
  assert.equal(polyArea([outer]),ringGeodesicArea(outer));
  assert.equal(polyArea({outer:[outer],inner:[hole]}),ringGeodesicArea(outer)-ringGeodesicArea(hole));
  assert.equal(polyArea({outer:[hole],inner:[outer]}),0);
  assert.equal(polyArea(null),0);
});
