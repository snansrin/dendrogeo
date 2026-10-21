import assert from 'node:assert/strict';
import {join} from 'node:path';
import axe from 'axe-core';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430,1280]){
 const page=await browser.newPage({viewport:{width,height:900},hasTouch:true,serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await isolateAccount(page);await page.goto(server.url);
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden&&window.DG_OPERATION_HELP);
 await page.evaluate(async()=>{
  await go('map');initMaps();await dgEnsureLulc();
  window.__helpCalls=0;window.__helpEscapes=0;
  document.addEventListener('keydown',e=>{if(e.key==='Escape')__helpEscapes++;});
  document.addEventListener('keyup',e=>{if(e.key==='Escape')__helpEscapes++;});
  PARK_POLY=[[[39.99,32.64],[39.99,32.65],[40,32.65],[40,32.64],[39.99,32.64]]];PARK_HOLES=[];
  const panel=document.getElementById('parkInfo');panel.style.display='block';
  panel.innerHTML=DG_PARK_INFO_PANEL_UI.render({name:'Kullanım rehberi testi',escape:esc,hectares:'1',parkIdChip:'',registerRetryMarkup:'',alternateSelector:'',projectOptionsMarkup:'<option value="1">Test projesi</option>'});
  dgParkMountMenus();
  window.__helpRender=()=>DG_GRID_SUMMARY.render({element:document.getElementById('gridSummary'),size:50,total:658,measured:0,empty:658,selected:2,meta:'',translate:dgCf,translateFormat:dgTfs,actions:{createAuto:()=>__helpCalls++,createManual:()=>__helpCalls++,clearSelection:()=>__helpCalls++,downloadGeoJson:()=>__helpCalls++,downloadCsv:()=>__helpCalls++}});
  __helpRender();window.__helpParent=document.querySelector('[data-grid-summary-action="createAuto"]').parentElement;
  window.__helpState=()=>JSON.stringify({park:PARK_POLY,grid:DG_GRID_SESSION.getCells(),green:DG_GREEN_ONLY});
  window.__helpBefore=__helpState();
 });
 const menu=page.locator('#surfaceMenuBar details[data-menu-order="30"]');await menu.locator(':scope>summary').click();
 const auto=page.locator('[data-grid-summary-action="createAuto"]'),help=page.locator('[data-grid-summary-action="createAuto"] + .dg-operation-help');
 await help.waitFor({state:'visible'});
 assert.equal(await auto.evaluate(el=>el.parentElement===__helpParent),true,'help must not move controls');
 const computedFont=await auto.evaluate(el=>getComputedStyle(el).fontFamily);
 assert.equal(await help.evaluate(el=>getComputedStyle(el).fontFamily),computedFont);
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await help.click();assert.match(await page.locator('#dgOperationHelpTitle').innerText(),/Otomatik/);
  assert.equal(await page.evaluate(()=>__helpCalls),0);assert.equal(await page.evaluate(()=>__helpState()===__helpBefore),true);
  assert.equal(await page.locator('#dgOperationHelp').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await page.keyboard.press('Escape');await page.locator('#dgOperationHelp').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>__helpEscapes),0,'closing help must not cancel map tools');
 }
 const csv=page.locator('[data-grid-summary-action="downloadCsv"]');assert.match(await csv.innerText(),/Ölçüm noktaları CSV/);assert.doesNotMatch(await csv.innerText(),/WP CSV/);
 const csvHelp=page.locator('[data-grid-summary-action="downloadCsv"] + .dg-operation-help');await csvHelp.click();
 assert.match(await page.locator('#dgOperationHelpBody').innerText(),/wp_id,lat,lon,visited/);assert.match(await page.locator('#dgOperationHelpBody').innerText(),/X,Y,id/);
 await page.addScriptTag({content:axe.source});const violations=await page.evaluate(async()=>{const result=await axe.run(document.getElementById('dgOperationHelp'));return result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));});assert.deepEqual(violations,[]);
 if(process.env.DG_QA_SCREENSHOT_DIR&&width===390)await page.locator('#dgOperationHelp').screenshot({path:join(process.env.DG_QA_SCREENSHOT_DIR,'operation-help-csv-390.png')});
 await page.locator('[data-dg-help-close]').click();
 const green=page.locator('#chkGreenOnly'),greenHelp=page.locator('label:has(#chkGreenOnly) + .dg-operation-help');const checked=await green.isChecked();
 await greenHelp.click();assert.equal(await green.isChecked(),checked);assert.equal(await page.evaluate(()=>__helpState()===__helpBefore),true);await page.keyboard.press('Escape');
 await auto.click();assert.equal(await page.evaluate(()=>__helpCalls),1,'original action must still fire exactly once');
 await page.evaluate(()=>{__helpRender();DG_OPERATION_HELP.scan();DG_OPERATION_HELP.scan();});
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('#gridSummary [data-grid-summary-action]')).every(el=>el.nextElementSibling?.classList.contains('dg-operation-help')));
 assert.equal(await page.locator('#gridSummary .dg-operation-help').count(),5,'rerenders cannot duplicate help');
 if(await menu.getAttribute('open')===null)await menu.locator(':scope>summary').click();
 await page.evaluate(()=>dgSetLang('en'));await csvHelp.click();assert.match(await page.locator('#dgOperationHelpTitle').innerText(),/Downloading measurement-points CSV/);await page.keyboard.press('Escape');await page.evaluate(()=>dgSetLang('tr'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine:engine.name(),width,light:true,dark:true,accessible:true,noActionOnHelp:true,escPreservesMap:true,controlsUnmoved:true,originalActionOnce:true,bilingual:true}));
 await page.close();
}}finally{await browser.close();await server.close();}
