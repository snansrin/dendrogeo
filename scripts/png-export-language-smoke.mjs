import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {mockExportTiles} from './lib/export-tile-fixture.mjs';
const input=JSON.parse(gunzipSync(readFileSync(new URL('../test/fixtures/harikalar-grid-surface.json.gz',import.meta.url))));
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{
 for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block',acceptDownloads:true});await isolateAccount(page);await page.goto(server.url);
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await page.evaluate(async()=>{await dgEnsureLulc();});
 await mockExportTiles(page);
 for(const lang of ['en','tr'])for(const accepted of [false,true]){
  await page.evaluate(lang=>dgSetLang(lang),lang);
  const result=await page.evaluate(async({input,accepted})=>{
   const labels=[],nativeFill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...rest){labels.push(String(text));return nativeFill.call(this,text,...rest);};
   let captureDownload;const captured=new Promise(resolve=>{captureDownload=resolve;});
   const nativeClick=HTMLAnchorElement.prototype.click;
   HTMLAnchorElement.prototype.click=function(){
    if(this.download){const filename=this.download;fetch(this.href).then(response=>response.blob()).then(async blob=>{const bytes=new Uint8Array(await blob.arrayBuffer());captureDownload({filename,mime:blob.type,bytes:bytes.length,signature:Array.from(bytes.slice(0,8)),base64:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))});});return;}
    return nativeClick.call(this);
   };
   const state={epoch:1,epsg:input.epsg,geometry:{},editing:!accepted,exporting:false},record={acceptedAt:accepted?'2026-10-17T00:00:00Z':null,corrections:{},features:[]},before=JSON.stringify(record),notices=[];
   const areas={};for(const p of input.parts)areas[p.type]=(areas[p.type]||0)+dgSurfaceArea(p.geom);
   const features=input.parts.map(p=>({properties:{class:p.type},geometry:{type:'MultiPolygon',coordinates:dgSurfaceUnproject(p.geom,input.epsg)}}));let status;
   const [lat,lon]=input.outer[0][0];
   await DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT.render({state,record,cells:[{center:{lat,lon}}],editSummary:()=>({total:0}),toast:message=>notices.push(message),translate:dgT,escape:esc,getAreas:()=>areas,getRasterAreas:()=>areas,getParkRings:()=>input.outer,getGridCells:()=>[],getPark:()=>({id:43,name:'Harikalar Diyarı'}),parkAreaLabel:()=> '76.7',getParts:()=>input.parts,visualResult:async()=>({displayFeatures:features}),prepareFrame:args=>DG_PREPARE_SURFACE_EXPORT_MAP_FRAME.prepare({...args,forward:dgLcUtmForward}),drawLayers:DG_DRAW_SURFACE_EXPORT_MAP_LAYERS.draw,renderInfo:args=>{status={title:args.mapTitle,view:args.viewLabel};DG_RENDER_SURFACE_EXPORT_INFOGRAPHIC.render(args);},colors:{building:'#a78bfa'},ha:n=>(n/10000).toFixed(2),labelForClass:key=>DG_SURFACE_REVIEW.types[key]?.label||key,document,redraw(){}});
   const download=await captured;
   HTMLAnchorElement.prototype.click=nativeClick;
   CanvasRenderingContext2D.prototype.fillText=nativeFill;
   return{labels,status,unchanged:JSON.stringify(record)===before,download};
  },{input,accepted});
  assert.deepEqual(result.download.signature,[137,80,78,71,13,10,26,10]);assert.ok(result.download.bytes>10000);assert.equal(result.download.mime,'image/png');assert.ok(result.unchanged);
  assert.equal(result.download.filename,accepted?'dendrogeo_dogrulanmis_harita_43.png':'dendrogeo_analiz_onizlemesi_43.png');
  assert.equal(result.status.title,accepted?'DOĞRULANMIŞ PARK HARİTASI':'PARK ANALİZİ ÖNİZLEMESİ');
  if(lang==='en'){assert.ok(result.labels.includes(accepted?'VERIFIED PARK MAP':'PARK ANALYSIS PREVIEW'));assert.ok(result.labels.includes('Green area'));assert.ok(!result.labels.some(v=>/DOĞRULANMIŞ|ÖNİZLEME|Yeşil alan|Sert zemin|Park alanı|Park analizi|parmak izi/.test(v)));}
  else assert.ok(result.labels.includes('Yeşil alan'));
  if(process.env.DG_QA_SCREENSHOT_DIR&&width===390&&accepted){mkdirSync(process.env.DG_QA_SCREENSHOT_DIR,{recursive:true});writeFileSync(process.env.DG_QA_SCREENSHOT_DIR+'/png-export-'+lang+'.png',Buffer.from(result.download.base64,'base64'));}
  console.log(JSON.stringify({width,lang,engine:engine.name(),park:'Harikalar Diyarı',accepted,cellEdits:0,downloaded:true,pngBytes:result.download.bytes,sourceUnchanged:true,...result.status}));
 }
 await page.close();}
}finally{await browser.close();await server.close();}
