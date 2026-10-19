import assert from 'node:assert/strict';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const server=await serveFixture(),browser=await(await loadChromium()).launch({headless:true});
try{for(const width of [360,390,430]){
 const context=await browser.newContext({viewport:{width,height:900},isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await isolateAccount(page);await page.goto(server.url);
 await page.locator('#shell').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(async()=>{
  await dgEnsureLulc();await go('map');initMaps();map.setView([39.99,32.65],19,{animate:false});map.invalidateSize();
  PARK_POLY=[[[39.989,32.649],[39.989,32.651],[39.991,32.651],[39.991,32.649],[39.989,32.649]]];PARK_HOLES=[];
  DG_SENS.epsg=32636;DG_SENS.parkGeometry=dgSurfacePark(PARK_POLY,[],32636);DG_SENS.geometry={};DG_SENS.busy=false;DG_SENS.saving=false;
  const source={type:'way',id:1456490807,tags:{highway:'footway'},geometry:[{lat:39.9898,lon:32.65},{lat:39.9902,lon:32.65}]};
  window.DG_SURFACE_OSM={elements:[source],boundary:JSON.stringify(PARK_POLY)};
  DG_SENS.record={features:[],objectFeatures:dgSurfaceObjects([source],32636),corrections:{},useObjects:true};
  DG_SENS.objectPreview=dgSensFindObjectAt({lat:39.99,lng:32.65});DG_SENS.drawType='hard';dgSensRenderPaintTools();
  window.roadRecordBefore=JSON.stringify(DG_SENS.record);
 });
 await page.locator('#dgSensBoundaryDetails summary').tap();
 await page.locator('#dgSensRoadWidth').fill('8');await page.locator('[data-dg-click="roadWidth"]').tap();
 assert.equal(await page.evaluate(()=>DG_SENS.objectPreview.roadWidthM),8);
 assert.equal(await page.evaluate(()=>JSON.stringify(DG_SENS.record)===window.roadRecordBefore),true);
 assert.equal(await page.locator('#dgSensRoadWidth').inputValue(),'8');
 const bounds=await page.locator('#dgSensRoadWidth').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);
 await page.locator('#dgSensBoundaryDetails [data-dg-click="objectCancel"]').tap();
 assert.equal(await page.evaluate(()=>DG_SENS.objectPreview),null);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({width,roadPreviewMetres:8,recordUnchanged:true,cancel:true,overflow:false}));await context.close();
}}finally{await browser.close();await server.close();}
