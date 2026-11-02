/* Reproduce stale membership, transient reads and measurement navigation in isolation. */
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
 await page.locator('#side [data-dg-view="measure"]').click();
 assert.equal(await page.locator('#v-measure').evaluate(e=>e.classList.contains('on')),true,'empty directory must not navigate to the live map');
 assert.equal(await page.evaluate(()=>PARK_MODE),false,'entering measurement must not start park detection');
 assert.equal(await page.locator('#saveBtn').isDisabled(),true);
 await page.locator('#side [data-dg-view="projects"]').click();
 await page.evaluate(()=>window._dgShellViewData.load('projects'));
 await page.evaluate(async()=>{
  const userId=USER.id,originalFrom=sb.from;
  window.__directoryFailure=false;
  const fixtures={v_my_parks:[{id:25,role:'collaborator',name:'Shared park'}],park_collaborators:[{park_id:25,added_at:'2026-11-01'}],park_invites:[{park_id:25,invited_by:'fixture-owner',responded_at:'2026-11-01'}],projects:[{id:30,park_id:25,owner:'fixture-owner',name:'Shared A',is_locked:true},{id:33,park_id:25,owner:'fixture-owner',name:'Shared B',is_locked:true}]};
  window.__directoryFixtures=fixtures;
  sb.auth.getUser=async()=>({data:{user:{id:userId,email:'fixture@example.test',email_confirmed_at:'2026-10-01'}}});
  sb.from=table=>{
   if(!fixtures[table])return originalFrom.call(sb,table);
   let own=false;return{select(){return this;},eq(key){if(table==='projects'&&key==='owner')own=true;return this;},in(){return this;},then(resolve){resolve(window.__directoryFailure?{error:{message:'temporary offline'}}:{data:own?[]:fixtures[table],error:null});}};
  };
  DG_INV.mine=[];await loadProjects();
 });
 assert.equal(await page.locator('#projSharedCount').innerText(),'2','fresh membership overrides stale empty invite cache');
 assert.equal(await page.locator('#projSharedList .project-card').count(),2,'locked shared projects remain visible');
 assert.equal(await page.locator('#nProject option:disabled').count(),2,'shared project locks remain intact');
 await page.evaluate(async()=>{window.__directoryFailure=true;try{await loadProjects();}catch{};});
 assert.equal(await page.locator('#projSharedCount').innerText(),'2','a transient failure cannot erase known shared projects');
 await page.evaluate(async()=>{
  window.__directoryFailure=false;for(const p of window.__directoryFixtures.projects)p.is_locked=false;
  await loadProjects();document.getElementById('mProject').value='30';document.getElementById('nProject').value='33';dgProjectRemember(30);await loadProjects();
 });
 assert.equal(await page.locator('#mProject').inputValue(),'30');assert.equal(await page.locator('#nProject').inputValue(),'33','refresh preserves the active Waypoint project separately');

 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine:engine.name(),width,sharedRecovery:true,locksPreserved:true,selectionPreserved:true,noAutomaticScan:true}));await page.close();
}}finally{await browser.close();await server.close();}
