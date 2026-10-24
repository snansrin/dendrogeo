import assert from 'node:assert/strict';import axe from 'axe-core';
import{serveFixture,isolateAccount}from'./lib/browser-acceptance-fixture.mjs';
import{installStageFixture}from'./lib/park-stage-browser-fixture.mjs';
import{loadChromium}from'./lib/playwright-runtime.mjs';
import{join}from'node:path';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await isolateAccount(page);await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await installStageFixture(page);
 const summary=page.locator('#dgStageToolsMenu > summary'),host=page.locator('#dgParkStageWorkspace');await summary.click();
 assert.equal(await host.evaluate(el=>el.closest('#surfaceMenuBar')!==null),true);
 await page.waitForFunction(()=>!document.querySelector('[data-stage-action="edit"]').disabled);
 await host.locator('[data-stage-action="edit"]').click();await host.locator('#dgStageName').fill('Kolay bölüm');
 await host.locator('[data-stage-action="suggest"]').click();await page.waitForFunction(()=>document.querySelectorAll('#dgStageProposal option').length===2);
 assert.equal(await host.locator('#dgStageName').inputValue(),'Kolay bölüm');
 await host.locator('#dgStageProposal').selectOption('1');
 assert.deepEqual(await page.evaluate(()=>({id:DG_PARK.id,writes:__stageFixture.writes,unchanged:JSON.stringify(PARK_POLY)===JSON.stringify(__parentCandidate.rings.outer)})),{id:9001,writes:0,unchanged:true});
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   assert.equal(await host.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,JSON.stringify(await host.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,overflow:[...el.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().right>el.getBoundingClientRect().right+1).map(n=>[n.tagName,n.className,n.getBoundingClientRect().width,n.getBoundingClientRect().right-el.getBoundingClientRect().right])}))));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 }
 if(process.env.DG_STAGE_SCREENSHOT_DIR){await page.evaluate(()=>document.getElementById('toastWrap')?.replaceChildren());await page.locator('#dgStageToolsMenu > .dg-editor-menu-body').evaluate(el=>{el.scrollTop=0;});await page.locator('#dgStageToolsMenu > .dg-editor-menu-body').screenshot({path:join(process.env.DG_STAGE_SCREENSHOT_DIR,'otomatik-etap-'+width+'.png')});}
 await host.locator('[data-stage-action="pick"]').click();await page.locator('#map').scrollIntoViewIfNeeded();
 const positions=await page.evaluate(()=>{map.stop();map.fitBounds(L.latLngBounds(__parentCandidate.rings.outer),{animate:false,padding:[24,24]});const box=map.getContainer().getBoundingClientRect();return [[39.002,32.01],[39.008,32.01]].map(point=>{const p=map.latLngToContainerPoint(point);return{x:box.left+p.x,y:box.top+p.y};});});
 for(const p of positions)await page.mouse.click(p.x,p.y);
 console.log(JSON.stringify(await page.evaluate(()=>({step:'two-points',status:document.getElementById('dgStageStatus')?.textContent,markers:Object.values(map._layers).filter(l=>l instanceof L.Marker).length}))));
 await page.getByRole('button',{name:'Ad ver ve kaydet',exact:true}).waitFor();
 const preview=await page.evaluate(()=>({id:DG_PARK.id,writes:__stageFixture.writes,anchors:Object.values(map._layers).filter(layer=>layer instanceof L.Marker&&layer.options.draggable).map(layer=>layer.getLatLng().lat)}));
 assert.equal(preview.id,9001);assert.equal(preview.writes,0);assert.equal(preview.anchors.length,2);
 await page.getByRole('button',{name:'Ad ver ve kaydet',exact:true}).click();
 assert.equal(await host.locator('#dgStageName').inputValue(),'Kolay bölüm');
 await page.addScriptTag({content:axe.source});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document.getElementById('dgParkStageWorkspace'))).violations.map(v=>v.id)),[]);
 await host.locator('[data-stage-action="save"]').click();await page.waitForFunction(()=>DG_PARK?.id===9002);
 const saved=await page.evaluate(()=>({id:DG_PARK.id,writes:__stageFixture.writes,geometry:PARK_POLY,name:DG_PARK.name,hint:!!document.querySelector('.dg-stage-map-hint')}));
 assert.equal(saved.writes,1);assert.match(saved.name,/Kolay bölüm/);assert.equal(saved.hint,false);
 for(const p of saved.geometry.flat())assert.ok(p[0]>=Math.min(...preview.anchors)-1e-9&&p[0]<=Math.max(...preview.anchors)+1e-9);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,upperTools:true,autoProposals:true,twoClicks:true,previewReadOnly:true,savedStage:saved.id,errors}));await page.close();
}}finally{await browser.close();await server.close();}
