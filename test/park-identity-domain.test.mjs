import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/domain/parks/identity.js',import.meta.url),'utf8'),context);
const identity=context.window.DG_PARK_IDENTITY;

test('park identity domain is standalone and immutable',()=>{
  assert.ok(Object.isFrozen(identity));
  assert.equal(identity.normalizeName('İSTANBUL'),identity.normalizeName('istanbul'));
  assert.equal(identity.normalizeLooseName('Göksu Parkı'),'goksu');
  assert.equal(identity.osmKey('RELATION','42'),'relation/42');
  assert.equal(identity.manualKey('Göksu Parkı',40.1234,29.9876),'manual/goksu parki/40.123/29.988');
});

test('project labels, park matching radius and ring center keep existing rules',()=>{
  assert.equal(identity.projectName('Göksu Parkı','kuzey'),'Göksu Parkı - kuzey');
  assert.equal(identity.labelFromLegacy('Göksu Parkı — kuzey','Göksu Parkı'),'kuzey');
  assert.equal(identity.matchRadius(500000),Math.sqrt(500000));
  assert.deepEqual(JSON.parse(JSON.stringify(identity.centerFromRings([[[39.9,32.6],[40,32.7]]]))),{lat:39.95,lon:32.65});
});
