import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/contracts/surface-review.js',import.meta.url),'utf8');
const store=readFileSync(new URL('../src/adapters/surface/review-store.js',import.meta.url),'utf8');
const geometry=readFileSync(new URL('../src/domain/surface/review-geometry.js',import.meta.url),'utf8');
const service=readFileSync(new URL('../src/services/lc-review.js',import.meta.url),'utf8');
function api(){const window={};vm.runInContext(source,vm.createContext({window}));return window.DG_SURFACE_REVIEW_CONTRACTS;}

test('review ring contract accepts bounded coordinates and rejects self-crossing rings',()=>{
  const c=api();
  assert.equal(c.isValidRing([[0,0],[1,0],[1,1],[0,1]]),true);
  assert.equal(c.isValidRing([[0,0],[1,1],[0,1],[1,0]]),false);
  assert.equal(c.isValidRing([[0,0],[181,0],[0,1]]),false);
  assert.equal(c.isValidRing([[0,0],[1,0]]),false);
});

test('review feature contract preserves accepted classes and validates polygon rings',()=>{
  const c=api(),ring=[[0,0],[1,0],[1,1],[0,1],[0,0]];
  assert.deepEqual(Object.keys(c.types),['green','hard','building','water','pool','bare','other']);
  assert.equal(c.isValidFeature({type:'water',ring:ring.slice(0,-1)}),true);
  assert.equal(c.isValidFeature({type:'unknown',ring}),false);
  assert.equal(c.isValidFeature({type:'water',geometry:{type:'MultiPolygon',coordinates:[[[...ring]]]}}),true);
  assert.equal(c.isValidFeature({type:'water',geometry:{type:'MultiPolygon',coordinates:[[[[0,0],[1,0],[1,1],[0,1]]]]}}),false);
  assert.equal(c.isValidFeature({type:'water',geometry:{type:'Polygon',coordinates:[ring]}}),false);
});

test('review service compatibility methods delegate to the contract module',()=>{
  const window={};const ctx=vm.createContext({window});
  vm.runInContext(source,ctx);
  vm.runInContext(store,ctx);
  vm.runInContext(geometry,ctx);
  vm.runInContext(service,ctx);
  assert.equal(window.DG_SURFACE_REVIEW.validRing([[0,0],[1,0],[1,1]]),true);
  assert.equal(window.DG_SURFACE_REVIEW.validFeature({type:'water',ring:[[0,0],[1,0],[1,1]]}),true);
  assert.equal(window.DG_SURFACE_REVIEW.types,window.DG_SURFACE_REVIEW_CONTRACTS.types);
  assert.ok(Object.isFrozen(window.DG_SURFACE_REVIEW_CONTRACTS.types));
});
