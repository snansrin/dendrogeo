import assert from 'node:assert/strict';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const chromium=await loadChromium(),engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium;
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430,1280]){
 const context=await browser.newContext({viewport:{width,height:900},hasTouch:true,isMobile:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await isolateAccount(page);await page.goto(server.url+'/');await page.locator('#shell').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 // Observe completion in the page instead of pinning a remote Promise handle
 // across lazy script loading (Chromium can collect that CDP handle).
 await page.evaluate(()=>{window.__surfaceMenuReady=false;window.__surfaceMenuError=null;window.__surfaceMenuSetup=(async()=>{await dgEnsureLulc();await go('map');initMaps();map.setView([39.99,32.65],19,{animate:false});map.invalidateSize();
  PARK_POLY=[[[39.989,32.649],[39.989,32.651],[39.991,32.651],[39.991,32.649],[39.989,32.649]]];PARK_HOLES=[];
  DG_SENS.epsg=32636;DG_SENS.parkGeometry=dgSurfacePark(PARK_POLY,[],32636);DG_SENS.geometry={};DG_SENS.busy=false;DG_SENS.saving=false;
  const feature={type:'building',osmId:'way/fixture-building',geometry:{type:'MultiPolygon',coordinates:[[[[32.6499,39.9899],[32.6501,39.9899],[32.6501,39.9901],[32.6499,39.9901],[32.6499,39.9899]]]]}};
  DG_SENS.record={features:[],objectFeatures:[feature],corrections:{},brushHistory:[],useObjects:true,period:'ytd',thresholds:{},osmCoverage:{status:'complete'}};
  dgSensRenderPaintTools();
 })().then(()=>{window.__surfaceMenuReady=true;},error=>{window.__surfaceMenuError=String(error?.stack||error);});});
 await page.waitForFunction(()=>window.__surfaceMenuReady||window.__surfaceMenuError);assert.equal(await page.evaluate(()=>window.__surfaceMenuError),null,'surface fixture setup must succeed');
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);assert.equal(await page.evaluate(()=>{const button=document.getElementById('parkModeBtn').getBoundingClientRect(),base=document.querySelector('.live-map-base').getBoundingClientRect(),bar=document.querySelector('.live-map-tools').getBoundingClientRect();return base.left>=button.right+8&&Math.abs(base.top+base.height/2-button.top-button.height/2)<2&&base.right<=bar.right+1&&document.documentElement.scrollWidth<=innerWidth+1;}),true,'basemap stays beside park mode on phone and desktop');}
 if(process.env.DG_HEADER_SCREENSHOT_DIR)await page.locator('.live-map-tools').screenshot({path:process.env.DG_HEADER_SCREENSHOT_DIR+'/'+(process.env.DG_UI_BROWSER||'chromium')+'-harita-secimi-'+width+'.png'});
 // Exercise the real loading controller while its raster dependency is deferred.
 await page.evaluate(()=>{window.__pendingAnalysis=DG_PARK_LANDCOVER_UI.create({isBusy:()=>false,setBusy(){},getOuter:()=>PARK_POLY,getHoles:()=>[],parkAreaM2:()=>100,getElement:id=>document.getElementById(id),getButton:()=>null,getReport:()=>null,getLandcover:()=>({analyze:()=>new Promise(resolve=>window.__finishPending=resolve)}),getReportRenderer:()=>null,getSensitivity:()=>null,hasSensitivityRecord:()=>true,toast(){},cf:String,escape:String}).run();});
 assert.equal(await page.locator('#baseLayerSelect').isVisible(),false,'the inline flex style cannot keep a second basemap selector visible during analysis');assert.equal(await page.locator('#dgPendingBaseSelect').isVisible(),true);assert.equal(await page.locator('#v-map .leaflet-container').count(),1,'loading uses the existing live map');await page.evaluate(async()=>{__finishPending({});await __pendingAnalysis;});assert.equal(await page.locator('#surfacePendingTools').isVisible(),false);
 // The desktop case covers this header/loading layout; the existing touch
 // drawing workflow below continues to run at all three phone widths.
 if(width>700){assert.deepEqual(errors,[]);console.log(JSON.stringify({browser:process.env.DG_UI_BROWSER||'chromium',width,adjacentBasemap:true,themes:['light','dark'],singlePendingMap:true,errors}));await context.close();continue;}
 const menu=page.locator('#dgSensBoundaryDetails');await menu.locator('summary').tap();
 assert.equal(await menu.evaluate(el=>el.parentElement.id),'surfaceMenuBar','use the real moved menu, outside its original event host');
 await menu.locator('[data-dg-click="objectPick"]').tap();
 assert.equal(await page.evaluate(()=>DG_SENS.objectPick),true,'the moved menu button must activate object picking');
 await page.locator('#map').scrollIntoViewIfNeeded();const center=await page.evaluate(()=>{const p=map.latLngToContainerPoint([39.99,32.65]),r=map.getContainer().getBoundingClientRect();return{x:p.x+r.x,y:p.y+r.y}});await page.touchscreen.tap(center.x,center.y);
 await page.waitForFunction(()=>DG_SENS.objectPreview?.osmId==='way/fixture-building');
 await page.locator('#dgSensBoundaryDetails [data-dg-click="objectCancel"]').tap();
 await page.locator('#dgSensBoundaryDetails summary').tap();
 await page.locator('#dgSensDrawType').selectOption('hard');assert.equal(await page.evaluate(()=>DG_SENS.drawType),'hard');
 await page.locator('#dgSensBoundaryDetails [data-dg-click="drawStart"]').tap();assert.equal(await page.evaluate(()=>DG_SENS.draw?.type),'hard');
 await page.locator('#map').scrollIntoViewIfNeeded();const box=await page.locator('#map').boundingBox();
 for(const [x,y]of [[100,20],[180,25],[240,50]])await page.touchscreen.tap(box.x+x,box.y+y);
 assert.equal(await page.evaluate(()=>DG_SENS.draw.ring.length),3,'each real tap adds exactly one corner');
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>DG_SENS.draw),null);
 // Re-rendered menus must retain one action handler and keep input changes working.
 await page.evaluate(()=>{dgSensRenderPaintTools();dgSensRenderPaintTools();});
 await page.locator('#dgSensBoundaryDetails summary').tap();await page.locator('#dgSensBoundaryDetails [data-dg-click="objectPick"]').tap();assert.equal(await page.evaluate(()=>DG_SENS.objectPick),true);
 assert.equal(await page.evaluate(()=>DG_SENS.record.features.length),0,'selection/drawing cancellation cannot write a correction');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({browser:process.env.DG_UI_BROWSER||'chromium',width,realApplication:true,movedMenu:true,objectPreview:true,classSelection:true,drawingCorners:3,repeatedRender:true,noProductionWrites:true}));await context.close();
}}finally{await browser.close();await server.close();}
