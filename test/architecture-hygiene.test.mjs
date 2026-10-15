import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {renderRuntimePrecache} from '../scripts/sync-runtime-precache.mjs';
import {collectRuntimeModules} from '../scripts/lib/runtime-module-inventory.mjs';
import {collectRuntimePrecache} from '../scripts/lib/runtime-precache-inventory.mjs';
import {collectGeneratedMarkupHandlers,compareGeneratedMarkupHandlers} from '../scripts/lib/generated-markup-handlers.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');

test('Service Worker runtime cache manifest is generated from the page and lazy module graph',()=>{
  const source=readFileSync(join(root,'sw.js'),'utf8');
  assert.equal(renderRuntimePrecache(source,root),source);
  const runtime=collectRuntimeModules(root),precache=collectRuntimePrecache(root);
  for(const path of runtime.loaded)assert.ok(precache.has(path),`${path} must be offline cached`);
  assert.ok(source.includes("'/css/style.css'"),'non-module core assets remain in the Service Worker list');
});

test('generated markup event handlers do not exceed the reviewed migration baseline',()=>{
  const current=collectGeneratedMarkupHandlers(root);
  const baseline=JSON.parse(readFileSync(join(root,'docs/generated-markup-handler-baseline.json'),'utf8'));
  assert.deepEqual(compareGeneratedMarkupHandlers(current,baseline).errors,[]);
  assert.equal(current.total,0,'all generated markup actions must be owned by delegated UI modules');
  assert.deepEqual(current.files,{},'no source file should retain generated markup handlers');
});
