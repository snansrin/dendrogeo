import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyCoreFoundation} from '../scripts/check-core-foundation.mjs';

test('measurement, park detection, park analysis and live map remain within the authorized foundation',()=>{
  const result=verifyCoreFoundation();
  assert.deepEqual(result.errors,[]);
  assert.ok(result.checked>=250,`expected broad immutable baseline, checked ${result.checked}`);
});

test('authorized modularization history records scoped, hash-linked changes',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../docs/core-foundation-lock.json',import.meta.url),'utf8'));
  assert.ok(manifest.authorized_modularizations.length,'missing authorized migration history');
  for(const migration of manifest.authorized_modularizations){
    assert.ok(migration.date&&(migration.scope||migration.request),'incomplete migration record');
    for(const file of migration.files||[]){
      if(migration.audit_chain==='sha256-v1')
        assert.ok(Object.hasOwn(manifest.sha256,file.path),`new chained path is outside baseline: ${file.path}`);
      assert.match(file.sha256,/^[a-f0-9]{64}$/,`invalid migration hash: ${file.path}`);
      if(file.previous_sha256!==undefined&&file.previous_sha256!==null)
        assert.match(file.previous_sha256,/^[a-f0-9]{64}$/,`invalid previous hash: ${file.path}`);
    }
  }
  const current=manifest.authorized_modularizations.at(-1);
  assert.equal(current.audit_chain,'sha256-v1');
  assert.match(current.scope,/user-authorized (?:modularization|release follow-up)/i);
  assert.ok(current.files.length>0);
  assert.ok(current.files.every(file=>/^[a-f0-9]{64}$/.test(file.previous_sha256||'')),
    'latest migration must link every change to its previous hash');
});

test('foundation manifest names the current baseline and additive-only policy',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../docs/core-foundation-lock.json',import.meta.url),'utf8'));
  assert.equal(manifest.baseline_commit,'867c7566645b43cf7a5a7caf56bac6c44c39ef79');
  assert.equal(manifest.policy,'FROZEN_EXISTING_FILES_ADD_ONLY');
  for(const category of ['measurement','park_detection','park_analysis','live_map'])
    assert.ok(manifest.categories[category]?.length,`missing ${category} protected files`);
});
