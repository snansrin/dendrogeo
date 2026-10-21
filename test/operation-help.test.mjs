import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const window={};vm.runInNewContext(read('src/ui/operation-help-content.js'),{window});
const content=window.DG_OPERATION_HELP_CONTENT;

test('each operation guide provides short Turkish and English instructions',()=>{
 assert.ok(content.keys.length>=50);
 for(const key of content.keys)for(const lang of ['tr','en']){
  const entry=content.get(key,lang);assert.ok(entry.title);assert.ok(entry.steps.length>=2&&entry.steps.length<=4,key);
  for(const step of entry.steps)assert.ok(step.length>12,key);
 }
});
test('grid controls, requests, backups, maps and measurement actions resolve to the relevant instructions',()=>{
 const cases=[
  [{id:'gridSize'},'gridSize'],[{id:'refHa'},'reference'],[{id:'chkGreenOnly'},'greenOnly'],[{id:'gridClearance'},'clearance'],
  [{attributes:{'data-grid-summary-action':'createAuto'}},'autoPoints'],[{attributes:{'data-grid-summary-action':'createManual'}},'selectedPoints'],
  [{attributes:{'data-grid-summary-action':'downloadCsv'}},'pointsCsv'],[{attributes:{'data-grid-summary-action':'downloadGeoJson'}},'gridGeojson'],
  [{attributes:{'data-dg-click':'accept'}},'accept'],[{attributes:{'data-dg-click':'brushToggle'}},'brush'],[{attributes:{'data-dg-click':'drawStart'}},'boundary'],
  [{attributes:{'data-pending-request-action':'fulfill'}},'reply'],[{attributes:{'data-dg-data-request-action':'submit'}},'request'],
  [{attributes:{'data-dg-backup-action':'restore-file'}},'restore'],[{attributes:{'data-dg-measure-action':'save'}},'measure'],
  [{attributes:{'data-user-publication-action':'retract'}},'withdraw'],[{view:'v-users'},'users']
 ];for(const [input,key]of cases)assert.equal(content.resolve(input),key);
});
test('CSV help distinguishes exported points from grid polygons and the import column order',()=>{
 const download=content.get('pointsCsv').steps.join(' '),upload=content.get('pointUpload').steps.join(' ');
 assert.match(download,/wp_id,lat,lon,visited/);assert.match(download,/Grid karelerini indirmez/);assert.match(download,/X,Y,id/);
 assert.match(upload,/X boylam, Y enlem/);assert.match(upload,/WGS84/);
 assert.match(content.get('reference').steps.join(' '),/ölçeklemez/);
 assert.match(content.get('reply').steps.join(' '),/kendiniz ekleyip gönderin/);
});
test('help UI has no data/API or calculation dependencies and does not invoke source actions',()=>{
 for(const file of ['src/ui/operation-help-content.js','src/ui/operation-help.js']){
  const source=read(file);
  assert.doesNotMatch(source,/\bfetch\s*\(|\b(?:sb|client)\.(?:from|rpc|storage|auth)\b|\.dispatchEvent\s*\(|\b(?:buildGrid|runLandCoverAnalysis|createGridWaypoints|saveMeasurement)\s*\(/);
 }
 const source=read('src/ui/operation-help.js');assert.doesNotMatch(source,/control\.(?:click|value)\s*[=(]/);assert.match(source,/type='button'/);
 assert.match(source,/stopPropagation\(\)/);assert.match(source,/textContent=step/);
});
test('help modules and stylesheet are included in the page and offline asset chain',()=>{
 const boot=read('partials/boot.html'),head=read('partials/head.html'),sw=read('sw.js');
 for(const path of ['src/ui/operation-help-content.js','src/ui/operation-help.js']){assert.ok(boot.includes(path));assert.ok(sw.includes('/'+path));}
 assert.ok(head.includes('css/operation-help.css'));assert.ok(sw.includes('/css/operation-help.css'));
});
