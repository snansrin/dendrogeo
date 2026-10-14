import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function setup(paths){const window={};const context=vm.createContext({window,Math,Number,String,Object,Array,Promise});for(const path of paths)vm.runInContext(read(path),context,{filename:path});return window;}

test('legacy pool areas and review parts are reported only as water',()=>{
 const w=setup(['src/domain/surface/summarize-surface-review-parts.js']);
 const areas=w.DG_SUMMARIZE_SURFACE_REVIEW_PARTS.summarize({water:10,pool:4},[{key:'1:2',cell:{classKey:'pool',areaM2:4},type:'water',areaM2:4}]);
 assert.deepEqual(JSON.parse(JSON.stringify(areas)),{green:0,hard:0,building:0,water:14,bare:0,other:0});
});

test('surface boundary menu, review disclosure, and scan status expose water without a pool choice',()=>{
 const w=setup(['src/ui/render-surface-editor-menus.js','src/ui/render-surface-review-actions.js','src/domain/surface/build-surface-scan-summary.js']);
 const types={building:{label:'Bina'},hard:{label:'Sert zemin'},water:{label:'Su'},green:{label:'Yeşil alan'},bare:{label:'Çıplak zemin'},pool:{label:'Su'}};
 const menu=w.DG_RENDER_SURFACE_EDITOR_MENUS.render({record:{features:[],useObjects:true,period:'ytd'},model:{disabled:false,viewDisabled:false,rawView:false,brush:null,base:'osm',drawType:'water',objectPick:false,objectPreview:null,activeType:'water',brushDiameter:10},types,menuLabel:(_icon,label)=>label,panelHead:(_icon,title)=>title,translate:value=>value,escape:value=>value});
 assert.doesNotMatch(menu,/value="pool"|Havuz|süs havuzu/);
 const actions=w.DG_RENDER_SURFACE_REVIEW_ACTIONS.render({record:{objectFeatures:[]},disabled:false,rawView:false,brush:null,showCandidates:false,translate:value=>value,escape:value=>value});
 assert.match(actions,/OSM bina, yol ve su/);assert.doesNotMatch(actions,/havuz/i);
 const status=w.DG_BUILD_SURFACE_SCAN_SUMMARY.build({audit:{profiled:0,total:0,transitions:[]},autoWater:2,hasWaterFootprint:false,unresolvedWater:0,format:value=>value});
 assert.match(status,/bina, yol ve su/);assert.doesNotMatch(status,/havuz/i);
});
