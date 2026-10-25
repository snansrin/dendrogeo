import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await isolateAccount(page);await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(async()=>{await loadProjects();PROJ_LIST=[{id:1,park_id:25,name:'Fixture project',owner:USER.id}];document.getElementById('mProject').innerHTML='<option value="1">Fixture project</option>';await go('measure');document.getElementById('mGroup').value='İBRELİ';fillSpecies();});
 const control=page.locator('#mSpeciesControl'),list=page.locator('#mSpeciesOptions');
 await control.click();assert.equal(await list.isVisible(),true);
 const expected=await page.evaluate(()=>{const option=document.getElementById('mSpecies').options[1];return{value:option.value,label:option.textContent};});
 const row=list.locator('[role="option"]').nth(1);await row.click();
 assert.equal(await page.locator('#mSpecies').inputValue(),expected.value);
 assert.equal(await list.isVisible(),false);
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  assert.equal(await control.locator('i[lang="la"]').evaluate(e=>getComputedStyle(e).fontStyle),'italic');
  assert.equal(await control.evaluate(e=>getComputedStyle(e).fontStyle),'normal');
  await control.click();assert.equal(await row.locator('i[lang="la"]').evaluate(e=>getComputedStyle(e).fontStyle),'italic');
  await control.press('Escape');assert.equal(await list.isVisible(),false);
 }
 await control.press('ArrowDown');await control.press('ArrowDown');await control.press('Enter');
 assert.equal(await page.locator('#mSpecies').evaluate(e=>e.selectedIndex),2);
 await page.evaluate(()=>{document.getElementById('mSpecies').selectedIndex=1;showLatin();});
 assert.ok((await control.textContent()).startsWith(expected.label));
 await page.evaluate(()=>dgSetLang('en'));
 assert.equal(await page.locator('#mSpecies').inputValue(),expected.value,'language must preserve canonical species value');
 assert.equal(await control.locator('i[lang="la"]').evaluate(e=>getComputedStyle(e).fontStyle),'italic');
 await control.click();await page.locator('#mGroup').click();assert.equal(await list.isVisible(),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js','utf8'));
 const violations=await page.evaluate(async()=>(await axe.run(document.querySelector('.dg-species-select'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));
 assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine:engine.name(),width,selectedLatinItalic:true,optionLatinItalic:true,commonNameNormal:true,canonicalValuePreserved:true,keyboard:true,bilingual:true,themes:true}));await page.close();
}}finally{await browser.close();await server.close();}
