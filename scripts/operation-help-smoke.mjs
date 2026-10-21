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
 const auto=page.locator('[data-grid-summary-action="createAuto"]'),help=page.locator('#gridSummary [data-dg-help-topic="gridResults"]');
 await help.waitFor({state:'visible'});
 assert.equal(await auto.evaluate(el=>el.parentElement===__helpParent),true,'help must not move controls');
 const computedFont=await auto.evaluate(el=>getComputedStyle(el).fontFamily);
 assert.equal(await help.evaluate(el=>getComputedStyle(el).fontFamily),computedFont);
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await help.click();assert.match(await page.locator('#dgOperationHelpTitle').innerText(),/Grid noktaları ve dosyalar/);
  assert.equal(await page.evaluate(()=>__helpCalls),0);assert.equal(await page.evaluate(()=>__helpState()===__helpBefore),true);
  assert.equal(await page.locator('#dgOperationHelp').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await page.keyboard.press('Escape');await page.locator('#dgOperationHelp').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>__helpEscapes),0,'closing help must not cancel map tools');
 }
 const csv=page.locator('[data-grid-summary-action="downloadCsv"]');assert.match(await csv.innerText(),/Ölçüm noktaları CSV/);assert.doesNotMatch(await csv.innerText(),/WP CSV/);
 const csvHelp=help;await csvHelp.click();
 assert.match(await page.locator('#dgOperationHelpBody').innerText(),/wp_id,lat,lon,visited/);assert.match(await page.locator('#dgOperationHelpBody').innerText(),/X,Y,id/);
 await page.addScriptTag({content:axe.source});const violations=await page.evaluate(async()=>{const result=await axe.run(document.getElementById('dgOperationHelp'));return result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));});assert.deepEqual(violations,[]);
 if(process.env.DG_QA_SCREENSHOT_DIR&&width===390)await page.locator('#dgOperationHelp').screenshot({path:join(process.env.DG_QA_SCREENSHOT_DIR,'operation-help-csv-390.png')});
 await page.locator('[data-dg-help-close]').click();
 const green=page.locator('#chkGreenOnly'),greenHelp=page.locator('label[for="gridClearance"] .dg-operation-help');const checked=await green.isChecked();
 await greenHelp.click();assert.equal(await green.isChecked(),checked);assert.equal(await page.evaluate(()=>__helpState()===__helpBefore),true);await page.keyboard.press('Escape');
 await auto.click();assert.equal(await page.evaluate(()=>__helpCalls),1,'original action must still fire exactly once');
 await page.evaluate(()=>{__helpRender();DG_OPERATION_HELP.scan();DG_OPERATION_HELP.scan();});
 await page.waitForFunction(()=>document.querySelector('#gridSummary [data-dg-help-topic="gridResults"]'));
 assert.equal(await page.locator('#gridSummary .dg-operation-help').count(),1,'one contextual guide per group, including after rerenders');
 if(await menu.getAttribute('open')===null)await menu.locator(':scope>summary').click();
 await page.evaluate(()=>dgSetLang('en'));await csvHelp.click();assert.match(await page.locator('#dgOperationHelpTitle').innerText(),/Grid points and files/);await page.keyboard.press('Escape');await page.evaluate(()=>dgSetLang('tr'));

 await page.evaluate(()=>go('nav'));
 const nav=page.locator('.waypoint-nav-card'),navHelp=nav.locator('[data-dg-help-topic="navActions"]');
 await navHelp.waitFor({state:'visible'});
 assert.equal(await nav.locator('.dg-operation-help').count(),1,'navigation gets one specific guide');
 assert.equal(await page.locator('.waypoint-actions-primary>.dg-operation-help,.waypoint-arrival>.dg-operation-help').count(),0,'help must not enter action layout');
 assert.equal(await page.locator('.waypoint-project .dg-operation-help').count(),0,'plain project selection needs no generic guide');
 const actionWidths=()=>page.locator('.waypoint-actions-primary button,.waypoint-arrival button').evaluateAll(nodes=>nodes.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
 const withHelp=await actionWidths();const hidden=await page.addStyleTag({content:'.dg-operation-help{display:none!important}'});const withoutHelp=await actionWidths();await hidden.evaluate(el=>el.remove());
 assert.equal(withHelp.length,withoutHelp.length,'help must preserve original navigation buttons');
 // DOMRect subtraction can introduce subpixel rounding when a control changes position.
 for(let i=0;i<withHelp.length;i++)for(const dimension of ['width','height']){
  assert.ok(Math.abs(withHelp[i][dimension]-withoutHelp[i][dimension])<0.01,`help must not resize navigation button ${i} ${dimension}`);
 }
 const mark=await navHelp.locator('span').boundingBox(),target=await navHelp.boundingBox();for(const [actual,expected]of [[mark.width,20],[mark.height,20],[target.width,44],[target.height,44]])assert.ok(Math.abs(actual-expected)<0.05,'fixed-size help mark and touch target');
 for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);if(process.env.DG_QA_SCREENSHOT_DIR)await nav.screenshot({path:join(process.env.DG_QA_SCREENSHOT_DIR,'help-nav-'+theme+'-'+width+'.png')});}
 await navHelp.click();const guide=await page.locator('#dgOperationHelpBody').innerText();for(const label of ['En yakın','Sıradaki','Haritada göster','Tüm noktalar','Vardım'])assert.ok(guide.includes(label));assert.doesNotMatch(guide,/Soldaki menüden/);await page.keyboard.press('Escape');
 assert.equal(await page.locator('#waypointFileTitle .dg-operation-help').getAttribute('data-dg-help-topic'),'pointUpload');
 assert.equal(await page.locator('.export-format-card [data-dg-help-topic]').evaluateAll(nodes=>new Set(nodes.map(el=>el.dataset.dgHelpTopic)).size),3,'each export format has its own instructions');
 await page.evaluate(()=>{
  PROJ_LIST=[{id:1,park_id:36,name:'Test projesi',owner:USER.id,parks:{name:'Test parkı',area_m2:10000}}];
  document.getElementById('mProject').innerHTML='<option value="1">Test projesi</option>';
 });
 await page.locator('#side [data-dg-view="measure"]').click();
 const fieldHelp=page.locator('.measure-dimensions .dg-field-help');
 await fieldHelp.first().waitFor({state:'visible'});
 assert.equal(await fieldHelp.count(),2);
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  for(const field of await fieldHelp.all()){
   const style=await field.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundImage,border:s.borderWidth,font:s.fontFamily,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height};});
   assert.match(style.background,/radial-gradient/,'field help must draw only the compact central mark');
   assert.match(style.background,/9px.*10px.*10px/,'visible field help radius is 10px');
   assert.equal(style.border,'0px','touch target must not have a large circular border');
   assert.equal(style.font,computedFont,'field help shares the UI font');
   for(const value of [style.width,style.height])assert.ok(Math.abs(value-44)<0.01,`field help keeps its touch target: ${JSON.stringify(style)}`);
   await field.focus();
   const focused=await field.elementHandle();
   await page.waitForFunction(el=>getComputedStyle(el,'::after').visibility==='visible',focused,{timeout:5000});
   await focused.dispose();
  }
  await fieldHelp.last().blur();
  if(process.env.DG_QA_SCREENSHOT_DIR)await page.locator('.measure-dimensions').screenshot({path:join(process.env.DG_QA_SCREENSHOT_DIR,'help-measure-'+theme+'-'+width+'.png')});
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine:engine.name(),width,light:true,dark:true,accessible:true,noActionOnHelp:true,escPreservesMap:true,controlsUnmoved:true,originalActionOnce:true,bilingual:true}));
 await page.close();
}}finally{await browser.close();await server.close();}
