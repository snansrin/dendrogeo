import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {collectRuntimeModules,isCriticalRuntimeModule} from '../scripts/lib/runtime-module-inventory.mjs';
import {validateRuntimeModules} from '../scripts/lib/validate-runtime-modules.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('current scientific engines, species inputs and map tools are hash protected',()=>{
 const manifest=JSON.parse(read('docs/core-foundation-lock.json')),inventory=collectRuntimeModules(fileURLToPath(new URL('..',import.meta.url)));
 for(const path of inventory.physical.filter(isCriticalRuntimeModule))assert.ok(Object.hasOwn(manifest.sha256,path),path);
 for(const path of ['src/config/species.js','src/config/wood-density-lock.js','src/config/measurement-protocol-lock.js','src/services/allometry.js','src/services/park-query.js','src/services/grid-engine.js','src/ui/park-menu-ui.js','src/ui/render-verified-surface-map-export.js','src/ui/gis-workspace.js','scripts/grid-menu-smoke.mjs','.githooks/pre-push'])assert.ok(Object.hasOwn(manifest.sha256,path),path);
});

test('new GIS tools cannot enter the runtime without a protected hash',()=>{
 const path='src/ui/gis-unlocked-tool.js';
 const result=validateRuntimeModules({physical:[path],loaded:new Set([path]),initial:[path],lazy:[],dependencies:new Set(),exists:()=>true,protected:new Set()},new Set([path]));
 assert.ok(result.errors.some(error=>error.includes('hash kilidinde değil')));
});

test('push hook runs the same pinned core verifier used by CI',()=>{
 assert.match(read('.githooks/pre-push'),/set -eu\nnode scripts\/check-core-foundation\.mjs/);
 assert.match(read('scripts/install-core-guard.mjs'),/Existing Git hooks path is preserved/);
 assert.equal(JSON.parse(read('package.json')).scripts['core:lock'],'node scripts/install-core-guard.mjs');
});
