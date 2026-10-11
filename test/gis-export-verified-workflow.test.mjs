import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');const window={};vm.runInNewContext(load('src/ui/gis-export-verified-workflow.js'),{window});
function fixture(overrides={}){
 const calls=[],notices=[],record={parkName:'Park',acceptedAt:'2026-10-11'},areas={green:100},layers=[{}];let output,download;
 const input={platform:{notify:(...a)=>notices.push(a),canvas:(w,h)=>{calls.push(['canvas',w,h]);return {canvas:{},context:{}};}},sources:{verified:()=>({})},presentation:{format:String,safeName:()=> 'park',color:()=> 'green'},classes:()=>({}),outline:()=>{},
  waitVegetation:async(sens,attempts)=>{calls.push(['vegetation',attempts]);return layers;},prepare:()=>({ok:true,tiers:{count:3}}),computeLayout:()=>({CW:1240,CH:1560}),
  drawCanvas:args=>{output=args;calls.push(['draw']);return {ok:true};},save:async args=>{download=args;calls.push(['save']);return true;},
  getSensitivity:()=>({record,vegetationView:true,rawView:false}),getParkName:()=> 'Fallback',getParkRings:()=>[[[1,2],[3,4],[5,6]]],getTiersFunction:()=>null,getEditSummary:()=>({total:1}),getFeatureCount:()=>0,getAreas:()=>areas,getHoles:()=>[],getCanvasApi:()=>({}),getSurfaceColors:()=>null,getVegetationColors:()=>null,...overrides};
 return {api:window.DG_GIS_EXPORT_VERIFIED_WORKFLOW.create(input),calls,notices,record,areas,layers,get output(){return output;},get download(){return download;}};
}
test('publication gate failure stops before waiting, drawing or download',async()=>{
 const f=fixture({prepare:()=>({ok:false,message:'blocked',type:'warn'})});assert.equal(await f.api.renderVerified({surface:true}),false);assert.deepEqual(f.calls,[]);assert.deepEqual(f.notices,[['blocked','warn']]);
});
test('missing NDVI layers stop before Canvas and download',async()=>{
 const f=fixture({waitVegetation:async()=>[]});assert.equal(await f.api.renderVerified({surface:true}),false);assert.deepEqual(f.calls,[]);assert.match(f.notices[0][0],/NDVI katmanı/);
});
test('unverified surface is blocked without fabricating decisions',async()=>{
 const f=fixture({getSensitivity:()=>({record:{},vegetationView:true}),getEditSummary:()=>null});
 assert.equal(await f.api.renderVerified({surface:true}),false);assert.deepEqual(f.calls,[['vegetation',30]]);assert.match(f.notices[0][0],/doğrulayıp kaydedin/);
});
test('missing accepted areas stops before Canvas allocation',async()=>{
 const f=fixture({getAreas:()=>null});assert.equal(await f.api.renderVerified({surface:true}),false);assert.deepEqual(f.calls,[['vegetation',30]]);assert.match(f.notices[0][0],/alan verileri/);
});
test('renderer refusal prevents downloading an incomplete verified map',async()=>{
 const f=fixture({drawCanvas:()=>({ok:false,message:'no geometry'})});assert.equal(await f.api.renderVerified({surface:true}),false);assert.ok(!f.calls.some(x=>x[0]==='save'));assert.deepEqual(f.notices,[['no geometry','warn']]);
});
test('verified workflow keeps official size, layers, accepted values and filename',async()=>{
 const f=fixture(),selection={surface:true,park:true,grid:false,waypoints:false};assert.equal(await f.api.renderVerified(selection),true);
 assert.deepEqual(f.calls,[['vegetation',30],['canvas',1240,1560],['draw'],['save']]);assert.equal(f.output.layers,selection);assert.equal(f.output.record,f.record);assert.equal(f.output.areas,f.areas);assert.equal(f.output.ndviPolys,f.layers);
 assert.equal(f.download.filename,'dendrogeo_dogrulanmis_harita_park_goreli_ndvi.png');assert.deepEqual(f.areas,{green:100});
});
test('verified workflow loads before the adapter and is precached',()=>{
 const html=load('index.html');assert.ok(html.indexOf('src/ui/gis-export-verified-workflow.js')<html.indexOf('src/ui/gis-export.js'));
 assert.match(html,/src\/ui\/gis-export-verified-workflow\.js\?v=[a-f0-9]{8}/);assert.match(load('sw.js'),/\/src\/ui\/gis-export-verified-workflow\.js/);
});
