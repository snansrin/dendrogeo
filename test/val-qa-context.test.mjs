import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../scripts/val-qa.mjs',import.meta.url),'utf8');

test('live QA passes the selected Sentinel period into its isolated VM context',()=>{
  assert.match(source,/const ctx = \{[\s\S]*?\bS2_MODE,\s*window: null/);
});
