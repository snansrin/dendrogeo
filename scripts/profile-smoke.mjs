/* Real profile UI and save flow; account updates are intercepted inside the fixture. */
import assert from 'node:assert/strict';
import axe from 'axe-core';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
const server=await serveFixture(),chromium=await loadChromium();
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium;
const browser=await engine.launch({headless:true}),out=join(tmpdir(),'dendrogeo-profile');mkdirSync(out,{recursive:true});
try{for(const width of [360,390,430,1280]){
 const page=await browser.newPage({viewport:{width,height:900},bypassCSP:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await isolateAccount(page);await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.locator('#shell').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(()=>{
  USER.user_metadata={dendrogeo_profile:{institution:'Örnek Üniversitesi',project_name:'Park envanteri',title:'Korunacak başlık',sampling:'Korunacak örnekleme'}};
  window.__profileUpdates=[];window.__profileFail=false;
  sb.auth.updateUser=async payload=>{window.__profileUpdates.push(payload);await new Promise(resolve=>setTimeout(resolve,80));return window.__profileFail?{data:null,error:{message:'Test bağlantı hatası'}}:{data:{user:{...USER,user_metadata:{...USER.user_metadata,...payload.data}}}};};
  dgAcademicProfileRender();
 });
 const profile=page.locator('#dgAcademicProfile'),editor=profile.locator('[data-profile-editor]'),form=profile.locator('form');
 assert.equal(await form.locator('[required]').count(),0);
 await profile.locator('[data-profile-field="project_name"]').click();
 assert.equal(await form.locator('[name="project_name"]').evaluate(e=>e===document.activeElement),true);
 await form.locator('[name="project_name"]').fill('Kaydedilmemiş proje');
 assert.equal(await form.locator('[type="submit"]').isEnabled(),true);
 await profile.locator('[data-academic-profile-action="cancel"]').click();
 assert.equal(await editor.getAttribute('open'),null);
 assert.equal(await form.locator('[name="project_name"]').inputValue(),'Park envanteri');
 await profile.locator('.dg-profile-heading [data-academic-profile-action="edit"]').click();
 await form.locator('[name="institution"]').fill('Yeni Araştırma Üniversitesi');
 await form.locator('[name="orcid"]').fill('bad');await form.locator('[type="submit"]').click();
 assert.match(await profile.locator('#dgAcademicProfileStatus').innerText(),/ORCID/);
 assert.equal(await page.evaluate(()=>window.__profileUpdates.length),0);
 await form.locator('[name="orcid"]').fill('0000-0002-1825-0097');
 await page.evaluate(()=>{window.__profileFail=true;});await form.locator('[type="submit"]').click();
 await profile.locator('#dgAcademicProfileStatus').filter({hasText:'Kaydedilemedi'}).waitFor();
 assert.equal(await form.locator('[name="institution"]').inputValue(),'Yeni Araştırma Üniversitesi');
 await page.evaluate(()=>{window.__profileFail=false;const form=document.getElementById('dgAcademicProfileForm');form.requestSubmit();form.requestSubmit();});
 await profile.locator('#dgAcademicSavedStatus').filter({hasText:'hesabınıza kaydedildi'}).waitFor();
 assert.equal(await page.evaluate(()=>window.__profileUpdates.length),2,'one failure and one successful save; no duplicate write');
 const saved=await page.evaluate(()=>USER.user_metadata.dendrogeo_profile);
 assert.equal(saved.title,'Korunacak başlık');assert.equal(saved.sampling,'Korunacak örnekleme');assert.equal(saved.institution,'Yeni Araştırma Üniversitesi');
 assert.equal(await editor.getAttribute('open'),null);
 await page.evaluate(axe.source);
 const violations=await profile.evaluate(async e=>(await axe.run(e,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>v.id));assert.deepEqual(violations,[]);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.evaluate(()=>document.getElementById('toastWrap')?.replaceChildren());
 await profile.screenshot({path:join(out,'profile-'+width+'.png')});
 for(const view of ['map','records','projects']){await profile.locator('[data-academic-profile-action="'+view+'"]').click();await page.locator('#v-'+view+'.on').waitFor();await page.locator('#side [data-dg-view="dash"]').click();}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,engine:engine.name(),editFocus:true,cancelRestores:true,orcidValidation:true,errorRetainsDraft:true,duplicateSaveBlocked:true,hiddenFieldsPreserved:true,quickNavigation:true,accessible:true}));
 await page.close();
}}finally{await browser.close();await server.close();}
