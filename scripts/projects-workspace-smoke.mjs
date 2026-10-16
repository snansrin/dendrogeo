/* Exercise the project directory's real disclosure and delegated action hosts. */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
const server=await serveFixture(),chromium=await loadChromium();
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium;
const browser=await engine.launch({headless:true}),out=join(tmpdir(),'dendrogeo-projects');mkdirSync(out,{recursive:true});
try{for(const width of [360,390,430,1280]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await isolateAccount(page);await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.locator('#side [data-dg-view="projects"]').click();
 await page.evaluate(()=>{
  const projects=[{id:1,name:'Göksu Parkı · Ağaç envanteri 2026',park_id:25,parks:{name:'Göksu Parkı',area_m2:501000},city:'Ankara',country:'Türkiye',created_at:'2026-10-15'},
   {id:2,name:'Uzun proje adı ile ortak saha çalışması',shared:true,park_id:36,parks:{name:'Gençlik Parkı'},city:'Ankara'}];
  window.__projectActions=[];
  DG_MEASUREMENT_PROJECT_DIRECTORY_UI.render({projects,element:id=>document.getElementById(id),escape:esc,optionLabel:p=>p.name,restore(){},renderCard:dgProjectCard,editing:false,
   actions:Object.fromEntries(['openMeasure','edit','publish','delete'].map(action=>[action,id=>window.__projectActions.push([action,id])]))});
 });
 const own=page.locator('#projOwnList .project-card'),shared=page.locator('#projSharedList .project-card');
 assert.equal(await own.locator('[data-project-action="edit"]').isVisible(),false);
 await own.locator('[data-project-action="openMeasure"]').click();
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  for(const language of ['tr','en']){
   if(await page.locator('html').getAttribute('lang')!==language)await page.locator('#apptop .dg-lang-toggle').click();
   const details=own.locator('details'),summary=details.locator('summary');
   if(await details.getAttribute('open')!==null)await summary.click();
   await summary.focus();await page.keyboard.press('Enter');
   assert.notEqual(await details.getAttribute('open'),null);
   assert.equal(await summary.evaluate(e=>getComputedStyle(e,'::after').content),'""');
   assert.equal(await own.locator('[data-project-action="edit"]').isVisible(),true);
   if(language==='en')assert.match(await summary.innerText(),/Project details and actions/);
   assert.equal(await page.locator('#projOwnCount').innerText(),'1','language changes retain the live owned count');
   assert.equal(await page.locator('#projSharedCount').innerText(),'1','language changes retain the live shared count');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.equal(await own.evaluate(e=>[...e.querySelectorAll('button,summary')].filter(n=>n.getClientRects().length).every(n=>n.getBoundingClientRect().height>=43.5&&getComputedStyle(n).fontFamily.includes('Manrope'))),true);
   await summary.click();
  }
 }
 await own.locator('summary').click();await own.locator('[data-project-action="edit"]').click();
 assert.deepEqual(await page.evaluate(()=>window.__projectActions),[['openMeasure',1],['edit',1]]);
 assert.equal(await shared.locator('[data-project-action="delete"],[data-project-action="edit"],[data-project-action="publish"]').count(),0);
 await page.evaluate(()=>document.getElementById('toastWrap')?.replaceChildren());
 await page.locator('#v-projects').screenshot({path:join(out,engine.name()+'-'+width+'.png')});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine:engine.name(),width,bilingual:true,themes:true,disclosureKeyboard:true,delegatedActions:true,sharedPermissions:true}));await page.close();
}}finally{await browser.close();await server.close();}
