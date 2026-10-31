import assert from 'node:assert/strict';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {installStageFixture} from "./lib/park-stage-browser-fixture.mjs";
import axe from 'axe-core';
import {join} from 'node:path';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await isolateAccount(page);await page.goto(server.url);
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await installStageFixture(page);
 await page.locator('#dgStageToolsMenu > summary').click();
 const host=page.locator('#dgParkStageWorkspace');await host.waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('[data-stage-action="edit"]').disabled);
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  assert.equal(await host.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 }
 await host.locator('[data-stage-action="edit"]').click();await host.locator('#dgStageName').fill('1. etap');
 await host.locator('.dg-stage-advanced > summary').click();await host.locator('[data-stage-action="draw"]').click();
 await page.locator('#map').scrollIntoViewIfNeeded();
 const corners=await page.evaluate(()=>{
  map.stop();map.fitBounds(L.latLngBounds(__parentCandidate.rings.outer),{animate:false,padding:[20,20]});
  window.__interceptedSurfaceClicks=0;window.__blockingSurface=L.polygon(__parentCandidate.rings.outer,{fillOpacity:.1}).addTo(map);
  __blockingSurface.on('click',event=>{window.__interceptedSurfaceClicks++;L.DomEvent.stopPropagation(event);});
  const box=map.getContainer().getBoundingClientRect();
  return [[39.001,32.001],[39.001,32.009],[39.009,32.009],[39.009,32.001]].map(point=>{const p=map.latLngToContainerPoint(point);return{x:box.left+p.x,y:box.top+p.y};});
 });
 for(const point of corners)await page.mouse.click(point.x,point.y);
 assert.match(await host.locator('#dgStageStatus').textContent(),/4 köşe/);
 assert.equal(await page.evaluate(()=>__interceptedSurfaceClicks),0);
 await page.evaluate(()=>map.removeLayer(__blockingSurface));
 await page.locator('.dg-stage-map-hint button').first().click();await host.locator('[data-stage-action="save"]').click();await page.waitForFunction(()=>typeof DG_PARK!=='undefined'&&DG_PARK?.id===9002);
 await page.locator('#dgStageToolsMenu > summary').click();
 const result=await page.evaluate(()=>({id:DG_PARK.id,rings:PARK_POLY,gridOptions:[...document.getElementById('gridProject').options].map(o=>o.value),parent:DG_PARK_SESSION.get('way/990001'),writes:__stageFixture.writes,mode:PARK_MODE,guard:!!window._dgSensGuard,name:DG_PARK.name,
  gate:DG_PARK_STAGE_GEOMETRY.measurementGate({park:DG_PARK,project:PROJ_LIST[0]}),inheritedPoints:WP.length+LAST_WP_ROWS.length}));
 assert.equal(result.id,9002);assert.equal(result.writes,1);assert.deepEqual(result.gridOptions,['0']);
 assert.equal(result.parent.id,9001);assert.equal(result.parent.geom_json,undefined);assert.match(result.name,/1. etap/);
 assert.ok(result.rings.flat().every(p=>p[1]<32.01));assert.equal(result.gate.reason,'stage-project-required');assert.equal(result.guard,false);assert.equal(result.inheritedPoints,0);
 const analysis=await page.evaluate(async()=>{
  await dgEnsureLulc();
  const engine=window.DG_LANDCOVER,renderer=window.DG_LANDCOVER_RENDER_REPORT,mount=window.DG_LC_SENS.mount;
  const captures={};
  try{
   window.DG_LANDCOVER={...engine,analyze:async input=>{captures.input=input;return {synthetic:true};}};
   window.DG_LANDCOVER_RENDER_REPORT=(_element,_result,area)=>{captures.reportArea=area;};
   window.DG_LC_SENS.mount=async()=>{captures.record=dgSensNewRecord();};
   await runLandCoverAnalysis();
   captures.stageArea=parkAreaM2();captures.parentArea=__stageFixture.parent.area_m2;captures.active=PARK_POLY;
   return captures;
  }finally{window.DG_LANDCOVER=engine;window.DG_LANDCOVER_RENDER_REPORT=renderer;window.DG_LC_SENS.mount=mount;}
 });
 assert.equal(analysis.record.parkId,9002);assert.deepEqual(analysis.input.outer,analysis.active);
 assert.equal(analysis.reportArea,analysis.stageArea);assert.ok(analysis.stageArea<analysis.parentArea);
 if(process.env.DG_STAGE_SCREENSHOT_DIR)await host.screenshot({path:join(process.env.DG_STAGE_SCREENSHOT_DIR,'etap-secimi-'+width+'.png')});
 await page.evaluate(axe.source);
 const violations=await page.evaluate(async()=>(await axe.run(document.getElementById('dgParkStageWorkspace'))).violations.map(v=>v.id));assert.deepEqual(violations,[]);
 await page.evaluate(()=>{DG_LC_SENS.state.brush={diameter:20};});
 await host.locator('[data-stage-action="edit"]').click();assert.match(await host.locator('#dgStageStatus').textContent(),/fırça/);
 assert.equal(await host.locator('#dgStageName').count(),0);await page.evaluate(()=>{DG_LC_SENS.state.brush=null;});
 await host.locator('#dgStageSelect').selectOption('whole');await host.locator('[data-stage-action="apply"]').click();
 await page.waitForFunction(()=>DG_PARK?.id===9001);
 assert.equal(await page.evaluate(()=>JSON.stringify(PARK_POLY)===JSON.stringify(__parentCandidate.rings.outer)),true);
 // A saved stage whose parent is unavailable still owns the original Etaplar
 // menu, without making up an editable parent polygon.
 await page.evaluate(async()=>{
  await DG_PARK_STAGES.present({park:null,row:null});
  const orphan={id:9012,name:'Dikmen Vadisi · 2. etap',geom_json:{stage_scope:{parentId:9999,label:'2. etap'}}};
  await DG_PARK_STAGES.present({park:{name:orphan.name},row:orphan});
 });
 const menus=await page.locator('#surfaceMenuBar > details').evaluateAll(items=>items.map(el=>({order:Number(el.dataset.menuOrder),label:el.querySelector('summary')?.textContent||''})));
 assert.equal(menus.filter(item=>item.order===25&&item.label.includes('Etaplar')).length,1,'the original Etaplar tab is mounted exactly once');
 assert.deepEqual(menus.map(item=>item.order),menus.map(item=>item.order).sort((a,b)=>a-b),'existing menus retain their standard order');
 await page.locator('#dgStageToolsMenu > summary').click();
 assert.match(await page.locator('#dgStageStatus').innerText(),/Ana park kaydı eksik/);
 assert.equal(await page.locator('#dgParkStageWorkspace [data-stage-action]').count(),0,'missing parent cannot start an unsafe edit');
 // A persisted stage can reference an old parent ID while the same OSM park
 // was re-created under a new ID. Its existing tools must remain available.
 await page.evaluate(async()=>{
  const parent={...__stageFixture.parent,id:54,osm_key:'relation/14290362',created_by:USER.id};
  const recovered={id:53,osm_key:'stage/50/'+'a'.repeat(32),name:'Dikmen Vadisi · 2.etap',created_by:USER.id,
   geom_json:{outer:__parentCandidate.rings.outer,inner:[],stage_scope:{parentId:50,parentKey:parent.osm_key,label:'2.etap'}}};
  await DG_PARK_STAGES.present({park:__parentCandidate,row:parent});
  await DG_PARK_STAGES.present({park:DG_PARK_STAGE_GEOMETRY.candidate(recovered),row:recovered});
 });
 await page.waitForFunction(()=>!document.querySelector('#dgParkStageWorkspace [data-stage-action="revise"]')?.disabled);
 assert.equal(await page.locator('#dgStageSelect').inputValue(),'53','the original stage is still selected');
 assert.equal(await page.locator('#dgParkStageWorkspace [data-stage-action="delete"]').isDisabled(),true,'old stage deletion stays blocked');
 assert.equal(await page.locator('#surfaceMenuBar > details[data-menu-order="25"]').count(),1,'no duplicate stage toolbar');
 await page.evaluate(()=>DG_PARK_STAGES.present({park:__parentCandidate,row:__stageFixture.parent}));
 await page.waitForFunction(()=>!!document.querySelector('#dgParkStageWorkspace [data-stage-action="edit"]'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,stageId:result.id,scopedGrid:true,restoredParent:true,errors}));await page.close();
}}finally{await browser.close();await server.close();}
