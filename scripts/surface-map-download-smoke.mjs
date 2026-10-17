import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const input=JSON.parse(gunzipSync(readFileSync(new URL('../test/fixtures/harikalar-grid-surface.json.gz',import.meta.url))));
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});await isolateAccount(page);await page.goto(server.url);
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await page.evaluate(async()=>{await dgEnsureLulc();});
 for(const accepted of [false,true]){
  const pending=page.waitForEvent('download');
  const result=await page.evaluate(async({input,accepted})=>{
   const state={epoch:1,epsg:input.epsg,geometry:{},editing:!accepted,exporting:false},record={acceptedAt:accepted?'2026-10-17T00:00:00Z':null,corrections:{},features:[]},before=JSON.stringify(record),notices=[];
   const areas={};for(const p of input.parts)areas[p.type]=(areas[p.type]||0)+dgSurfaceArea(p.geom);
   const features=input.parts.map(p=>({properties:{class:p.type},geometry:{type:'MultiPolygon',coordinates:dgSurfaceUnproject(p.geom,input.epsg)}}));let status;
   const [lat,lon]=input.outer[0][0];
   await DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT.render({state,record,cells:[{center:{lat,lon}}],editSummary:()=>({total:0}),toast:message=>notices.push(message),translate:String,escape:esc,getAreas:()=>areas,getRasterAreas:()=>areas,getParkRings:()=>input.outer,getGridCells:()=>[],getPark:()=>({id:43,name:'Harikalar Diyarı'}),parkAreaLabel:()=> '76.7',getParts:()=>input.parts,visualResult:async()=>({displayFeatures:features}),prepareFrame:args=>DG_PREPARE_SURFACE_EXPORT_MAP_FRAME.prepare({...args,forward:dgLcUtmForward}),drawLayers:DG_DRAW_SURFACE_EXPORT_MAP_LAYERS.draw,renderInfo:args=>{status={title:args.mapTitle,view:args.viewLabel};DG_RENDER_SURFACE_EXPORT_INFOGRAPHIC.render(args);},colors:{building:'#a78bfa'},ha:n=>(n/10000).toFixed(2),labelForClass:key=>DG_SURFACE_REVIEW.types[key]?.label||key,document,redraw(){}});
   return{status,unchanged:JSON.stringify(record)===before};
  },{input,accepted});
  const download=await pending,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const png=Buffer.concat(chunks);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(png.length>10000);assert.ok(result.unchanged);
  assert.equal(download.suggestedFilename(),accepted?'dendrogeo_dogrulanmis_harita_43.png':'dendrogeo_analiz_onizlemesi_43.png');
  assert.equal(result.status.title,accepted?'DOĞRULANMIŞ PARK HARİTASI':'PARK ANALİZİ ÖNİZLEMESİ');
  console.log(JSON.stringify({engine:engine.name(),park:'Harikalar Diyarı',accepted,cellEdits:0,downloaded:true,pngBytes:png.length,sourceUnchanged:true,...result.status}));
 }
}finally{await browser.close();await server.close();}
