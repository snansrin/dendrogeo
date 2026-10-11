import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyCoreFoundation} from '../scripts/check-core-foundation.mjs';

test('measurement, park detection, park analysis and live map baseline stays byte-identical',()=>{
  const result=verifyCoreFoundation();
  assert.deepEqual(result.errors,[]);
  assert.ok(result.checked>=250,`expected broad immutable baseline, checked ${result.checked}`);
});

test('foundation manifest names the current baseline and additive-only policy',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../docs/core-foundation-lock.json',import.meta.url),'utf8'));
  assert.equal(manifest.baseline_commit,'867c7566645b43cf7a5a7caf56bac6c44c39ef79');
  assert.equal(manifest.policy,'FROZEN_EXISTING_FILES_ADD_ONLY');
  for(const category of ['measurement','park_detection','park_analysis','live_map'])
    assert.ok(manifest.categories[category]?.length,`missing ${category} protected files`);
});
