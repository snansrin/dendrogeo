import assert from 'node:assert/strict';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
import axe from 'axe-core';
import {join} from 'node:path';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await isolateAccount(page);await page.goto(server.url);
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(async()=>{
  go('map');queryDetailedCoverage=async()=>true;
  const square=(a,b,h,w)=>[[a,b],[a,b+w],[a+h,b+w],[a+h,b],[a,b]];
  const outer=square(39,32,.01,.02),parent={id:9001,osm_key:'way/990001',name:'Sentetik etap parkı',source:'osm',area_m2:polyArea({outer:[outer],inner:[]})};
  window.__stageFixture={parent,rows:[],writes:0};
  DG_PARK_SESSION.set(parent.osm_key,parent);PROJ_LIST=[{id:8001,park_id:9001,name:'Ana parkın eski projesi'}];
  WP=[{id:1,project_id:8001,lat:39.001,lon:32.001}];LAST_WP_ROWS=[...WP];
  const rpc=sb.rpc.bind(sb),from=sb.from.bind(sb);
  sb.rpc=async(name,args)=>{
   if(name==='dg_park_stage_ready')return{data:1,error:null};
   if(name==='dg_create_park_stage'){
    ++__stageFixture.writes;
    const geom={...args.p_geometry,stage_scope:{schema:'dendrogeo/park-stage/1',parentId:9001,parentKey:parent.osm_key,parentName:parent.name,label:args.p_name,definition:'user-defined'}};
    const row={id:9002,osm_key:'stage/9001/'+'a'.repeat(32),name:parent.name+' · '+args.p_name+' (kullanıcı tanımlı etap)',geom_json:geom,area_m2:polyArea(args.p_geometry),source:'manual'};
    __stageFixture.rows.push(row);return{data:row,error:null};
   }return rpc(name,args);
  };
  sb.from=table=>{
   if(table!=='parks')return from(table);
   const filters={},chain={select(){return this;},like(){return this;},order(){return this;},eq(k,v){filters[k]=v;return this;},limit:async()=>({data:__stageFixture.rows,error:null}),single:async()=>({data:__stageFixture.rows.find(r=>r.id===filters.id&&r.osm_key===filters.osm_key),error:null})};return chain;
  };
  window.__parentCandidate={name:parent.name,type:'way',id:990001,rings:{outer:[outer],inner:[]},area:parent.area_m2};
  await drawPark(__parentCandidate);
 });
 const host=page.locator('#dgParkStageWorkspace');await host.waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('[data-stage-action="edit"]').disabled);
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  assert.equal(await host.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 }
 await host.locator('[data-stage-action="edit"]').click();await host.locator('#dgStageName').fill('1. etap');
 await host.locator('[data-stage-action="draw"]').click();
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
 await host.locator('[data-stage-action="save"]').click();await page.waitForFunction(()=>typeof DG_PARK!=='undefined'&&DG_PARK?.id===9002);
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
 await page.addScriptTag({content:axe.source});
 const violations=await page.evaluate(async()=>(await axe.run(document.getElementById('dgParkStageWorkspace'))).violations.map(v=>v.id));assert.deepEqual(violations,[]);
 await page.evaluate(()=>{DG_LC_SENS.state.brush={diameter:20};});
 await host.locator('[data-stage-action="edit"]').click();assert.match(await host.locator('#dgStageStatus').textContent(),/fırça/);
 assert.equal(await host.locator('#dgStageName').count(),0);await page.evaluate(()=>{DG_LC_SENS.state.brush=null;});
 await host.locator('#dgStageSelect').selectOption('whole');await host.locator('[data-stage-action="apply"]').click();
 await page.waitForFunction(()=>DG_PARK?.id===9001);
 assert.equal(await page.evaluate(()=>JSON.stringify(PARK_POLY)===JSON.stringify(__parentCandidate.rings.outer)),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,stageId:result.id,scopedGrid:true,restoredParent:true,errors}));await page.close();
}}finally{await browser.close();await server.close();}
