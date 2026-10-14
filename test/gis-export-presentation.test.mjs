import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const window={};vm.runInNewContext(load('src/ui/gis-export-presentation.js'),{window});
const api=window.DG_GIS_EXPORT_PRESENTATION;
test('classes use late-loaded data and preserve the empty-list distinction',()=>{
 let current;const read=()=>current;
 assert.equal(api.classes(read).green.color,'#4ade80');
 current=[{key:'water',label:'Lake',color:'#123456',area:99}];
 assert.equal(api.classes(read).water.label,'Lake');
 assert.deepEqual(Object.keys(api.classes(read).water),['color','label']);
 assert.equal(current[0].area,99);
 current=[];assert.equal(Object.keys(api.classes(read)).length,0);
});
test('color priority remains surface, vegetation, landcover, legacy fallback',()=>{
 const inputs={surfaceColors:{water:'#111111'},vegetationColors:{water:'#222222'},classes:{water:{color:'#333333'}}};
 assert.equal(api.color('water',inputs),'#111111');
 inputs.surfaceColors=null;assert.equal(api.color('water',inputs),'#222222');
 inputs.vegetationColors=null;assert.equal(api.color('water',inputs),'#333333');
 assert.equal(api.color('pool',inputs),'#3b82f6');assert.equal(api.color('unknown',inputs),'#94a3b8');
});
test('file names stay bounded and area text uses Turkish formatting',()=>{
 assert.equal(api.safeName('Göksu Parkı'),'goksu_park_');assert.equal(api.safeName(null),'park');
 assert.equal(api.safeName('a'.repeat(80)).length,48);assert.equal(api.safeName('../park/name'),'_park_name');
 assert.equal(api.format(1234.567),'1.234,57');
});
test('presentation rules load before the adapter and are precached',()=>{
 const html=load('index.html');assert.ok(html.indexOf('src/ui/gis-export-presentation.js')<html.indexOf('src/ui/gis-export.js'));
 assert.match(html,/src\/ui\/gis-export-presentation\.js\?v=[a-f0-9]{8}/);
 assert.match(load('sw.js'),/\/src\/ui\/gis-export-presentation\.js/);
});
