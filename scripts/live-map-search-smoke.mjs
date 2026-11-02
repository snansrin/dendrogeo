import assert from 'node:assert/strict';
import axe from 'axe-core';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430,1280]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await isolateAccount(page);await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.locator('#side [data-dg-view="map"]').click();
 await page.evaluate(()=>{window.__lookupCalls=[];window.dgScanSearchByName=async name=>__lookupCalls.push(name);});
 const workspace=page.locator('#dgLiveProjects'),summary=workspace.locator('summary');
 assert.equal(await workspace.evaluate(el=>el.open),false);assert.equal(await page.locator('#dgLiveProjectSelect').isVisible(),false);
 await summary.click();assert.equal(await page.locator('#dgLiveProjectSelect').isVisible(),true);
 await summary.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#dgLiveProjectSelect').isVisible(),false);
 assert.deepEqual(await page.evaluate(()=>__lookupCalls),[]);
 const input=page.locator('#dgLiveParkName');assert.equal(await input.isVisible(),true);await input.fill('Büyük park, Ankara');await input.press('Enter');await page.waitForFunction(()=>__lookupCalls.length===1&&document.getElementById('dgLiveParkSearch').getAttribute('aria-busy')==='false');
 assert.deepEqual(await page.evaluate(()=>__lookupCalls),['Büyük park, Ankara']);
 await page.evaluate(axe.source);
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  const violations=await page.evaluate(async()=>(await axe.run(document.getElementById('dgLiveParkSearch'))).violations.map(v=>v.id));assert.deepEqual(violations,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine:engine.name(),width,disclosureKeyboard:true,persistentSearch:true,enterSearch:true,noAutomaticScan:true,themes:true,accessibility:true}));await page.close();
}}finally{await browser.close();await server.close();}
