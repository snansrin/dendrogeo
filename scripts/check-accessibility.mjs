import assert from 'node:assert/strict';
import axe from 'axe-core';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
const server=await serveFixture(),chromium=await loadChromium(),browser=await chromium.launch({headless:true});
const failures=[];
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:840},bypassCSP:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));await isolateAccount(page);await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.locator('#shell').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await page.addScriptTag({content:axe.source});
 await page.evaluate(()=>{PROJ_LIST=[{id:1,park_id:1,name:'Fixture proje',owner:USER.id,parks:{name:'Fixture park',area_m2:1000}}];document.getElementById('mProject').innerHTML='<option value="1">Fixture proje</option>';});
 await page.locator('#side .item').nth(1).focus();await page.keyboard.press('Enter');await page.locator('#v-measure.on').waitFor({state:'visible'});
 assert.equal(await page.locator('[name="girth_cm"]').count(),1);
 await page.locator('#v-measure .measure-details summary').focus();await page.keyboard.press('Enter');
 await page.locator('#dgLiveShare').focus();const checked=await page.locator('#dgLiveShare').isChecked();await page.keyboard.press('Space');assert.equal(await page.locator('#dgLiveShare').isChecked(),!checked);
 const focus=await page.locator('#dgLiveShare').evaluate(e=>({visible:e.matches(':focus-visible'),outline:getComputedStyle(e).outlineWidth}));assert.equal(focus.visible,true);assert.notEqual(focus.outline,'0px');
 const views=await page.locator('.view').evaluateAll(elements=>elements.map(e=>e.id));
 for(const view of views){
  await page.evaluate(id=>{document.querySelectorAll('.view').forEach(e=>e.classList.toggle('on',e.id===id));},view);
  await page.waitForFunction(()=>{const v=document.querySelector('.view.on');return !v||Number(getComputedStyle(v).opacity)===1;});
  const result=await page.evaluate(async()=>{const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});
  if(result.length)failures.push({width,view,violations:result});
 }
 // Actual dynamic surface renderer: no raster/record mutations or network analysis.
 await page.evaluate(async()=>{await window.dgEnsureLulc();document.querySelectorAll('.view').forEach(e=>e.classList.toggle('on',e.id==='v-map'));const host=document.getElementById('parkInfo');host.style.display='block';host.innerHTML=window.DG_PARK_INFO_PANEL_UI.render({name:'Test parkı',escape:x=>String(x),hectares:'56.9',parkIdChip:'',registerRetryMarkup:'',alternateSelector:'',projectOptionsMarkup:''});const box=document.getElementById('lcSens');box.style.display='block';box.innerHTML=window.DG_RENDER_SURFACE_SENSITIVITY_CONTROLS.render({model:{scanned:true,disabled:false},record:{sens:{green:50}},classes:['green'],meta:()=>({emoji:'🌿',tr:'Yeşil alan'}),focus:null,rawView:false,brush:false,sectionsOpen:true,opacity:55,translate:x=>x,escape:x=>String(x)});window.dgSensSlide=()=>{};window.dgSensOpacity=()=>{};});
 for(const id of ['dgSensRange-green','dgSensOpacity']){
  const slider=page.locator('#'+id);await slider.focus();await page.keyboard.press('Home');assert.equal(await slider.inputValue(),'0');await page.keyboard.press('End');assert.equal(await slider.inputValue(),'100');
  const geometry=await slider.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{left:r.left,right:r.right,height:r.height,padding:s.paddingTop,focus:e.matches(':focus-visible'),outline:s.outlineWidth};});assert.ok(geometry.left>=0&&geometry.right<=width);assert.ok(geometry.height>=44);assert.equal(geometry.padding,'0px');assert.ok(geometry.focus&&geometry.outline!=='0px');
 }
 await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('v-map')).opacity)===1);
 const surface=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});if(surface.length)failures.push({width,view:'surface-controls',violations:surface});
 await page.evaluate(()=>{document.getElementById('shell').style.display='none';document.getElementById('landing').style.display='block';});
 const landing=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});if(landing.length)failures.push({width,view:'landing',violations:landing});
 await page.evaluate(()=>{showAuth();authTab('reg');});
 await page.locator('#rgConsent').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#rgConsent').isChecked(),true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({width,views:views.length+2,automatedAccessibility:true,keyboardSwitch:true,visibleFocus:true,sliderEndpoints:true}));await page.close();
}}finally{await browser.close();await server.close();}
if(failures.length)console.error(JSON.stringify(failures,null,2));assert.equal(failures.length,0,'Accessibility violations');
