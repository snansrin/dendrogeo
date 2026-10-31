import assert from 'node:assert/strict';
import {serveFixture} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';

const chromium=await loadChromium();
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium;
const server=await serveFixture(),browser=await engine.launch({headless:true});
const html=`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/live-map-project-workspace.css">
<section id="dgLiveProjects" class="card dg-live-projects"><select id="dgLiveProjectSelect"></select>
<button type="button" data-live-project-action="open">Haritada aç</button>
<button type="button" data-live-project-action="refresh">Yenile</button>
<p id="dgLiveProjectStatus"></p></section>
<div id="v-map" class="on"></div><script src="/src/adapters/parks/live-map-project-snapshot-store.js"></script>
<script src="/src/ui/live-map-project-snapshot.js"></script><script src="/src/ui/live-map-project-workspace.js"></script>`;
try{
 for(const width of [360,390,430]){
  const context=await browser.newContext({viewport:{width,height:800},hasTouch:true,isMobile:true,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/saved-project-fixture',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto(server.url+'/saved-project-fixture');
  await page.evaluate(()=>{
   let activePark=0;const calls=[];window.__savedProjectCalls=calls;
   const projects=[{id:33,park_id:53,name:'Dikmen Vadisi · 2. Etap'},{id:30,park_id:25,name:'Göksu Parkı'}];
   window.DG_LIVE_MAP_PROJECT_WORKSPACE_UI.create({document,projects:()=>projects,remembered:()=> '33',remember:id=>calls.push('remember '+id),
    isEditing:()=>false,readProject:async id=>({...projects.find(p=>p.id===id),is_locked:false}),
    readPark:async id=>({id,name:id===53?'Dikmen Vadisi · 2. Etap':'Göksu Parkı',geom_json:id===53?{stage_scope:{parentId:50}}:{}}),
    readParent:async()=>null,candidate:row=>({name:row.name}),forgetParent:async()=>calls.push('missing parent'),
    saveDraft:async()=>true,activeParkId:()=>activePark,draw:async(_candidate,row)=>{activePark=row.id;calls.push('draw '+row.id);},
    saveWorkspace:async id=>{calls.push('save '+id);return {saved:true};},
    restoreWorkspace:async(project)=>{calls.push('restore '+project.id);return project.id===30?{mode:'cached',scan:true,grid:5}:{mode:'none'};},
    watchWorkspace:id=>calls.push('watch '+id),focusPark:()=>calls.push('focus park'),
    readWaypoints:async id=>Array.from({length:id===33?42:77},(_,i)=>({wp_id:i+1})),
    showWaypoints:rows=>calls.push('waypoints '+rows.length),clearWaypoints:()=>{},selectProject:id=>calls.push('select '+id),
    openWaypoints:()=>{},openSurface:async()=>({ready:true,restored:true}),openStages:()=>{},reloadProjects:async()=>{}
   });
  });
  assert.equal(await page.locator('#dgLiveProjectSelect').inputValue(),'','last project cannot auto-select');
  assert.deepEqual(await page.evaluate(()=>window.__savedProjectCalls),[],'nothing is loaded on entry');
  const storeSaved=await page.evaluate(async()=>{
   const store=window.DG_LIVE_MAP_PROJECT_SNAPSHOT_STORE.create(()=>indexedDB),identity={ownerId:'test-user',projectId:33,parkId:53};
   await store.save(identity,{schema:'test',parkId:53,grid:{cells:[{id:'saved-grid'}]}});
   return store.read(identity);
  });
  assert.deepEqual(storeSaved,{schema:'test',parkId:53,grid:{cells:[{id:'saved-grid'}]}},'IndexedDB preserves an exact project-scoped snapshot');
  await page.locator('#dgLiveProjectSelect').selectOption('33');
  await page.waitForFunction(()=>document.querySelector('#dgLiveProjectStatus').textContent.includes('Ana park kaydı eksik'));
  assert.equal(await page.locator('[data-live-project-action="stages"], [data-live-project-action="surface"], [data-live-project-action="waypoints"]').count(),0,'project selection must not invent a second tool menu');
  await page.locator('#dgLiveProjectSelect').selectOption('30');
  await page.waitForFunction(()=>document.querySelector('#dgLiveProjectStatus').textContent.includes('5 grid hücresi'));
  assert.equal(await page.locator('[data-live-project-action="stages"]').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  assert.deepEqual(await page.evaluate(()=>window.__savedProjectCalls),['missing parent','draw 53','waypoints 42','select 33','remember 33','restore 33','watch 33','focus park','save 33','draw 25','waypoints 77','select 30','remember 30','restore 30','watch 30','focus park']);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine:process.env.DG_UI_BROWSER||'chromium',width,standardToolsPreserved:true,waypointsPreserved:true,explicitSelection:true,projectSnapshot:true,parkFocused:true}));
  await context.close();
 }
}finally{await browser.close();await server.close();}
