import assert from 'node:assert/strict';
import axe from 'axe-core';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
const server=await serveFixture(),chromium=await loadChromium();
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium;
const browser=await engine.launch({headless:true});
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:950},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await isolateAccount(page);
 // Mock requests stay same-origin; deployed CORS/auth are checked independently.
 await page.addInitScript(base=>{const original=window.fetch.bind(window);window.fetch=(url,options)=>{if(typeof url==='string'){if(url.endsWith('/functions/v1/tree-detection'))url=base+'/functions/v1/tree-detection';else if(url.includes('World_Imagery/MapServer/tile/'))url=base+'/test-tile/'+url.split('/tile/')[1];}return original(url,options);};},server.url);
 let calls=0,fail=false,tileFail=false,tile;
 await page.route('**/test-tile/**',route=>route.fulfill({status:tileFail?404:200,contentType:'image/png',body:tileFail?Buffer.alloc(0):tile}));
 await page.route('**/functions/v1/tree-detection',async route=>{
  calls++;const body=route.request().postDataJSON();assert.equal(body.width,1024);assert.equal(body.height,1024);assert.equal(body.confidence,0);assert.equal(Object.hasOwn(body,'api_key'),false);assert.match(body.image,/^\/9j\//);
  await route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{error:'configuration_missing'}:{modelId:'tree-detection-fuytu/4',image:{width:1024,height:1024},predictions:[{x:500,y:500,width:20,height:30,confidence:.8,class:'Tree'},{x:501,y:501,width:20,height:30,confidence:.7,class:'objects-tree'},{x:600,y:600,width:12,height:12,confidence:.2,class:'Tree'}]})});
 });
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await page.evaluate(()=>{go('map');initMaps();});
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').fillRect(0,0,256,256);return c.toDataURL().split(',')[1];});tile=Buffer.from(png,'base64');
 const panel=page.locator('#treeDetectionPanel');await panel.locator('summary').click();await panel.locator('[data-tree-run]').waitFor();assert.equal(await panel.locator('input[type=file]').count(),0);assert.equal(calls,0);
 assert.equal(await panel.locator('[data-tree-run]').isDisabled(),true);
 await page.evaluate(()=>{const p=DG_PARK_TREE_SCAN_PLAN.pixel(40,32,19);PARK_POLY=[[[p[0]-400,p[1]-400],[p[0]+400,p[1]-400],[p[0]+400,p[1]+400],[p[0]-400,p[1]+400],[p[0]-400,p[1]-400]].map(point=>DG_PARK_TREE_SCAN_PLAN.coordinate(...point,19))];PARK_HOLES=[];map.setView([40,32],18);window.__parkBeforeTree=JSON.stringify(PARK_POLY);document.getElementById('parkInfo').style.display='block';});
 await panel.locator('[data-tree-run]').click();await page.waitForFunction(()=>document.querySelector('[data-tree-status]').textContent.includes('Tarama tamamlandı'));
 assert.equal(calls,1);assert.match(await panel.locator('[data-tree-metrics]').innerText(),/Ağaç adayı: 1/);
 assert.equal(await page.evaluate(()=>JSON.stringify(PARK_POLY)===__parkBeforeTree),true);
 assert.equal(await page.evaluate(()=>{let candidates=0;map.eachLayer(layer=>{if(layer._dgTreeCandidates){candidates+=layer._dgTreeCount;if(layer.options.interactive)throw Error('Candidate layer must not capture editor clicks');}});return candidates;}),1);
 await panel.locator('[data-tree-list]>summary').click();assert.match(await panel.locator('[data-tree-rows]').innerText(),/Taç eni tahmini/);
 const range=panel.locator('[data-tree-confidence]');await range.focus();await range.press('Home');assert.match(await panel.locator('[data-tree-metrics]').innerText(),/Ağaç adayı: 2/);await range.press('End');assert.match(await panel.locator('[data-tree-metrics]').innerText(),/Ağaç adayı: 0/);assert.equal(calls,1,'slider must not repeat inference');
 await range.press('Home');await range.press('ArrowRight');assert.equal(await range.inputValue(),'1');
 await page.evaluate(()=>dgSetLang('en'));assert.match(await panel.innerText(),/Scan selected park/);await page.evaluate(()=>dgSetLang('tr'));
 await page.addScriptTag({content:axe.source});
 for(const mode of ['light','dark']){await page.evaluate(async value=>{document.documentElement.setAttribute('data-theme',value);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all(document.getElementById('treeDetectionPanel').getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));},mode);const violations=await page.evaluate(async()=>(await axe.run(document.getElementById('treeDetectionPanel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));assert.deepEqual(violations,[],mode+' panel accessibility');}
 const download=page.waitForEvent('download');await panel.locator('[data-tree-download]').click();assert.equal((await download).suggestedFilename(),'dendrogeo-park-tree-candidates.json');
 fail=true;await panel.locator('[data-tree-run]').click();await page.waitForFunction(()=>document.querySelector('[data-tree-status]').textContent.includes('yapılandırılmamış'));assert.match(await panel.locator('[data-tree-status]').innerText(),/Eksik tarama/);assert.equal((await panel.locator('[data-tree-metrics]').innerText()).trim(),'','transport failure must not look like a zero-tree count');
 fail=false;tileFail=true;const before=calls;await panel.locator('[data-tree-run]').click();await page.waitForFunction(()=>document.querySelector('[data-tree-status]').textContent.includes('Uydu görüntüsü tam alınamadı'));assert.equal(calls,before,'missing imagery cannot be inferred');
 await panel.locator('[data-tree-clear]').click();assert.equal(await panel.locator('[data-tree-download]').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);console.log(JSON.stringify({engine:engine.name(),width,directParkScan:true,sliderLocal:true,groundExtentProxy:true,readOnlyLayer:true,missingImageryStops:true,bilingual:true,themes:true}));await page.close();
}}finally{await browser.close();await server.close();}
