import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
for(const path of [
  '../src/domain/parks/point-in-polygon.js',
  '../src/domain/parks/segment-intersection.js',
  '../src/domain/parks/park-containment.js',
  '../src/domain/parks/park-overlap.js'
]) vm.runInContext(readFileSync(new URL(path,import.meta.url),'utf8'),context);
const {ringTouchesPark,lineTouchesPark,segmentsIntersectLatLon}=context.window.DG_PARK_OVERLAP;
const park=[[[39,32],[39,32.01],[39.01,32.01],[39.01,32],[39,32]]];
const bounds={minLat:39,minLon:32,maxLat:39.01,maxLon:32.01};

test('ring and line candidates overlap when contained or crossing the park boundary',()=>{
  assert.equal(ringTouchesPark([[39.002,32.002],[39.002,32.004],[39.004,32.004],[39.002,32.002]],park,bounds),true);
  assert.equal(ringTouchesPark([[38.999,32.004],[39.001,32.004],[39.001,32.006],[38.999,32.004]],park,bounds),true);
  assert.equal(lineTouchesPark([[38.999,32.005],[39.011,32.005]],park,bounds),true);
  assert.equal(ringTouchesPark([[39.02,32.02],[39.02,32.03],[39.03,32.03]],park,bounds),false);
  assert.equal(lineTouchesPark([[39.02,32.02],[39.03,32.03]],park,bounds),false);
  assert.equal(ringTouchesPark(null,park,bounds),false);
  assert.equal(lineTouchesPark([],park,bounds),false);
});

test('lat-lon segment projection preserves crossing and disjoint decisions',()=>{
  assert.equal(segmentsIntersectLatLon([39,32],[39.01,32.01],[39,32.01],[39.01,32]),true);
  assert.equal(segmentsIntersectLatLon([39,32],[39.01,32],[39.02,32],[39.03,32]),false);
});
