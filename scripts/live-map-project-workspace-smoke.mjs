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
<p id="dgLiveProjectStatus"></p><div id="dgLiveProjectActions" hidden><strong id="dgLiveProjectActive"></strong>
<button type="button" data-live-project-action="waypoints">Noktalar</button>
<button type="button" data-live-project-action="surface">Yüzey</button>
<button type="button" data-live-project-action="stages">Etap</button></div></section>
<div id="v-map" class="on"></div><script src="/src/ui/live-map-project-workspace.js"></script>`;
try{
 for(const width of [360,390,430]){
  const context=await browser.newContext({viewport:{width,height:800},hasTouch:true,isMobile:true,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/saved-project-fixture',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto(server.url+'/saved-project-fixture');
  await page.evaluate(()=>{
   let activePark=0;const calls=[];window.__savedProjectCalls=calls;
   const projects=[{id:33,park_id:53,name:'Dikmen Vadisi · 2. Etap'},{id:30,park_id:25,name:'Göksu Parkı'}];
   window.DG_LIVE_MAP_PROJECT_WORKSPACE_UI.create({document,projects:()=>projects,remembered:()=>'',remember:id=>calls.push('remember '+id),
    isEditing:()=>false,readProject:async id=>({...projects.find(p=>p.id===id),is_locked:false}),
    readPark:async id=>({id,name:id===53?'Dikmen Vadisi · 2. Etap':'Göksu Parkı',geom_json:id===53?{stage_scope:{parentId:50}}:{}}),
    readParent:async()=>null,candidate:row=>({name:row.name}),forgetParent:async()=>calls.push('missing parent'),
    saveDraft:async()=>true,activeParkId:()=>activePark,draw:async(_candidate,row)=>{activePark=row.id;calls.push('draw '+row.id);},
    readWaypoints:async id=>Array.from({length:id===33?42:77},(_,i)=>({wp_id:i+1})),
    showWaypoints:rows=>calls.push('waypoints '+rows.length),clearWaypoints:()=>{},selectProject:id=>calls.push('select '+id),
    openWaypoints:()=>{},openSurface:async()=>({ready:true,restored:true}),openStages:()=>{},reloadProjects:async()=>{}
   });
  });
  await page.locator('#dgLiveProjectSelect').selectOption('33');
  await page.locator('[data-live-project-action="open"]').click();
  await page.waitForFunction(()=>document.querySelector('#dgLiveProjectStatus').textContent.includes('Ana park kaydı eksik'));
  assert.equal(await page.locator('[data-live-project-action="stages"]').isHidden(),true);
  assert.equal(await page.locator('[data-live-project-action="surface"]').isVisible(),true);
  await page.locator('[data-live-project-action="surface"]').click();
  await page.waitForFunction(()=>document.querySelector('#dgLiveProjectStatus').textContent.includes('Kaydedilmiş yüzey düzeltmeleri'));
  await page.locator('#dgLiveProjectSelect').selectOption('30');
  await page.locator('[data-live-project-action="open"]').click();
  await page.waitForFunction(()=>document.querySelector('#dgLiveProjectStatus').textContent.includes('77 kayıtlı ölçüm noktası'));
  assert.equal(await page.locator('[data-live-project-action="stages"]').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  assert.deepEqual(await page.evaluate(()=>window.__savedProjectCalls),['missing parent','draw 53','waypoints 42','select 33','remember 33','draw 25','waypoints 77','select 30','remember 30']);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine:process.env.DG_UI_BROWSER||'chromium',width,orphanStageReadOnly:true,waypointsPreserved:true,savedSurfaceAction:true}));
  await context.close();
 }
}finally{await browser.close();await server.close();}
