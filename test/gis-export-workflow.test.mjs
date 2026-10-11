import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');const window={};vm.runInNewContext(load('src/ui/gis-export-workflow.js'),{window});
function fixture(overrides={}){
 const calls=[],notices=[],rings=[[[1,2],[3,4],[5,6]]],context={},canvas={};let drawInput,saveInput;
 const input={platform:{notify:(...a)=>notices.push(a),options:()=>({cover:true,grid:false,wp:false}),canvas:()=>{calls.push('canvas');return {canvas,context};}},
  sources:{standard:()=>({})},classes:()=>({water:{color:'blue'}}),outline:()=>{},waitVegetation:async()=>{calls.push('vegetation');return [{}];},
  presentation:{format:String,safeName:()=> 'park'},getLayoutApi:()=>({compute:()=>{calls.push('layout');return {W:1200,H:900};}}),getGeometryApi:()=>({project:()=>{}}),getCanvasApi:()=>({}),
  draw:args=>{calls.push('draw');drawInput=args;return {count:1};},save:async args=>{calls.push('save');saveInput=args;return true;},
  getParkRings:()=>rings,getSensitivity:()=>({vegetationView:false}),getTiersFunction:()=>null,getHoles:()=>[],getParkName:()=> 'Park',getVegetationColors:()=>({}),...overrides};
 const api=window.DG_GIS_EXPORT_WORKFLOW.create(input);return {api,input,calls,notices,rings,canvas,get drawInput(){return drawInput;},get saveInput(){return saveInput;}};
}
test('missing park stops before Canvas or download',async()=>{
 const f=fixture({getParkRings:()=>undefined});assert.equal(await f.api.render(),false);assert.deepEqual(f.calls,[]);assert.equal(f.notices[0][0],'Önce bir park seçin.');
});
test('missing NDVI layers stop before layout and download',async()=>{
 const f=fixture({getSensitivity:()=>({vegetationView:true,rawView:false}),waitVegetation:async()=>[]});assert.equal(await f.api.render(),false);assert.deepEqual(f.calls,[]);assert.match(f.notices[0][0],/en az 3 gözlemli/);
});
test('ordinary PNG keeps ordering, layer inputs and file suffix',async()=>{
 const f=fixture();assert.equal(await f.api.render(),true);assert.deepEqual(f.calls,['layout','canvas','draw','save']);
 assert.equal(f.drawInput.parkRings,f.rings);assert.equal(f.drawInput.options.grid,false);assert.equal(f.saveInput.canvas,f.canvas);
 assert.match(f.saveInput.filename,/^dendrogeo_park_dogrulanmis_harita_\d{4}-\d{2}-\d{2}\.png$/);
});
test('NDVI waits for real layers and permits a vegetation-only PNG',async()=>{
 const layers=[{}],sens={vegetationView:true,rawView:false};let input;
 const f=fixture({getSensitivity:()=>sens,waitVegetation:async state=>{assert.equal(state,sens);return layers;},draw:value=>{input=value;return {count:0};}});
 assert.equal(await f.api.render(),true);assert.equal(input.ndviPolys,layers);assert.equal(input.ndvi,true);assert.match(f.saveInput.filename,/_goreli_ndvi_/);
});
test('empty surface stops the ordinary PNG download',async()=>{
 const f=fixture({draw:()=>({count:0})});assert.equal(await f.api.render(),false);assert.ok(!f.calls.includes('save'));assert.match(f.notices[0][0],/yüzey geometrisi/);
});
test('workflow is loaded before the adapter and precached',()=>{
 const html=load('index.html');assert.ok(html.indexOf('src/ui/gis-export-workflow.js')<html.indexOf('src/ui/gis-export.js'));
 assert.match(html,/src\/ui\/gis-export-workflow\.js\?v=[a-f0-9]{8}/);assert.match(load('sw.js'),/\/src\/ui\/gis-export-workflow\.js/);
});
