import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=file('index.html');
const boot=file('partials/boot.html');
const css=file('css/gis-workspace.css');
const shell=file('partials/shell.html');
const park=file('src/ui/park-panel.js');
const dashboard=file('src/services/dash.js');
const lock=JSON.parse(file('docs/surface-engine-lock.json'));

test('GIS UX lives outside the 33 locked analysis files',()=>{
 for(const path of ['partials/head.html','partials/boot.html','css/gis-workspace.css','docs/GIS-WORKSPACE-2026-10-08.md']){
  assert.ok(!lock.locked_files[path],'Locked file touched: '+path);
 }
 assert.ok(lock.locked_files['src/ui/lc-sens.js']);
 assert.ok(lock.locked_files['src/services/lc-engine.js']);
});

test('new presentation script parses as a classic browser script',()=>{
 const script=boot.match(/<script id="dg-gis-workspace">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'Workspace inline script missing');
 assert.doesNotThrow(()=>new vm.Script(script));
 assert.match(html,/id="dg-gis-workspace"/);
 assert.match(html,/css\/gis-workspace\.css\?v=[a-f0-9]{8}/);
});

test('original Grid, layer and PNG IDs and functions remain wired',()=>{
 for(const id of ['parkGridTools','parkLayerTools','parkRasterExport','gridProject','gridSize','gridClearance','pngBg','chkPngGrid','chkPngWp','chkPngCover','togGrid','togWp']){
  assert.match(park,new RegExp('id="'+id+'"'));
 }
 assert.match(park,/onclick="buildGrid\(\)"/);
 assert.match(park,/onclick="downloadParkImage\(\)"/);
 assert.match(boot,/body\.append\(output\)/,'Original export node is moved, not duplicated');
 assert.match(boot,/section\.append\(pngOpts\)/,'Original checkbox group is moved');
 assert.doesNotMatch(boot,/cloneNode\(/);
 assert.match(shell,/id="surfaceMenuBar"/);
});

test('six-species card remains backed by existing approved record render',()=>{
 assert.match(dashboard,/En Yaygın 6 Tür/);
 assert.match(dashboard,/topSpecies\.map/);
 assert.match(boot,/En Yaygın 6 Tür/);
 assert.match(boot,/exportSpecies\(heading,button\)/);
 assert.match(boot,/canvas\.toBlob/);
 assert.doesNotMatch(boot,/sb\.from\(/,'PNG addition must not alter or re-query approved record data');
});

test('new styles reuse tokens, preserve original button colors and narrow screens',()=>{
 assert.match(css,/#v-map #surfaceMenuBar/);
 assert.match(css,/var\(--green\)/);
 assert.match(css,/var\(--line\)/);
 assert.match(css,/@media \(max-width:640px\)/);
 assert.doesNotMatch(css,/\.dg-png-btn\.primary\s*\{/,'Do not override existing button theme');
});
