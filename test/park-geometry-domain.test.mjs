import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/domain/parks/simplify-ring.js',import.meta.url),'utf8'),context);
const simplifyRing=context.window.DG_PARK_RING_DOMAIN.simplifyRing;

test('park ring simplification is deterministic and keeps the exact point cap plus closure',()=>{
  const ring=Array.from({length:1200},(_,i)=>[i,i+1]);
  const reduced=simplifyRing(ring,500);
  assert.equal(reduced.length,501);
  assert.deepEqual(JSON.parse(JSON.stringify(reduced[0])),[0,1]);
  assert.deepEqual(JSON.parse(JSON.stringify(reduced.at(-1))),[0,1]);
  assert.deepEqual(JSON.parse(JSON.stringify(reduced)),JSON.parse(JSON.stringify(simplifyRing(ring,500))));
});

test('small rings and invalid inputs pass through unchanged',()=>{
  const ring=[[1,2],[3,4],[5,6]];
  assert.equal(simplifyRing(ring,500),ring);
  assert.equal(simplifyRing(null,500),null);
  assert.equal(simplifyRing(ring,2),ring);
});
