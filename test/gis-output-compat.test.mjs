import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('src/ui/gis-export-compat.js'),css=read('css/gis-workspace.css'),boot=read('partials/boot.html');
const lock=JSON.parse(read('docs/surface-engine-lock.json'));
test('frozen surface analysis and original PNG backend remain checksum-locked',()=>{
 assert.equal(Object.keys(lock.locked_files).length,51);
 assert.ok(lock.locked_files['src/ui/park-export.js']);
 assert.ok(lock.locked_files['src/ui/lc-sens.js']);
 assert.ok(!lock.locked_files['src/ui/gis-export-compat.js']);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.doesNotMatch(js,/dgSensSave\(|dgSensDecide\(|dgSensScan\(|DG_LC_LAST\s*=|\.from\(['"]surface_/);
});
test('lazy raster classification lookup is adapted safely, without modifying its function call',()=>{
 const handlers={};
 const sandbox={window:{},document:{addEventListener(type,fn){handlers[type]=fn;}},console};
 vm.createContext(sandbox);
 vm.runInContext('const DG_LC_CLASSES_SAF=function runLandCoverAnalysis() {return 42;};',sandbox);
 vm.runInContext(js,sandbox);
 assert.equal(vm.runInContext('DG_LC_CLASSES_SAF()',sandbox),42);
 assert.equal(vm.runInContext('DG_LC_CLASSES_SAF.find(c=>c.key==="water")',sandbox),undefined);
 vm.runInContext('const DG_LC_CLASSES=[{key:"green",color:"#123"},{key:"water",color:"#abc"}];',sandbox);
 assert.equal(vm.runInContext('DG_LC_CLASSES_SAF.find(c=>c.key==="water").color',sandbox),'#abc');
 assert.equal(typeof handlers.click,'function');
});
test('verified export uses active vegetation terciles and only eligible cells',()=>{
 for(const marker of ['dgSensVegetationTiers()','tiers.count<9','DG_SENS.geometry[key]','DG_SENS_VEGETATION_COLORS','dgSensVisualResult(parts)','feature.geometry','event.stopImmediatePropagation()'])
  assert.ok(js.includes(marker),marker);
 assert.match(js,/if\(!layers\.surface\)return;/);
 assert.match(js,/if\(!tiers\)[\s\S]*Normal harita indiriliyor/);
 assert.match(js,/GÖRELİ NDVI/);
 assert.match(js,/Alan hesapları değiştirilmedi/);
 assert.doesNotMatch(read('src/ui/park-export.js'),/dgSensVegetationTiers/);
});
test('mobile layout and toast notification stacking are explicit',()=>{
 assert.match(css,/#toastWrap\s*\{\s*z-index:2400/);
 assert.match(css,/@media \(max-width:700px\)/);
 assert.match(css,/#v-map #parkInfo #parkSurfaceAction>\.dg-png-sub:last-child/);
 assert.match(css,/#v-map #landCoverReport > div\[style\*="border:1px"\]/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto/);
 assert.match(css,/overflow-wrap:anywhere/);
});
test('compatibility asset is loaded and precached exactly once',()=>{
 assert.equal((boot.match(/src\/ui\/gis-export-compat\.js/g)||[]).length,1);
 assert.match(read('sw.js'),/\/src\/ui\/gis-export-compat\.js/);
 assert.match(read('index.html'),/src\/ui\/gis-export-compat\.js\?v=[a-f0-9]{8}/);
});
