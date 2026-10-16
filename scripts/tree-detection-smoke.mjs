import assert from 'node:assert/strict';
import axe from 'axe-core';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
const server=await serveFixture(),chromium=await loadChromium();
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium;
const browser=await engine.launch({headless:true});
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:950},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await isolateAccount(page);
 // Keep mocked inference same-origin: WebKit blocks synthetic cross-origin preflights.
 // Production CORS and authentication are tested independently against the deployed endpoint.
 await page.addInitScript(base=>{const original=window.fetch.bind(window);window.fetch=(url,options)=>original(typeof url==='string'&&url.endsWith('/functions/v1/tree-detection')?base+'/functions/v1/tree-detection':url,options);},server.url);
 let calls=0,fail=false;
 await page.route('**/functions/v1/tree-detection',async route=>{
  calls++;const body=route.request().postDataJSON();assert.equal(Object.hasOwn(body,'api_key'),false);assert.equal(body.width,128);assert.equal(body.height,128);assert.match(body.image,/^\/9j\//);
  await route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{error:'configuration_missing'}:{modelId:'tree-detection-fuytu/4',image:{width:128,height:128},predictions:[{x:50,y:50,width:20,height:20,confidence:.8,class:'Tree'},{x:51,y:51,width:20,height:20,confidence:.7,class:'objects-tree'},{x:80,y:80,width:12,height:12,confidence:.2,class:'Tree'}]})});
 });
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await page.evaluate(()=>go('map'));

 const panel=page.locator('#treeDetectionPanel');await panel.locator('summary').click();await panel.locator('[data-tree-file]').waitFor();
 assert.equal(await panel.locator('[data-tree-run]').isDisabled(),true);assert.equal(calls,0);
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#237648';ctx.fillRect(0,0,128,128);return c.toDataURL().split(',')[1];});
 await panel.locator('[data-tree-file]').setInputFiles({name:'synthetic-test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await panel.locator('[data-tree-run]').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-tree-run]').disabled);assert.equal(calls,0,'selection does not send image');
 await panel.locator('[data-tree-run]').click();
 try{await page.waitForFunction(()=>document.querySelector('[data-tree-status]').textContent==='1 ağaç adayı');}catch(error){console.error(JSON.stringify({calls,status:await panel.locator('[data-tree-status]').innerText(),errors}));throw error;}
 assert.equal(calls,1);
 await page.addScriptTag({content:axe.source});
 for(const mode of ['light','dark']){
  await page.evaluate(async value=>{document.documentElement.setAttribute('data-theme',value);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all(document.getElementById('treeDetectionPanel').getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{})));},mode);
  const violations=await page.evaluate(async()=>(await axe.run(document.getElementById('treeDetectionPanel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(item=>({id:item.id,targets:item.nodes.map(n=>n.target)})));assert.deepEqual(violations,[],mode+' tree panel accessibility');
  assert.equal(await panel.evaluate(node=>getComputedStyle(node).fontFamily.includes('Manrope')),true);
 }
 assert.equal(await panel.locator('[data-tree-download]').isVisible(),true);assert.equal(await panel.locator('canvas').isVisible(),true);
 await page.evaluate(()=>dgSetLang('en'));assert.match(await panel.innerText(),/1 tree candidates/);assert.match(await panel.innerText(),/Detect trees/);
 await page.evaluate(()=>dgSetLang('tr'));assert.match(await panel.innerText(),/Ağaçları algıla/);
 const download=page.waitForEvent('download');await panel.locator('[data-tree-download]').click();assert.equal((await download).suggestedFilename(),'dendrogeo-tree-candidates.json');
 await panel.locator('[data-tree-confidence]').selectOption('0.7');assert.equal(await panel.locator('[data-tree-download]').isVisible(),false);
 fail=true;await panel.locator('[data-tree-run]').click();await page.waitForFunction(()=>document.querySelector('[data-tree-status]').textContent.includes('yapılandırılmamış'));
 await panel.locator('[data-tree-clear]').click();assert.equal(await panel.locator('canvas').isVisible(),false);assert.equal(await panel.locator('[data-tree-run]').isDisabled(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine:engine.name(),width,explicitSend:true,candidateOnly:true,language:true,configurationError:true,noOverflow:true}));await page.close();
}}finally{await browser.close();await server.close();}
