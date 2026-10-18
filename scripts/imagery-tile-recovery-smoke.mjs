import assert from 'node:assert/strict';
import {serveFixture} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const server=await serveFixture(),chromium=await loadChromium(),browser=await chromium.launch({headless:true});
const live=process.argv.includes('--live'),base=process.argv.includes('--deployed')?'https://dendrogeo.org':server.url;
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:840}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route(base+'/imagery-test',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/vendor/leaflet-1.9.4.css"><div id="map" style="height:600px;width:100%"></div>'}));
 await page.goto(base+'/imagery-test');
 for(const path of ['vendor/leaflet-1.9.4.js','src/domain/map/resolve-base-map-layer.js','src/adapters/map/recover-imagery-tiles.js','src/adapters/map/create-base-map-layer.js'])await page.addScriptTag({url:base+'/'+path});
 if(!live){
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');for(const [x,y,color]of[[0,0,'red'],[128,0,'green'],[0,128,'blue'],[128,128,'yellow']]){g.fillStyle=color;g.fillRect(x,y,128,128);}return c.toDataURL().split(',')[1];});
  await page.route('https://server.arcgisonline.com/**',route=>{const missing=route.request().url().includes('/tile/19/');return route.fulfill({status:missing?404:200,headers:{'access-control-allow-origin':'*'},contentType:missing?'text/plain':'image/png',body:missing?'Not found':Buffer.from(png,'base64')});});
 }
 await page.evaluate(()=>{
  window.testMap=L.map('map').setView([40.7598213,29.9041954],22);
  const configuration=DG_RESOLVE_BASE_MAP_LAYER.resolve('sat',{sat:'Esri'});
  window.testLayer=DG_CREATE_BASE_MAP_LAYER.create({leaflet:L,map:testMap,configuration});
 });
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('canvas[data-dg-imagery-zoom]')).some(tile=>tile.dataset.dgImageryZoom==='18'),{},{timeout:30000});
 const result=await page.evaluate(()=>{
  const tile=testLayer._tiles['305695:197031:19']?.el;
  return{zoom:testMap.getZoom(),native:testLayer.options.maxNativeZoom,source:tile?.dataset.dgImageryZoom,pixel:tile?Array.from(tile.getContext('2d').getImageData(128,128,1,1).data):null};
 });
 assert.equal(result.zoom,22);assert.equal(result.native,19);assert.equal(result.source,'18');
 if(!live)assert.deepEqual(result.pixel,[255,255,0,255]);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,live,...result}));await page.close();
}}finally{await browser.close();await server.close();}
