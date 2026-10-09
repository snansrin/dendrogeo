import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {canonicalHash} from '../scripts/lib/canonical-hash.mjs';
import {canonicalHash as legacyCanonicalHash} from '../scripts/lib/mc.mjs';

test('canonical SHA-256 uses stable JSON key order and a fixed digest vector',()=>{
 const expected='43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777';
 assert.equal(canonicalHash({b:2,a:1}),expected);
 assert.equal(canonicalHash({a:1,b:2}),expected);
 assert.notEqual(canonicalHash({a:[1,2]}),canonicalHash({a:[2,1]}),'array order remains meaningful');
});

test('hash is independent of VM realm and legacy Monte Carlo import remains compatible',()=>{
 const foreign=vm.runInNewContext('({nested:{z:3,y:2},list:[1,2]})');
 const local={list:[1,2],nested:{y:2,z:3}};
 assert.equal(canonicalHash(foreign),canonicalHash(local));
 assert.equal(legacyCanonicalHash(local),canonicalHash(local));
});

test('report publishing consumers depend on the integrity helper directly',()=>{
 for(const path of ['scripts/make-report.mjs','scripts/publish-queue.mjs','scripts/prepare-report-doi.mjs','scripts/register-doi.mjs','scripts/render-report-pdf.mjs']){
  const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(source,/canonical-hash\.mjs/,path);
  assert.doesNotMatch(source,/canonicalHash[^\n]*lib\/mc\.mjs/,path+' should not couple integrity to statistics');
 }
});
