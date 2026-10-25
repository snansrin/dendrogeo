import assert from 'node:assert/strict';
import axe from 'axe-core';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
const server=await serveFixture(),chromium=await loadChromium();
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium;
const browser=await engine.launch({headless:true}),out=join(tmpdir(),'dendrogeo-appearance');mkdirSync(out,{recursive:true});
const failures=[];
try{for(const width of [360,390,430,1280]){
 const page=await browser.newPage({viewport:{width,height:900},colorScheme:'light',bypassCSP:true,serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await isolateAccount(page);
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.locator('#shell').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 const profile=page.locator('#dgAcademicProfile'),toggle=profile.locator('[data-dg-dark-mode]');
 assert.equal(await profile.locator('a[href="rapor/"]').count(),0);
 assert.doesNotMatch(await profile.innerText(),/bilimsel|akademik/i);
 await page.evaluate(()=>{window.__themeWrites=0;sb.auth.updateUser=async()=>{window.__themeWrites++;throw Error('Unexpected account write');};});
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await toggle.check();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 assert.equal(await page.evaluate(()=>localStorage.getItem('dg_appearance')),'dark');
 assert.equal(await page.evaluate(()=>window.__themeWrites),0,'appearance must not update account metadata');
 await page.reload({waitUntil:'domcontentloaded'});await profile.waitFor();await toggle.waitFor();
 assert.equal(await toggle.isChecked(),true,'preference survives reload and profile mount');
 await page.evaluate(()=>dgAcademicProfileRender());assert.equal(await toggle.isChecked(),true);
 await page.evaluate(axe.source);
 const views=width===390?await page.locator('.view').evaluateAll(nodes=>nodes.map(n=>n.id)):['v-dash'];
 for(const id of views){
  await page.evaluate(id=>document.querySelectorAll('.view').forEach(e=>e.classList.toggle('on',e.id===id)),id);
  await page.evaluate(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all(document.querySelector('.view.on').getAnimations().map(animation=>animation.finished.catch(()=>{})));});
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.view.on')).opacity)===1);
  const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
  if(violations.length)failures.push({width,id,violations});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,id+' dark overflow');
 }
 await page.evaluate(()=>document.querySelectorAll('.view').forEach(e=>e.classList.toggle('on',e.id==='v-dash')));
 await profile.screenshot({path:join(out,engine.name()+'-dark-'+width+'.png')});
 if(width===390){
  await page.evaluate(async()=>{
   await dgEnsureLulc();document.querySelectorAll('.view').forEach(e=>e.classList.toggle('on',e.id==='v-map'));
   const host=document.getElementById('parkInfo');host.style.display='block';host.innerHTML=DG_PARK_INFO_PANEL_UI.render({name:'Test parkı',escape:x=>String(x),hectares:'56.9',parkIdChip:'',registerRetryMarkup:'',alternateSelector:'',projectOptionsMarkup:''});
   const box=document.getElementById('lcSens');box.style.display='block';box.innerHTML=DG_RENDER_SURFACE_SENSITIVITY_CONTROLS.render({model:{scanned:true,disabled:false},record:{sens:{green:50}},classes:['green'],meta:()=>({emoji:'🌿',tr:'Yeşil alan'}),focus:null,rawView:false,brush:false,sectionsOpen:true,opacity:55,translate:x=>x,escape:x=>String(x)});
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all(document.getElementById('v-map').getAnimations().map(animation=>animation.finished.catch(()=>{})));
  });
  const dynamic=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
  if(dynamic.length)failures.push({width,id:'surface-controls',violations:dynamic});
  await page.evaluate(()=>document.querySelectorAll('.view').forEach(e=>e.classList.toggle('on',e.id==='v-dash')));
  await page.evaluate(()=>{document.getElementById('shell').style.display='none';document.getElementById('landing').style.display='block';});
  const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
  if(violations.length)failures.push({width,id:'landing',violations});
  await page.evaluate(()=>{document.getElementById('shell').style.display='block';document.getElementById('landing').style.display='none';});
 }
 await toggle.uncheck();await page.emulateMedia({colorScheme:'dark'});
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light','explicit light overrides system');
 await profile.locator('[data-dg-theme-system]').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 await profile.screenshot({path:join(out,engine.name()+'-light-'+width+'.png')});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({width,engine:engine.name(),persisted:true,systemPreference:true,profileOnly:true,darkViews:views.length,noPageErrors:true}));
 await page.close();
}}finally{await browser.close();await server.close();}
if(failures.length)console.error(JSON.stringify(failures,null,2));assert.equal(failures.length,0,'Dark theme accessibility');
